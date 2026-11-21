#!/usr/bin/env node
/**
 * scripts/sync-photos.mjs
 *
 * Scans `photos/raw/<CityId>/` for raw camera/phone images (.jpg, .jpeg, .png, .webp, .heic, .heif, .tiff),
 * strips EXIF/GPS metadata, resizes to max 960px edge, encodes to compressed WebP in
 * `public/gardenleave/photos/<CityId>/`, and generates `src/sites/gardenleave/config/photos.manifest.ts`.
 *
 * Safe in CI/CD (Cloudflare Pages): when `photos/raw/` has no city folders (since `photos/raw/*` is
 * gitignored), existing committed WebP assets and `photos.manifest.ts` are preserved cleanly.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT_DIR, 'photos', 'raw');
const PUBLIC_PHOTOS_DIR = path.join(ROOT_DIR, 'public', 'gardenleave', 'photos');
const MANIFEST_PATH = path.join(
  ROOT_DIR,
  'src',
  'sites',
  'gardenleave',
  'config',
  'photos.manifest.ts'
);

const MAX_DIMENSION_PX = 960;
const WEBP_QUALITY = 82;
const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.tiff',
  '.tif',
]);

// Patterns of default camera filenames that should NOT become visible captions
const CAMERA_DEFAULT_NAME_PATTERNS = [
  /^img[-_ ]?\d+/i,
  /^dsc[-_ ]?\d+/i,
  /^dcim[-_ ]?\d+/i,
  /^pxl[-_ ]?\d+/i,
  /^mvimg[-_ ]?\d+/i,
  /^photo[-_ ]?\d+/i,
  /^image[-_ ]?\d+/i,
  /^screenshot[-_ ]?\d*/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-/i, // UUID filenames
  /^\d+$/, // Pure numbers like "01", "02", "20261204"
  /^\d{4}[-_]\d{2}[-_]\d{2}([-_ ]\d+)?$/, // Date-only filenames
];

/**
 * Derives a clean URL-safe slug and an optional human-readable caption from a raw filename.
 * Examples:
 *   "01_fushimi-inari-taisha.jpg" -> { slug: "01_fushimi-inari-taisha", caption: "Fushimi Inari Taisha" }
 *   "01.jpg"                      -> { slug: "01", caption: undefined }
 *   "IMG_4821.HEIC"               -> { slug: "img_4821", caption: undefined }
 */
function parseFilenameMetadata(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext).trim();

  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'photo';

  // Strip optional leading ordering prefix like "01_", "02-", "1. "
  const withoutOrderPrefix = base.replace(/^\d{1,3}(?:[-_.\s]+|$)/, '').trim();

  if (!withoutOrderPrefix) {
    return { slug, caption: undefined };
  }

  for (const pattern of CAMERA_DEFAULT_NAME_PATTERNS) {
    if (pattern.test(withoutOrderPrefix) || pattern.test(base)) {
      return { slug, caption: undefined };
    }
  }

  const words = withoutOrderPrefix
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!words) {
    return { slug, caption: undefined };
  }

  // Title-case if the input was all lowercase; preserve user casing if mixed case
  const isAllLower = words === words.toLowerCase();
  const caption = isAllLower
    ? words.replace(/\b\w/g, (ch) => ch.toUpperCase())
    : words;

  return { slug, caption };
}

function findBinary(candidates) {
  for (const bin of candidates) {
    try {
      execFileSync('which', [bin], { stdio: 'ignore' });
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

const SIPS_BIN = findBinary(['/usr/bin/sips', 'sips']);
const CWEBP_BIN = findBinary(['/opt/homebrew/bin/cwebp', '/usr/local/bin/cwebp', 'cwebp']);

/**
 * Reads image pixel dimensions via macOS `sips` or `cwebp`/WebP header inspection.
 */
function getImageDimensions(filePath) {
  // Fast WebP VP8/VP8L/VP8X header parser (works on any OS without external tools)
  try {
    const buf = fs.readFileSync(filePath);
    if (
      buf.length >= 30 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const chunkHeader = buf.toString('ascii', 12, 16);
      if (chunkHeader === 'VP8 ' && buf.length >= 30) {
        const width = buf.readUInt16LE(26) & 0x3fff;
        const height = buf.readUInt16LE(28) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      } else if (chunkHeader === 'VP8L' && buf.length >= 25) {
        const b0 = buf[21];
        const b1 = buf[22];
        const b2 = buf[23];
        const b3 = buf[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        if (width > 0 && height > 0) return { width, height };
      } else if (chunkHeader === 'VP8X' && buf.length >= 30) {
        const width = 1 + buf.readUIntLE(24, 3);
        const height = 1 + buf.readUIntLE(27, 3);
        if (width > 0 && height > 0) return { width, height };
      }
    }
  } catch {
    // Fallback to sips below
  }

  if (SIPS_BIN) {
    try {
      const out = execFileSync(SIPS_BIN, ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const wMatch = out.match(/pixelWidth:\s*(\d+)/);
      const hMatch = out.match(/pixelHeight:\s*(\d+)/);
      if (wMatch && hMatch) {
        return { width: Number(wMatch[1]), height: Number(hMatch[1]) };
      }
    } catch {
      // ignore
    }
  }

  return { width: 800, height: 600 };
}

/**
 * Converts a raw image file to an optimized, EXIF-stripped WebP at `destWebpPath`.
 */
function convertRawToWebp(srcPath, destWebpPath) {
  fs.mkdirSync(path.dirname(destWebpPath), { recursive: true });

  // Use macOS `sips` first to decode any format (including Apple .HEIC) and normalize
  // orientation + max dimension into a temporary PNG, then `cwebp` for WebP encoding & EXIF stripping.
  if (SIPS_BIN && CWEBP_BIN) {
    const tmpFile = path.join(
      os.tmpdir(),
      `gardenleave_photo_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
    );
    try {
      execFileSync(
        SIPS_BIN,
        ['-Z', String(MAX_DIMENSION_PX), '-s', 'format', 'png', srcPath, '--out', tmpFile],
        { stdio: 'ignore' }
      );
      execFileSync(
        CWEBP_BIN,
        ['-q', String(WEBP_QUALITY), '-metadata', 'none', tmpFile, '-o', destWebpPath],
        { stdio: 'ignore' }
      );
      return;
    } finally {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  }

  if (CWEBP_BIN) {
    execFileSync(
      CWEBP_BIN,
      [
        '-q',
        String(WEBP_QUALITY),
        '-metadata',
        'none',
        '-resize',
        String(MAX_DIMENSION_PX),
        '0',
        srcPath,
        '-o',
        destWebpPath,
      ],
      { stdio: 'ignore' }
    );
    return;
  }

  throw new Error(
    'Neither `sips` + `cwebp` nor `cwebp` was found on PATH. Install webp (`brew install webp`) to optimize raw photos.'
  );
}

function writeManifestFile(manifestMap) {
  const sortedCities = Object.keys(manifestMap).sort((a, b) => a.localeCompare(b));
  const cleanObject = {};
  for (const cityId of sortedCities) {
    if (manifestMap[cityId] && manifestMap[cityId].length > 0) {
      cleanObject[cityId] = manifestMap[cityId];
    }
  }

  const fileContent = `// AUTO-GENERATED by \`npm run photos:sync\` (scripts/sync-photos.mjs).
// Drop raw images into \`photos/raw/<CityId>/\` and run \`npm run photos:sync\`.
import { CityPhotoConfig } from './types';

export const GENERATED_CITY_PHOTOS: Record<string, CityPhotoConfig[]> = ${JSON.stringify(
    cleanObject,
    null,
    2
  )};
`;

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  if (fs.existsSync(MANIFEST_PATH) && fs.readFileSync(MANIFEST_PATH, 'utf8') === fileContent) {
    return;
  }
  fs.writeFileSync(MANIFEST_PATH, fileContent, 'utf8');
}

function main() {
  const forceClean = process.argv.includes('--clean');

  // Discover raw city directories if `photos/raw` exists
  const rawCityDirs = fs.existsSync(RAW_DIR)
    ? fs
        .readdirSync(RAW_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name)
    : [];

  // If there are no raw city directories (e.g., on CI or fresh clone), preserve existing manifest
  // or create an empty one if missing.
  if (rawCityDirs.length === 0) {
    if (!fs.existsSync(MANIFEST_PATH)) {
      writeManifestFile({});
      console.log('[photos:sync] Created empty photos.manifest.ts (no raw photos yet).');
    } else {
      console.log('[photos:sync] No raw city folders in photos/raw/ — keeping existing manifest.');
    }
    return;
  }

  let convertedCount = 0;
  let cachedCount = 0;
  const manifestMap = {};

  for (const cityId of rawCityDirs) {
    const cityRawDir = path.join(RAW_DIR, cityId);
    const cityPublicDir = path.join(PUBLIC_PHOTOS_DIR, cityId);

    // Optional captions.json inside photos/raw/<CityId>/captions.json
    let captionsJson = {};
    const captionsPath = path.join(cityRawDir, 'captions.json');
    if (fs.existsSync(captionsPath)) {
      try {
        captionsJson = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
      } catch (err) {
        console.warn(`[photos:sync] Warning: Invalid JSON in ${captionsPath}:`, err.message);
      }
    }

    const rawFiles = fs
      .readdirSync(cityRawDir, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isFile() || entry.name.startsWith('.')) return false;
        const ext = path.extname(entry.name).toLowerCase();
        return SUPPORTED_EXTENSIONS.has(ext);
      })
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (rawFiles.length === 0) {
      continue;
    }

    const cityPhotos = [];
    const expectedWebpFiles = new Set();

    for (const rawFile of rawFiles) {
      const srcPath = path.join(cityRawDir, rawFile);
      const { slug, caption: derivedCaption } = parseFilenameMetadata(rawFile);
      const outWebpName = `${slug}.webp`;
      expectedWebpFiles.add(outWebpName);

      const destWebpPath = path.join(cityPublicDir, outWebpName);
      const srcStat = fs.statSync(srcPath);
      const destExists = fs.existsSync(destWebpPath);
      const isUpToDate =
        !forceClean && destExists && fs.statSync(destWebpPath).mtimeMs >= srcStat.mtimeMs;

      if (isUpToDate) {
        cachedCount++;
      } else {
        convertRawToWebp(srcPath, destWebpPath);
        convertedCount++;
      }

      const { width, height } = getImageDimensions(destWebpPath);

      // Lookup optional metadata from captions.json by exact filename or slug
      const metaOverride = captionsJson[rawFile] || captionsJson[slug] || {};
      const customCaption =
        typeof metaOverride === 'string' ? metaOverride : metaOverride.caption;
      const customDate = typeof metaOverride === 'object' ? metaOverride.date : undefined;

      const finalCaption = customCaption !== undefined ? customCaption : derivedCaption;

      const photoEntry = {
        id: `${cityId}-${slug}`,
        src: `/gardenleave/photos/${encodeURIComponent(cityId)}/${encodeURIComponent(outWebpName)}`,
        width,
        height,
      };
      if (finalCaption) {
        photoEntry.caption = finalCaption;
      }
      if (customDate) {
        photoEntry.date = customDate;
      }

      cityPhotos.push(photoEntry);
    }

    // Remove any orphaned WebP files in public/gardenleave/photos/<CityId>/
    if (fs.existsSync(cityPublicDir)) {
      for (const existing of fs.readdirSync(cityPublicDir)) {
        if (existing.endsWith('.webp') && !expectedWebpFiles.has(existing)) {
          fs.unlinkSync(path.join(cityPublicDir, existing));
        }
      }
    }

    manifestMap[cityId] = cityPhotos;
  }

  writeManifestFile(manifestMap);
  const totalCities = Object.keys(manifestMap).length;
  const totalPhotos = Object.values(manifestMap).reduce((sum, list) => sum + list.length, 0);
  console.log(
    `[photos:sync] Synced ${totalPhotos} photo(s) across ${totalCities} city/cities (${convertedCount} optimized, ${cachedCount} cached).`
  );
}

main();

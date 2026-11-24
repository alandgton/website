import * as THREE from 'three';
import type { CalicoCoatPalette } from '../config/home.config';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = clamp(t, 0, 1);
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

/** Fast deterministic 3D value noise in [0, 1] for seamless organic fur patch edges. */
function hash3(ix: number, iy: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = lerp(c000, c100, ux);
  const x10 = lerp(c010, c110, ux);
  const x01 = lerp(c001, c101, ux);
  const x11 = lerp(c011, c111, ux);
  const y0 = lerp(x00, x10, uy);
  const y1 = lerp(x01, x11, uy);
  return lerp(y0, y1, uz);
}

function fbm3(x: number, y: number, z: number): number {
  return (
    valueNoise3(x, y, z) * 0.56 +
    valueNoise3(x * 2.13 + 11.7, y * 2.13 - 4.3, z * 2.13 + 7.1) * 0.29 +
    valueNoise3(x * 4.41 - 3.1, y * 4.41 + 9.2, z * 4.41 - 5.4) * 0.15
  );
}

interface ParsedPalette {
  cream: Rgb;
  creamShadow: Rgb;
  ginger: Rgb;
  gingerDeep: Rgb;
  gingerLight: Rgb;
  charcoal: Rgb;
  charcoalDeep: Rgb;
  agoutiTaupe: Rgb;
}

function parseCoatPalette(palette: CalicoCoatPalette): ParsedPalette {
  return {
    cream: hexToRgb(palette.cream),
    creamShadow: hexToRgb(palette.creamShadow),
    ginger: hexToRgb(palette.ginger),
    gingerDeep: hexToRgb(palette.gingerDeep),
    gingerLight: hexToRgb(palette.gingerLight),
    charcoal: hexToRgb(palette.charcoal),
    charcoalDeep: hexToRgb(palette.charcoalDeep),
    agoutiTaupe: hexToRgb(palette.charcoalHighlight),
  };
}

/**
 * Computes rich tabico (brown-tabby calico) fur coloration:
 * - Crisp snowy-white base
 * - Warm russet-cinnamon ginger patches with soft burnt-sienna tabby banding
 * - Warm golden-taupe brown-tabby agouti coat overlaid with espresso-black tabby stripes
 */
function shadeTabicoFur(
  c: ParsedPalette,
  gingerWeight: number,
  tabbyWeight: number,
  tabbyStripeDarkness: number,
  x: number,
  y: number,
  z: number,
): Rgb {
  // Fine plush directional fur hair micro-grain
  const grain = valueNoise3(x * 36, y * 16, z * 36) - 0.5;
  const fineTuft = valueNoise3(x * 74 + 5.1, y * 30, z * 74 - 3.7) - 0.5;
  const tickedAgouti = valueNoise3(x * 95 - 2.2, y * 58 + 4.1, z * 95 + 1.9) - 0.5;
  const furMod = grain * 0.65 + fineTuft * 0.35;

  // Snowy white fur with subtle warm shading
  let base = mixRgb(c.cream, c.creamShadow, clamp(0.14 + furMod * 0.32, 0, 1));

  // Warm russet-cinnamon ginger fur with natural darker marmalade stripes
  if (gingerWeight > 0.001) {
    const stripeWave = Math.sin(y * 13.5 + x * 4.0 + z * 3.5 + fbm3(x * 3.2, y * 3.2, z * 3.2) * 2.2);
    const stripeT = smoothstep(-0.3, 0.72, stripeWave);
    let gingerCol = mixRgb(c.gingerDeep, c.ginger, 0.38 + stripeT * 0.62);
    gingerCol = mixRgb(gingerCol, c.gingerLight, clamp(0.24 + furMod * 0.45 + tickedAgouti * 0.2, 0, 1));
    base = mixRgb(base, gingerCol, gingerWeight);
  }

  // Brown-black mackerel tabby fur: rich deep warm espresso-chocolate & black with ticked golden-brown highlights
  if (tabbyWeight > 0.001) {
    const warmAgouti = mixRgb(c.charcoal, c.agoutiTaupe, clamp(0.55 + furMod * 0.45 + tickedAgouti * 0.5, 0, 1));
    const darkStripeCol = mixRgb(c.charcoalDeep, c.charcoal, clamp(0.32 + furMod * 0.35 + tickedAgouti * 0.25, 0, 1));
    const tabbyCol = mixRgb(warmAgouti, darkStripeCol, clamp(tabbyStripeDarkness, 0, 1));
    base = mixRgb(base, tabbyCol, tabbyWeight);
  }

  return base;
}

function finalizeTexture(canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Seamless 3D-projected Tabico head texture modeled directly after the user's calico-tabby cat:
 * - Crisp narrow snowy-white nose bridge blaze & lower muzzle/chin
 * - Signature warm russet-cinnamon ginger patch above the cat's left eye (+X, viewer's right)
 * - Rich warm brown-black striped tabby across the right brow (-X), both cheeks (with mascara stripes),
 *   forehead crown, and back of skull, plus warm cinnamon touches near the ear bases
 */
export function createHeadCalicoTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const c = parseCoatPalette(palette);
  const noseDustyPink = hexToRgb('#d8bfc1');

  for (let py = 0; py < height; py++) {
    const theta = ((py + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const ny = Math.cos(theta);

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const nz = Math.sin(phi) * sinT;

      const edgeNoise = (fbm3(nx * 5.2 + 2.1, ny * 5.2 - 1.3, nz * 5.2 + 0.7) - 0.5) * 0.24;
      const microEdge = (valueNoise3(nx * 34, ny * 22, nz * 34) - 0.5) * 0.055;
      const n = edgeNoise + microEdge;

      // Narrow snowy-white nose blaze tapering upward into a feathered flame between the eyes
      const blazeCenterX = 0.01 - Math.max(0, ny) * 0.035;
      const blazeHalfWidth =
        ny < -0.14
          ? 0.41
          : 0.13 * (1 - smoothstep(-0.08, 0.52, ny)) + 0.025;
      const distFromBlaze = Math.abs(nx - blazeCenterX);
      const whiteBlazeMask =
        smoothstep(0.28, 0.52, nz + n * 0.22) *
        smoothstep(blazeHalfWidth + 0.065, blazeHalfWidth - 0.03, distFromBlaze - n * 0.26) *
        smoothstep(0.55, 0.30, ny - n * 0.28);

      // Crisp snowy chin and lower throat underside
      const whiteChinMask =
        smoothstep(-0.24, -0.44, ny - n * 0.28) * smoothstep(-0.2, 0.22, nz + n * 0.25);
      const whiteMask = Math.max(whiteBlazeMask, whiteChinMask);

      // Signature warm russet-cinnamon flame patch tucked beside the white blaze above the cat's LEFT eye (+X)
      // Stretched organically as a soft vertical teardrop/flame rather than a round circle
      const dGingerLeftFlame = Math.hypot((nx - 0.21) * 2.15, (ny - 0.26) * 1.25, (nz - 0.80) * 1.25);
      const dGingerCrownTint = Math.hypot((nx - 0.10) * 1.15, (ny - 0.82) * 1.3, (nz - 0.12) * 1.0);
      const dGingerBackLeft = Math.hypot((nx - 0.44) * 1.05, (ny - 0.02) * 1.05, (nz + 0.64) * 0.9);
      const gingerField =
        Math.max(0.45 - dGingerLeftFlame, 0.42 - dGingerCrownTint, 0.46 - dGingerBackLeft) +
        n * 0.92;

      // Warm brown-black striped tabby covers both sides of the face, forehead, cheeks & skull
      const tabbyBaseField = 1.0 - whiteMask * 1.15;
      const gingerW = smoothstep(0.0, 0.11, gingerField) * (1 - whiteMask);
      const tabbyW = clamp(smoothstep(0.05, 0.22, tabbyBaseField) * (1 - gingerW * 0.85), 0, 1);

      // Organic dappled feline tabby facial striping (warped by 3D fur noise so stripes break naturally)
      const warp = (fbm3(nx * 6.5, ny * 6.5, nz * 6.5) - 0.5) * 1.35;
      const crownMask = smoothstep(0.16, 0.48, ny);
      const foreheadWave = Math.cos(nx * 24.0 + Math.sin(nz * 5.0) * 0.9 + warp * 3.2);
      const foreheadStripe = smoothstep(0.18, 0.78, foreheadWave) * crownMask;

      // Subtle sweeping cheek/mascara stripes radiating gently behind the eyes
      const cheekMask =
        smoothstep(-0.26, 0.0, ny) *
        (1 - smoothstep(0.12, 0.40, ny)) *
        smoothstep(0.24, 0.55, Math.abs(nx));
      const cheekWave = Math.sin(ny * 22.0 - Math.abs(nx) * 7.5 + nz * 4.5 + warp * 2.4);
      const cheekStripe = smoothstep(0.1, 0.72, cheekWave) * cheekMask;

      // Rich dark mottled fur over top/back of skull
      const mottle = smoothstep(0.26, 0.72, fbm3(nx * 8.4 + 1.3, ny * 6.8, nz * 8.4 - 0.7));
      const topDarken = smoothstep(0.1, 0.72, ny) * 0.28 + smoothstep(0.15, -0.45, nz) * 0.26;

      // Slightly darker tabby brow framing right above the eyes
      const browAccent =
        Math.exp(-Math.pow((Math.abs(nx) - 0.34) / 0.16, 2)) *
        Math.exp(-Math.pow((ny - 0.25) / 0.13, 2)) *
        smoothstep(0.45, 0.82, nz);

      const stripeDarkness = clamp(
        0.30 +
          foreheadStripe * 0.48 +
          cheekStripe * 0.5 +
          mottle * 0.42 +
          topDarken +
          browAccent * 0.28,
        0.24,
        0.96,
      );

      let rgb = shadeTabicoFur(c, gingerW, tabbyW, stripeDarkness, nx, ny, nz);

      // Subtle natural dusty-pinkish tint right on the white nose bridge above the dark nose
      const noseBridgeGlow =
        Math.exp(-Math.pow(nx / 0.095, 2)) *
        Math.exp(-Math.pow((ny + 0.05) / 0.085, 2)) *
        smoothstep(0.84, 0.96, nz);
      rgb = mixRgb(rgb, noseDustyPink, noseBridgeGlow * 0.32);

      const idx = (py * width + px) * 4;
      data[idx] = clamp(Math.round(rgb.r), 0, 255);
      data[idx + 1] = clamp(Math.round(rgb.g), 0, 255);
      data[idx + 2] = clamp(Math.round(rgb.b), 0, 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Paints the user's cat's signature asymmetric brown/taupe mustache smudges
 * onto the snowy-white whisker pads right beside the dark nose!
 * - 'left' (+X, viewer's right): distinct rich dark espresso-brown smudge hugging the inner-upper edge
 * - 'right' (-X, viewer's left): softer warm golden-taupe smudge curving neatly underneath the nose
 */
export function createWhiskerPadTexture(
  palette: CalicoCoatPalette,
  side: 'left' | 'right',
): THREE.CanvasTexture {
  const width = 256;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const c = parseCoatPalette(palette);

  for (let py = 0; py < height; py++) {
    const theta = ((py + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const ny = Math.cos(theta);

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const nz = Math.sin(phi) * sinT;

      const edgeN = (fbm3(nx * 5.5 + 1.4, ny * 5.5, nz * 5.5 - 0.9) - 0.5) * 0.22;

      let tabbyW = 0;
      let stripeDark = 0.6;

      if (side === 'left') {
        // Cat's left whisker pad (+X, viewer's right): distinct dark espresso-brown smudge hugging the inner-upper edge
        const dSmudge = Math.hypot((nx + 0.30) * 0.88, (ny - 0.10) * 1.12, (nz - 0.78) * 1.0);
        tabbyW = smoothstep(0.0, 0.16, 0.56 - dSmudge + edgeN);
        stripeDark = 0.76;
      } else {
        // Cat's right whisker pad (-X, viewer's left): warm golden-taupe smudge curving neatly underneath the nose
        const dSmudge = Math.hypot((nx - 0.28) * 0.98, (ny + 0.02) * 1.18, (nz - 0.80) * 1.0);
        tabbyW = smoothstep(0.0, 0.18, 0.50 - dSmudge + edgeN) * 0.9;
        stripeDark = 0.36;
      }

      const rgb = shadeTabicoFur(c, 0, tabbyW, stripeDark, nx, ny, nz);
      const idx = (py * width + px) * 4;
      data[idx] = clamp(Math.round(rgb.r), 0, 255);
      data[idx + 1] = clamp(Math.round(rgb.g), 0, 255);
      data[idx + 2] = clamp(Math.round(rgb.b), 0, 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Seamless 3D-projected Tabico torso texture matched to the user's cat:
 * - Crisp snowy-white fluffy chest bib & throat (+Z)
 * - Dark espresso-black striped tabby collar/shoulders & dark dorsal spine ridge
 * - Warm russet-cinnamon mid-flank band + large rich russet-cinnamon left haunch (+X)
 *   bordered cleanly at the very bottom by a snowy-white lower belly/haunch trim
 */
export function createTorsoCalicoTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const c = parseCoatPalette(palette);

  for (let py = 0; py < height; py++) {
    const v = 1 - (py + 0.5) / height;
    const ny = v * 2 - 1; // [-1 bottom, +1 top]

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = Math.sin(phi);
      const nz = Math.cos(phi);

      const edgeNoise = (fbm3(nx * 4.2 + 4.2, ny * 4.2 + 1.5, nz * 4.2 - 2.3) - 0.5) * 0.24;
      const microEdge = (valueNoise3(nx * 26, ny * 16, nz * 26) - 0.5) * 0.04;
      const n = edgeNoise + microEdge;

      // Crisp snowy-white front chest bib (+Z) + crisp white lower belly/haunch under-trim
      const chestBib = smoothstep(0.32, 0.58, nz + n * 0.32) * smoothstep(-0.96, -0.62, ny);
      const lowerWhiteTrim =
        smoothstep(-0.46, -0.78, ny + n * 0.35) * smoothstep(-0.65, 0.35, nz + Math.abs(nx) * 0.5);
      const whiteMask = Math.max(chestBib, lowerWhiteTrim * 0.92);

      // Rich sweeping russet-cinnamon mid-flank & broad left haunch/rump (+X, viewer's right — matching the photo!)
      const dGingerMidBand = Math.hypot((nx - 0.84) * 0.78, (ny + 0.04) * 0.78, (nz - 0.08) * 0.95);
      const dGingerLeftRump = Math.hypot((nx - 0.58) * 0.70, (ny + 0.24) * 0.80, (nz + 0.54) * 0.74);
      // Warm russet-cinnamon patch on the right flank (-X) so all 360° angles feel richly calico-tabby
      const dGingerRightFlank = Math.hypot((nx + 0.78) * 0.82, (ny + 0.12) * 0.86, (nz + 0.22) * 0.82);
      let gingerField =
        Math.max(0.76 - dGingerMidBand, 0.90 - dGingerLeftRump, 0.72 - dGingerRightFlank) + n;

      // Deep espresso-black tabby collar/shoulders & dark dorsal spine ridge
      const dTabbyCollar = Math.hypot((nx - 0.45) * 0.85, (ny - 0.68) * 0.82, (nz - 0.12) * 0.85);
      const dTabbySpine = Math.hypot(nx * 0.85, (ny - 0.26) * 0.68, (nz + 0.88) * 0.78);
      const dTabbyRightShoulder = Math.hypot((nx + 0.65) * 0.84, (ny - 0.42) * 0.8, (nz + 0.18) * 0.84);
      let tabbyField =
        Math.max(0.84 - dTabbyCollar, 0.88 - dTabbySpine, 0.86 - dTabbyRightShoulder) + n;

      gingerField -= whiteMask * 1.1;
      tabbyField -= whiteMask * 1.1;

      // Let the lush russet-cinnamon patches shine prominently across the mid-flank & rump while keeping dark spine & shoulders
      const gingerW = smoothstep(0.0, 0.1, gingerField) * (1 - whiteMask);
      const rawTabbyW = smoothstep(0.0, 0.1, tabbyField) * (1 - whiteMask);
      const finalTabbyW = clamp(rawTabbyW * (1 - gingerW * 0.86), 0, 1);

      // Organic dappled mackerel tabby stripes (warped by 3D fur noise — no rigid straight bars!)
      const warp = (fbm3(nx * 5.2, ny * 4.5, nz * 5.2) - 0.5) * 1.65;
      const dorsalDark = smoothstep(-0.22, -0.84, nz) * smoothstep(-0.35, 0.58, ny);
      const mackerelWave = Math.sin(nz * 13.5 + ny * 3.8 + warp * 3.4);
      const mackerelStripe = smoothstep(-0.04, 0.74, mackerelWave);
      const dappledMottle = smoothstep(0.25, 0.74, fbm3(nx * 7.8, ny * 6.5, nz * 7.8));
      const stripeDarkness = clamp(
        0.36 + mackerelStripe * 0.36 + dappledMottle * 0.34 + dorsalDark * 0.44,
        0.28,
        0.97,
      );

      const rgb = shadeTabicoFur(c, gingerW, finalTabbyW, stripeDarkness, nx, ny, nz);

      const baseOcclusion = smoothstep(0.0, 0.16, v);
      const ao = 0.85 + 0.15 * baseOcclusion;

      const idx = (py * width + px) * 4;
      data[idx] = clamp(Math.round(rgb.r * ao), 0, 255);
      data[idx + 1] = clamp(Math.round(rgb.g * ao), 0, 255);
      data[idx + 2] = clamp(Math.round(rgb.b * ao), 0, 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates painterly tabico fur textures for limbs, ears, and tucked haunches.
 */
export function createSolidFurTexture(
  palette: CalicoCoatPalette,
  tone: 'cream' | 'tabbyEar' | 'leftHaunchTabico' | 'rightHaunchTabico',
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const c = parseCoatPalette(palette);

  for (let py = 0; py < size; py++) {
    const v = 1 - (py + 0.5) / size;
    for (let px = 0; px < size; px++) {
      const u = (px + 0.5) / size;
      const phi = u * Math.PI * 2;
      const nx = Math.cos(phi);
      const nz = Math.sin(phi);
      const ny = v * 2 - 1;

      const n = (fbm3(nx * 3.8 + 1.1, ny * 3.8, nz * 3.8 - 0.8) - 0.5) * 0.24;

      let gingerW = 0;
      let tabbyW = 0;
      let stripeDark = 0.55;

      if (tone === 'tabbyEar') {
        // Dark brown-tabby ear backs with subtle warm cinnamon tint near base, darkening toward tip
        tabbyW = 1.0;
        gingerW = smoothstep(0.62, 0.12, v + n * 0.35) * 0.34;
        stripeDark = clamp(0.42 + v * 0.48 + Math.sin(nx * 14 + n * 3) * 0.12, 0.25, 0.94);
      } else if (tone === 'leftHaunchTabico') {
        // Matches photo: rich russet-cinnamon upper haunch with crisp snowy-white lower belly trim!
        const whiteTrim = 1 - smoothstep(0.28, 0.44, v + n * 0.42);
        const topDark = smoothstep(0.74, 0.94, v + n * 0.35);
        gingerW = (1 - whiteTrim) * (1 - topDark * 0.65);
        tabbyW = topDark * 0.72;
        stripeDark = 0.72;
      } else if (tone === 'rightHaunchTabico') {
        // Warm brown-black striped tabby upper haunch + cinnamon edge over snowy-white lower trim
        const whiteTrim = 1 - smoothstep(0.32, 0.48, v + n * 0.42);
        const gingerBand = smoothstep(0.38, 0.58, v + n * 0.3) * (1 - smoothstep(0.62, 0.82, v));
        tabbyW = (1 - whiteTrim) * (1 - gingerBand * 0.45);
        gingerW = (1 - whiteTrim) * gingerBand * 0.55;
        const stripe = smoothstep(-0.1, 0.65, Math.sin(v * 20 + nx * 6 + n * 3));
        stripeDark = 0.35 + stripe * 0.55;
      }

      const rgb = shadeTabicoFur(c, gingerW, tabbyW, stripeDark, nx, ny, nz);
      const idx = (py * size + px) * 4;
      data[idx] = clamp(Math.round(rgb.r), 0, 255);
      data[idx + 1] = clamp(Math.round(rgb.g), 0, 255);
      data[idx + 2] = clamp(Math.round(rgb.b), 0, 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates a seamless ringed Tabico tail texture:
 * warm brown-tabby base, russet-cinnamon tabby mid-patch, crisp espresso tabby rings,
 * and a rich dark espresso-black tail tip.
 */
export function createTailCalicoTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const c = parseCoatPalette(palette);

  for (let py = 0; py < height; py++) {
    const v = 1 - (py + 0.5) / height;

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = Math.cos(phi);
      const nz = Math.sin(phi);
      const ny = v * 2 - 1;

      const edgeNoise = (fbm3(nx * 2.8 + 3.1, v * 5.2, nz * 2.8 - 1.7) - 0.5) * 0.14;
      const micro = (valueNoise3(nx * 18, v * 36, nz * 18) - 0.5) * 0.03;
      const vt = v + edgeNoise + micro;

      // Russet-cinnamon patch across lower-mid tail, ringed warm brown-black tabby throughout, dark tip
      const gingerIn = smoothstep(0.14, 0.24, vt);
      const gingerOut = 1 - smoothstep(0.46, 0.58, vt);
      const gingerW = gingerIn * gingerOut * 0.85;
      const tabbyW = clamp(1 - gingerW * 0.72, 0.22, 1);

      // Classic feline ringed tail bands + rich dark tip
      const ringWave = Math.sin(v * 34.0 + edgeNoise * 4.5);
      const ringDark = smoothstep(-0.05, 0.65, ringWave);
      const tipDark = smoothstep(0.76, 0.92, v);
      const stripeDark = clamp(0.26 + ringDark * 0.58 + tipDark * 0.55, 0.2, 0.96);

      const rgb = shadeTabicoFur(c, gingerW, tabbyW, stripeDark, nx, ny, nz);

      const idx = (py * width + px) * 4;
      data[idx] = clamp(Math.round(rgb.r), 0, 255);
      data[idx + 1] = clamp(Math.round(rgb.g), 0, 255);
      data[idx + 2] = clamp(Math.round(rgb.b), 0, 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates a subtle tileable micro-fur bump texture for plush tactile surface light scattering.
 */
export function createFurBumpTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let py = 0; py < size; py++) {
    const phiY = (py / size) * Math.PI * 2;
    for (let px = 0; px < size; px++) {
      const phiX = (px / size) * Math.PI * 2;
      const x = Math.cos(phiX) * 6.5;
      const z = Math.sin(phiX) * 6.5;
      const y = Math.cos(phiY) * 2.8;
      const w = Math.sin(phiY) * 2.8;
      const h =
        valueNoise3(x + w * 0.4, y * 1.4, z - w * 0.4) * 0.65 +
        valueNoise3(x * 2.4, y * 2.8, z * 2.4) * 0.35;
      const val = clamp(Math.round(h * 255), 0, 255);
      const idx = (py * size + px) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates luminous pale celadon / sage-olive green cat eyes matching the user's cat:
 * crisp dark charcoal eyeliner limbal border, rich glossy dark pupils, and dual catchlights.
 */
export function createCatEyeTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const width = 256;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  const outerRgb = hexToRgb(palette.eyeOuter);
  const innerRgb = hexToRgb(palette.eyeInner);
  const limbalRgb: Rgb = { r: 18, g: 20, b: 18 };
  const pupilRgb: Rgb = { r: 10, g: 11, b: 14 };
  const scleraRgb: Rgb = { r: 228, g: 226, b: 218 };
  const whiteRgb: Rgb = { r: 255, g: 255, b: 255 };

  for (let py = 0; py < height; py++) {
    const theta = ((py + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const ny = Math.cos(theta);

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const nz = Math.sin(phi) * sinT;

      let rgb = scleraRgb;

      if (nz > 0.15) {
        const r = Math.hypot(nx, ny);
        const angle = Math.atan2(ny, nx);

        const irisRadius = 0.80;
        if (r < irisRadius) {
          const t = r / irisRadius;
          const fiber = Math.sin(angle * 28) * 0.045 + Math.cos(angle * 43 + r * 6) * 0.03;
          const gradT = clamp(Math.pow(t, 0.85) + fiber, 0, 1);
          rgb = mixRgb(innerRgb, outerRgb, gradT);

          // Upper lid soft shadow across top of iris matching the expressive gaze in the photo
          const topShade = smoothstep(0.14, 0.58, ny);
          rgb = mixRgb(rgb, limbalRgb, topShade * 0.4);

          // Soft celadon luminous bounce at bottom of iris
          const lowerGlow = smoothstep(-0.1, -0.52, ny) * (1 - t * 0.5);
          rgb = mixRgb(rgb, { r: 222, g: 232, b: 175 }, lowerGlow * 0.34);

          // Distinct dark eyeliner limbal rim (classic brown-tabby eye framing)
          const limbal = smoothstep(0.72, 0.94, t);
          rgb = mixRgb(rgb, limbalRgb, limbal * 0.92);

          // Expressive slightly dilated dark pupil
          const pupilDist = Math.hypot(nx * 1.18, ny * 0.98);
          const pupilMask = 1 - smoothstep(0.41, 0.47, pupilDist);
          rgb = mixRgb(rgb, pupilRgb, pupilMask);

          // Crisp upper-left catchlight sparkle
          const sp1 = 1 - smoothstep(0.12, 0.18, Math.hypot(nx + 0.22, ny - 0.23));
          rgb = mixRgb(rgb, whiteRgb, sp1 * 0.96);

          // Tiny secondary lower-right catchlight
          const sp2 = 1 - smoothstep(0.055, 0.09, Math.hypot(nx - 0.19, ny + 0.21));
          rgb = mixRgb(rgb, whiteRgb, sp2 * 0.82);
        } else {
          const edgeBlend = smoothstep(irisRadius, irisRadius + 0.1, r);
          rgb = mixRgb(limbalRgb, scleraRgb, edgeBlend);
        }
      }

      const idx = (py * width + px) * 4;
      data[idx] = clamp(Math.round(rgb.r), 0, 255);
      data[idx + 1] = clamp(Math.round(rgb.g), 0, 255);
      data[idx + 2] = clamp(Math.round(rgb.b), 0, 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates a subtle woven-velvet fabric texture for the cozy cat cushion.
 */
export function createCushionFabricTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const base = hexToRgb(palette.cushionBase);
  const accent = hexToRgb(palette.cushionAccent);

  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin((x * Math.PI * 2) / 6) * 0.5 + 0.5;
      const weft = Math.sin((y * Math.PI * 2) / 6) * 0.5 + 0.5;
      const twill = (x + y) % 6 < 3 ? warp : weft;
      const grain = (hash3(x, y, 17) - 0.5) * 0.12;
      const t = clamp(twill * 0.32 + grain + 0.08, 0, 1);
      const rgb = mixRgb(base, accent, t);

      const idx = (y * size + x) * 4;
      data[idx] = clamp(Math.round(rgb.r), 0, 255);
      data[idx + 1] = clamp(Math.round(rgb.g), 0, 255);
      data[idx + 2] = clamp(Math.round(rgb.b), 0, 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = finalizeTexture(canvas, THREE.SRGBColorSpace);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  return tex;
}

/** Soft radial rosy cheek blush sprite texture shown when purring happily. */
export function createBlushTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(251, 134, 158, 0.85)');
  g.addColorStop(0.55, 'rgba(251, 134, 158, 0.34)');
  g.addColorStop(1, 'rgba(251, 134, 158, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/** Soft warm heart texture for floating petting particles. */
export function createHeartParticleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(size / 2, size / 2 + 4);

  const halo = ctx.createRadialGradient(0, -4, 4, 0, -4, 52);
  halo.addColorStop(0, 'rgba(251, 113, 133, 0.45)');
  halo.addColorStop(1, 'rgba(251, 113, 133, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, -4, 52, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 26);
  ctx.bezierCurveTo(-40, -2, -44, -34, -20, -34);
  ctx.bezierCurveTo(-6, -34, 0, -20, 0, -14);
  ctx.bezierCurveTo(0, -20, 6, -34, 20, -34);
  ctx.bezierCurveTo(44, -34, 40, -2, 0, 26);
  ctx.closePath();

  const fill = ctx.createLinearGradient(0, -34, 0, 28);
  fill.addColorStop(0, '#fda4af');
  fill.addColorStop(1, '#fb7185');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/** Delicate four-point warm starlight sparkle texture for petting particles. */
export function createSparkleParticleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  const glow = ctx.createRadialGradient(c, c, 2, c, c, 54);
  glow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
  glow.addColorStop(0.3, 'rgba(253, 186, 116, 0.45)');
  glow.addColorStop(1, 'rgba(253, 186, 116, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(c, c);
  ctx.beginPath();
  const outer = 40;
  const inner = 8;
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const ang = (i * Math.PI) / 4;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#fef9c3';
  ctx.fill();
  ctx.restore();

  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

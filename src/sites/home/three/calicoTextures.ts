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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Fast deterministic 3D value noise in [0, 1]. */
function hash3(ix: number, iy: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) * 2.3283064365386963e-10;
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

  const x00 = c000 + (c100 - c000) * ux;
  const x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux;
  const x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
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
  agoutiBuff: Rgb;
}

function parseCoatPalette(palette: CalicoCoatPalette): ParsedPalette {
  const agoutiTaupe = hexToRgb(palette.charcoalHighlight);
  const creamShadow = hexToRgb(palette.creamShadow);
  return {
    cream: hexToRgb(palette.cream),
    creamShadow,
    ginger: hexToRgb(palette.ginger),
    gingerDeep: hexToRgb(palette.gingerDeep),
    gingerLight: hexToRgb(palette.gingerLight),
    charcoal: hexToRgb(palette.charcoal),
    charcoalDeep: hexToRgb(palette.charcoalDeep),
    agoutiTaupe,
    // Pale warm sandy-buff ticking characteristic of real brown-tabby hairs
    agoutiBuff: {
      r: Math.round(agoutiTaupe.r * 0.58 + creamShadow.r * 0.42),
      g: Math.round(agoutiTaupe.g * 0.58 + creamShadow.g * 0.42),
      b: Math.round(agoutiTaupe.b * 0.58 + creamShadow.b * 0.42),
    },
  };
}

/**
 * Writes realistic multi-band ticked agouti & hair-strand shaded tabico fur directly
 * into a Uint8ClampedArray (zero per-pixel object allocations for fast 1024x512 baking).
 */
function writeTabicoPixel(
  data: Uint8ClampedArray,
  idx: number,
  c: ParsedPalette,
  gingerWeight: number,
  tabbyWeight: number,
  stripeDarkness: number,
  strandVal: number,
  tickVal: number,
  gingerStripeWave: number,
  ao: number,
  extraTintRgb?: Rgb,
  extraTintWeight = 0,
): void {
  // Fine plush hair highlight & root depth modulation
  const hairMod = (strandVal - 0.5) * 0.55 + (tickVal - 0.5) * 0.45;

  // 1. Base plush snowy-white fur with subtle individual strand shadow
  const creamMix = clamp(0.14 + hairMod * 0.36, 0, 1);
  let r = c.cream.r + (c.creamShadow.r - c.cream.r) * creamMix;
  let g = c.cream.g + (c.creamShadow.g - c.cream.g) * creamMix;
  let b = c.cream.b + (c.creamShadow.b - c.cream.b) * creamMix;

  // 2. Luminous warm apricot-ginger fur with soft darker cinnamon mackerel ripples & bright hair tips
  if (gingerWeight > 0.001) {
    const stripeT = smoothstep(-0.35, 0.72, gingerStripeWave);
    const gBaseMix = 0.32 + stripeT * 0.68;
    let gr = c.gingerDeep.r + (c.ginger.r - c.gingerDeep.r) * gBaseMix;
    let gg = c.gingerDeep.g + (c.ginger.g - c.gingerDeep.g) * gBaseMix;
    let gb = c.gingerDeep.b + (c.ginger.b - c.gingerDeep.b) * gBaseMix;

    const tipHi = clamp(0.18 + (strandVal - 0.5) * 0.65 + (tickVal - 0.5) * 0.35, 0, 1);
    gr += (c.gingerLight.r - gr) * tipHi;
    gg += (c.gingerLight.g - gg) * tipHi;
    gb += (c.gingerLight.b - gb) * tipHi;

    const gw = clamp(gingerWeight, 0, 1);
    r += (gr - r) * gw;
    g += (gg - g) * gw;
    b += (gb - b) * gw;
  }

  // 3. Realistic brown-black mackerel tabby: salt-and-pepper ticked agouti hairs + crisp dark espresso stripes
  if (tabbyWeight > 0.001) {
    // Individual agouti hair banding: pale sandy-buff tips, warm olive-taupe mid-shaft, dark espresso root
    const buffHighlight = smoothstep(0.56, 0.88, tickVal * 0.65 + strandVal * 0.35);
    const rootDark = smoothstep(0.45, 0.12, strandVal);

    let ar = c.agoutiTaupe.r + (c.agoutiBuff.r - c.agoutiTaupe.r) * buffHighlight * 0.78;
    let ag = c.agoutiTaupe.g + (c.agoutiBuff.g - c.agoutiTaupe.g) * buffHighlight * 0.78;
    let ab = c.agoutiTaupe.b + (c.agoutiBuff.b - c.agoutiTaupe.b) * buffHighlight * 0.78;

    ar += (c.charcoal.r - ar) * rootDark * 0.58;
    ag += (c.charcoal.g - ag) * rootDark * 0.58;
    ab += (c.charcoal.b - ab) * rootDark * 0.58;

    // Crisp dark charcoal-black mackerel tabby stripe color with fine hair-strand edge sheen
    const darkHairSheen = clamp(0.18 + strandVal * 0.42, 0, 1);
    const sr = c.charcoalDeep.r + (c.charcoal.r - c.charcoalDeep.r) * darkHairSheen;
    const sg = c.charcoalDeep.g + (c.charcoal.g - c.charcoalDeep.g) * darkHairSheen;
    const sb = c.charcoalDeep.b + (c.charcoal.b - c.charcoalDeep.b) * darkHairSheen;

    const sd = clamp(stripeDarkness + (tickVal - 0.5) * 0.16, 0, 1);
    const tr = ar + (sr - ar) * sd;
    const tg = ag + (sg - ag) * sd;
    const tb = ab + (sb - ab) * sd;

    const tw = clamp(tabbyWeight, 0, 1);
    r += (tr - r) * tw;
    g += (tg - g) * tw;
    b += (tb - b) * tw;
  }

  if (extraTintRgb && extraTintWeight > 0.001) {
    const ew = clamp(extraTintWeight, 0, 1);
    r += (extraTintRgb.r - r) * ew;
    g += (extraTintRgb.g - g) * ew;
    b += (extraTintRgb.b - b) * ew;
  }

  data[idx] = clamp(Math.round(r * ao), 0, 255);
  data[idx + 1] = clamp(Math.round(g * ao), 0, 255);
  data[idx + 2] = clamp(Math.round(b * ao), 0, 255);
  data[idx + 3] = 255;
}

function finalizeTexture(canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * High-resolution (1024x512) realistic hair-strand Tabico head coat texture modeled closely
 * after both reference photos of the user's cat:
 * - Radially flowing fine feline hair strands radiating away from the nose across brow & cheeks
 * - Narrow crisp snowy-white nose blaze with strand-feathered edges + subtle pinkish-grey nose bridge
 * - Signature warm apricot-ginger triangular flame above the cat's left eye (+X, viewer's right)
 * - Bright warm apricot-ginger crown spot between/behind the ears (prominent in Photo 2)
 * - Multi-tone forehead tabby M-stripes (alternating jet-black, honey-ochre, sandy-buff hairs)
 * - Warm sandy-taupe ticked agouti cheeks crossed by crisp sweeping black mascara stripes
 *   and framed by a dark espresso lower-cheek rim meeting the bright white throat
 */
export function createHeadCalicoTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const c = parseCoatPalette(palette);
  const noseDustyPink = hexToRgb('#d9bfc2');
  const paleEyeRim = hexToRgb('#e5dac8');

  for (let py = 0; py < height; py++) {
    const theta = ((py + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const ny = Math.cos(theta);

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const nz = Math.sin(phi) * sinT;

      // Biological radiating facial fur flow (strands comb outward & backward from nose bridge)
      const faceRad = Math.hypot(nx, ny + 0.08);
      const faceAng = Math.atan2(ny + 0.08, nx);
      const ux = Math.cos(faceAng);
      const uy = Math.sin(faceAng);

      // Fine anisotropic hair strands + high-frequency agouti ticking
      const strandFront = valueNoise3(ux * 36 + nx * 18, uy * 36 + ny * 18, faceRad * 14 + nz * 12);
      const strandBack = valueNoise3(nx * 68, ny * 24, nz * 68);
      const frontBlend = smoothstep(-0.15, 0.45, nz);
      const strandVal = strandBack + (strandFront - strandBack) * frontBlend;
      const tickVal = valueNoise3(nx * 118 + 3.4, ny * 64 - 1.9, nz * 118 + 2.2);

      // Organic patch edge noise + strand-by-strand hair interleaving at boundaries
      const macroNoise = (fbm3(nx * 5.0 + 2.1, ny * 5.0 - 1.3, nz * 5.0 + 0.7) - 0.5) * 0.2;
      const hairFeather = (strandVal - 0.5) * 0.085 + (tickVal - 0.5) * 0.035;
      const n = macroNoise + hairFeather;

      // 1. Narrow snowy-white nose blaze tapering cleanly up between the eyes
      const blazeCenterX = 0.012 - Math.max(0, ny) * 0.028;
      const blazeHalfWidth =
        ny < -0.15
          ? 0.43
          : 0.135 * (1 - smoothstep(-0.08, 0.50, ny)) + 0.022;
      const distFromBlaze = Math.abs(nx - blazeCenterX);
      const whiteBlazeMask =
        smoothstep(0.28, 0.52, nz + n * 0.22) *
        smoothstep(blazeHalfWidth + 0.055, blazeHalfWidth - 0.025, distFromBlaze - n * 0.25) *
        smoothstep(0.54, 0.28, ny - n * 0.28);

      // Crisp snowy chin & throat underside
      const whiteChinMask =
        smoothstep(-0.22, -0.42, ny - n * 0.26) * smoothstep(-0.18, 0.25, nz + n * 0.24);
      const whiteMask = Math.max(whiteBlazeMask, whiteChinMask);

      // 2. Signature warm apricot-ginger left-eye flame (+X, viewer's right)
      //    + distinct warm apricot-ginger crown spot between/behind the ears (prominent in Photo 2!)
      //    + soft natural mottled ginger-tabby whisper trailing gently down behind the left ear
      const dGingerLeftFlame = Math.hypot((nx - 0.21) * 2.2, (ny - 0.23) * 1.4, (nz - 0.82) * 1.25);
      const dGingerCrownSpot = Math.hypot((nx + 0.06) * 1.12, (ny - 0.86) * 1.32, (nz - 0.04) * 1.02);
      const dGingerEarTrail = Math.hypot((nx - 0.38) * 1.45, (ny - 0.36) * 1.05, (nz + 0.56) * 1.15);
      const gingerField =
        Math.max(0.42 - dGingerLeftFlame, 0.47 - dGingerCrownSpot, 0.38 - dGingerEarTrail) +
        macroNoise * 0.78 +
        hairFeather * 1.15;

      const gingerW = smoothstep(0.0, 0.09, gingerField) * (1 - whiteMask);
      const tabbyBaseField = 1.0 - whiteMask * 1.12;
      const tabbyW = clamp(smoothstep(0.04, 0.2, tabbyBaseField) * (1 - gingerW * 0.86), 0, 1);

      // 3. Detailed authentic domestic-shorthair tabby facial markings:
      const warp = (fbm3(nx * 6.8, ny * 6.8, nz * 6.8) - 0.5) * 0.95;

      // Crisp multi-line vertical forehead M-stripes sweeping from brow up over the crown
      const foreheadZone =
        smoothstep(0.14, 0.42, ny) * smoothstep(-0.15, 0.45, nz) * smoothstep(0.68, 0.22, Math.abs(nx));
      const mLinePhase = nx * 34.0 + Math.sin(ny * 7.5) * 0.65 + warp * 1.8;
      const foreheadFineStripe = smoothstep(0.28, 0.82, Math.cos(mLinePhase)) * foreheadZone;
      // Distinct dark central vertical forehead pencil line framing the brow
      const centerBrowLine =
        Math.exp(-Math.pow((nx + 0.08) / 0.055, 2)) *
        smoothstep(0.16, 0.36, ny) *
        smoothstep(0.45, 0.85, nz);

      // Two crisp sweeping charcoal-black cheek mascara lines curving back from the outer corners of both eyes
      const absX = Math.abs(nx);
      const cheekZone =
        smoothstep(0.24, 0.46, absX) *
        smoothstep(-0.26, -0.04, ny) *
        (1 - smoothstep(0.18, 0.38, ny)) *
        smoothstep(-0.25, 0.25, nz);
      const mascara1 =
        Math.exp(-Math.pow((ny - (0.04 - (absX - 0.35) * 0.24) + warp * 0.04) / 0.042, 2)) *
        cheekZone;
      const mascara2 =
        Math.exp(-Math.pow((ny - (-0.095 - (absX - 0.35) * 0.16) + warp * 0.04) / 0.044, 2)) *
        cheekZone;

      // Distinct dark espresso lower cheek trim bordering the snowy white throat/ruff (clearly visible in Photo 2!)
      const cheekBottomRim =
        Math.exp(-Math.pow((ny + 0.23 + warp * 0.04) / 0.055, 2)) *
        smoothstep(0.26, 0.54, absX) *
        smoothstep(-0.2, 0.45, nz);

      // Lighter warm sandy-buff cheek fur between the mascara stripes
      const warmCheekLift =
        cheekZone * (1 - Math.max(mascara1, mascara2) * 0.9) * 0.24;

      // Rich dark mottled tabby cap behind crown & back of skull
      const backMottle =
        smoothstep(0.24, 0.72, fbm3(nx * 8.2 + 1.3, ny * 6.5, nz * 8.2 - 0.7)) *
        smoothstep(0.25, -0.4, nz);
      const crownDark = smoothstep(0.48, 0.85, ny) * 0.34;

      const stripeDarkness = clamp(
        0.24 -
          warmCheekLift +
          foreheadFineStripe * 0.62 +
          centerBrowLine * 0.55 +
          mascara1 * 0.74 +
          mascara2 * 0.7 +
          cheekBottomRim * 0.62 +
          backMottle * 0.56 +
          crownDark,
        0.06,
        0.96,
      );

      // Subtle pale creamy-buff tabby "spectacle" highlight framing outer edge of eyes
      const eyeSpectacle =
        Math.exp(-Math.pow((absX - 0.36) / 0.11, 2)) *
        Math.exp(-Math.pow((ny - 0.05) / 0.09, 2)) *
        smoothstep(0.68, 0.92, nz) *
        (1 - whiteMask);

      // Natural dusty-pinkish skin glow right on the lower white nose bridge above the dark nose
      const noseBridgeGlow =
        Math.exp(-Math.pow(nx / 0.09, 2)) *
        Math.exp(-Math.pow((ny + 0.06) / 0.08, 2)) *
        smoothstep(0.84, 0.96, nz);

      const gingerWave = Math.sin(ny * 18 + nx * 6 + warp * 2.2);
      const extraRgb = noseBridgeGlow > eyeSpectacle * 0.5 ? noseDustyPink : paleEyeRim;
      const extraWeight = Math.max(noseBridgeGlow * 0.36, eyeSpectacle * 0.24);

      const idx = (py * width + px) * 4;
      writeTabicoPixel(
        data,
        idx,
        c,
        gingerW,
        tabbyW,
        stripeDarkness,
        strandVal,
        tickVal,
        gingerWave,
        1.0,
        extraRgb,
        extraWeight,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Hair-strand painted snowy-white whisker pads carrying the user's cat's signature
 * asymmetric mustache smudges and delicate subtle whisker-follicle dots.
 */
export function createWhiskerPadTexture(
  palette: CalicoCoatPalette,
  side: 'left' | 'right',
): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const c = parseCoatPalette(palette);
  const follicleRgb = hexToRgb('#948678');

  for (let py = 0; py < height; py++) {
    const theta = ((py + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const ny = Math.cos(theta);

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const nz = Math.sin(phi) * sinT;

      const strandVal = valueNoise3(nx * 24, ny * 60, nz * 24);
      const tickVal = valueNoise3(nx * 88 + 1.2, ny * 54, nz * 88 - 1.5);
      const edgeN =
        (fbm3(nx * 5.8 + 1.4, ny * 5.8, nz * 5.8 - 0.9) - 0.5) * 0.2 +
        (strandVal - 0.5) * 0.08;

      let tabbyW = 0;
      let stripeDark = 0.6;

      if (side === 'left') {
        // Cat's left whisker pad (+X, viewer's right): crisp elongated dark espresso-brown smudge beside the nose
        const dSmudge = Math.hypot((nx + 0.24) * 0.8, (ny - 0.06) * 1.18, (nz - 0.80) * 1.0);
        tabbyW = smoothstep(0.0, 0.14, 0.54 - dSmudge + edgeN);
        stripeDark = 0.78;
      } else {
        // Cat's right whisker pad (-X, viewer's left): softer warm sandy-brown/taupe smudge curving under nose
        const dSmudge = Math.hypot((nx - 0.28) * 0.95, (ny + 0.04) * 1.22, (nz - 0.80) * 1.0);
        tabbyW = smoothstep(0.0, 0.16, 0.48 - dSmudge + edgeN) * 0.88;
        stripeDark = 0.34;
      }

      // Subtle realistic whisker-follicle shadow dots along the outer cheek pad
      let follicle = 0;
      if (nz > 0.5) {
        const s = side === 'left' ? 1 : -1;
        for (let row = -1; row <= 1; row++) {
          for (let col = 0; col <= 1; col++) {
            const fx = s * (0.22 + col * 0.22);
            const fy = row * 0.22 - 0.05;
            const d = Math.hypot(nx - fx, ny - fy);
            follicle = Math.max(follicle, 1 - smoothstep(0.035, 0.085, d));
          }
        }
      }

      const idx = (py * width + px) * 4;
      writeTabicoPixel(
        data,
        idx,
        c,
        0,
        tabbyW,
        stripeDark,
        strandVal,
        tickVal,
        0,
        1.0,
        follicleRgb,
        follicle * 0.2 * (1 - tabbyW),
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * High-resolution (1024x512) realistic hair-strand Tabico torso texture matched directly to Photo 2:
 * Moving front-to-back along the cat's left flank (+X, viewer's right):
 * 1. Bright plush snowy-white chest bib, neck ruff & lower belly trim (with tiny neck-edge ginger fleck)
 * 2. Rich golden-olive ticked brown-tabby front shoulder with 3 curved black mackerel tiger stripes
 *    + signature diagonal dark tabby drop dipping down into the white lower chest
 * 3. Bold vibrant golden-apricot / warm ginger vertical mid-flank sash sweeping top-to-bottom!
 * 4. Deep marbled black & golden-brown mackerel tabby mid-loin saddle & dorsal spine ridge
 * 5. Broad rich warm ginger-apricot rear thigh/rump patch above the crisp white lower haunch trim
 */
export function createTorsoCalicoTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const width = 1024;
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
    const ny = v * 2 - 1; // [-1 bottom, +1 top]

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = Math.sin(phi);
      const nz = Math.cos(phi);

      // Plush downward-and-backward hair strands + fine salt-and-pepper agouti ticking
      const strandVal = valueNoise3(nx * 92, ny * 22 + nz * 12, nz * 92);
      const tickVal = valueNoise3(nx * 145 + 4.1, ny * 54 - 2.7, nz * 145 + 1.3);

      const macroNoise = (fbm3(nx * 4.5 + 4.2, ny * 4.5 + 1.5, nz * 4.5 - 2.3) - 0.5) * 0.22;
      const hairFeather = (strandVal - 0.5) * 0.085 + (tickVal - 0.5) * 0.032;
      const n = macroNoise + hairFeather;

      // 1. Bright snowy-white chest bib (+Z), lower belly, and rear white lower-haunch trim
      const chestBib = smoothstep(0.30, 0.56, nz + n * 0.34) * smoothstep(-0.96, -0.62, ny);
      const lowerBellyWhite =
        smoothstep(-0.44, -0.76, ny + n * 0.36) * smoothstep(-0.72, 0.45, nz + Math.abs(nx) * 0.52);

      // Signature diagonal dark tabby thumbprint/drop dipping down into the white lower left chest (Photo 2!)
      const dShoulderDrop = Math.hypot((nx - 0.64) * 1.45, (ny + 0.46) * 1.3, (nz - 0.58) * 1.35);
      const shoulderDropMask = smoothstep(0.0, 0.11, 0.34 - dShoulderDrop + n * 0.6);

      const whiteMask = clamp(Math.max(chestBib, lowerBellyWhite * 0.94) - shoulderDropMask * 0.88, 0, 1);

      // 2. Signature vibrant golden-apricot GINGER patches (directly from Photo 2!):
      // (a) Bold vertical warm ginger mid-flank sash sweeping top-to-bottom on +X around nz ≈ -0.06
      const sashCenterZ = -0.06 + ny * 0.16;
      const leftGingerSash =
        smoothstep(0.28, 0.62, nx) *
        smoothstep(0.30, 0.06, Math.abs(nz - sashCenterZ) - n * 0.42) *
        smoothstep(-0.82, -0.42, ny + n * 0.3);

      // (b) Broad warm ginger rear thigh / rump sweep on +X lower-rear (behind the dark tabby loin!)
      const dGingerLeftRump = Math.hypot((nx - 0.58) * 0.85, (ny + 0.22) * 0.88, (nz + 0.72) * 0.82);
      const leftGingerRump = smoothstep(0.0, 0.14, 0.58 - dGingerLeftRump + n * 0.85);

      // (c) Tiny warm ginger neck fleck peeking right behind the left jaw on the upper white edge (Photo 2!)
      const dNeckFleck = Math.hypot((nx - 0.56) * 1.9, (ny - 0.52) * 1.6, (nz - 0.58) * 1.7);
      const neckGingerFleck = smoothstep(0.0, 0.1, 0.30 - dNeckFleck + n * 0.55);

      // (d) Balanced harmonious warm ginger mid-flank sash on the opposite flank (-X) for rich 360° orbit
      const rightSashCenterZ = -0.22 + ny * 0.12;
      const rightGingerSash =
        smoothstep(-0.34, -0.68, nx) *
        smoothstep(0.28, 0.06, Math.abs(nz - rightSashCenterZ) - n * 0.42) *
        smoothstep(-0.76, -0.36, ny + n * 0.3) *
        0.92;

      const gingerW = clamp(
        Math.max(leftGingerSash, leftGingerRump, neckGingerFleck, rightGingerSash) * (1 - whiteMask),
        0,
        1,
      );

      // 3. Rich dark brown-black mackerel tabby covers front shoulders, upper dorsal spine, and mid-loin saddle!
      const tabbyW = clamp((1 - whiteMask) * (1 - gingerW * 0.9), 0, 1);

      // 4. Authentic sweeping curved black mackerel tabby tiger stripes + dark dorsal spine ridge
      const warp = (fbm3(nx * 5.6, ny * 4.8, nz * 5.6) - 0.5) * 1.15;
      // Curved vertical-diagonal mackerel stripes running down from the spine across shoulders & loin
      const stripeCoord = nz * 15.5 - ny * 4.8 + Math.abs(nx) * 2.2 + warp * 2.6;
      const primaryStripes = smoothstep(0.08, 0.76, Math.sin(stripeCoord));
      // Secondary finer tabby broken-rib marbling
      const brokenMarbling = smoothstep(0.32, 0.78, fbm3(nx * 8.6 + 1.2, ny * 7.2, nz * 8.6 - 0.9));
      // Deep black-brown dorsal spine ridge along the top-back (-Z)
      const dorsalSpine = smoothstep(-0.28, -0.88, nz) * smoothstep(-0.32, 0.62, ny);
      // Darker shoulder-drop tip accent
      const dropAccent = shoulderDropMask * 0.48;

      const stripeDarkness = clamp(
        0.24 + primaryStripes * 0.58 + brokenMarbling * 0.24 + dorsalSpine * 0.44 + dropAccent,
        0.16,
        0.97,
      );

      // Subtle warm cinnamon mackerel ripples inside the golden-ginger sash & rump
      const gingerWave = Math.sin(nz * 15.0 - ny * 5.5 + warp * 2.4);

      const baseOcclusion = smoothstep(0.0, 0.16, v);
      const ao = 0.85 + 0.15 * baseOcclusion;

      const idx = (py * width + px) * 4;
      writeTabicoPixel(
        data,
        idx,
        c,
        gingerW,
        tabbyW,
        stripeDarkness,
        strandVal,
        tickVal,
        gingerWave,
        ao,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates high-detail hair-strand fur textures for limbs, ears, and tucked haunches.
 */
export function createSolidFurTexture(
  palette: CalicoCoatPalette,
  tone: 'cream' | 'tabbyEar' | 'leftHaunchTabico' | 'rightHaunchTabico',
): THREE.CanvasTexture {
  const size = 512;
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

      const strandVal = valueNoise3(nx * 64, ny * 18, nz * 64);
      const tickVal = valueNoise3(nx * 110 + 2.1, ny * 48, nz * 110 - 1.4);
      const n =
        (fbm3(nx * 4.2 + 1.1, ny * 4.2, nz * 4.2 - 0.8) - 0.5) * 0.22 +
        (strandVal - 0.5) * 0.085;

      let gingerW = 0;
      let tabbyW = 0;
      let stripeDark = 0.5;
      const gingerWave = Math.sin(v * 18 + nx * 5 + n * 4);

      if (tone === 'tabbyEar') {
        // Warm tawny-cinnamon ear backs bordered by darker charcoal-brown outer rims & tips (Photo 2!)
        tabbyW = 1.0;
        gingerW = smoothstep(0.75, 0.14, v + n * 0.32) * 0.42;
        const rimDark = smoothstep(0.58, 0.94, v) * 0.45 + smoothstep(0.45, 0.92, Math.abs(nx)) * 0.35;
        stripeDark = clamp(0.32 + rimDark, 0.22, 0.95);
      } else if (tone === 'leftHaunchTabico') {
        // Photo 2 hallmark: vibrant golden-ginger upper thigh sweeping cleanly into bright snowy-white lower haunch!
        const whiteTrim = 1 - smoothstep(0.30, 0.46, v + n * 0.46);
        const upperLoinTabby = smoothstep(0.68, 0.92, v + n * 0.42);
        gingerW = (1 - whiteTrim) * (1 - upperLoinTabby * 0.75);
        tabbyW = (1 - whiteTrim) * upperLoinTabby * 0.82;
        const stripe = smoothstep(0.05, 0.72, Math.sin(v * 18 + nx * 6 + n * 3.2));
        stripeDark = 0.32 + stripe * 0.58;
      } else if (tone === 'rightHaunchTabico') {
        // Warm brown-black ticked mackerel tabby upper thigh + golden-ginger band over snowy-white lower trim
        const whiteTrim = 1 - smoothstep(0.30, 0.46, v + n * 0.46);
        const gingerBand = smoothstep(0.38, 0.58, v + n * 0.35) * (1 - smoothstep(0.64, 0.84, v));
        gingerW = (1 - whiteTrim) * gingerBand * 0.78;
        tabbyW = (1 - whiteTrim) * (1 - gingerBand * 0.65);
        const stripe = smoothstep(0.02, 0.7, Math.sin(v * 19 + nx * 6 + n * 3.5));
        stripeDark = 0.28 + stripe * 0.62;
      }

      const idx = (py * size + px) * 4;
      writeTabicoPixel(
        data,
        idx,
        c,
        gingerW,
        tabbyW,
        stripeDark,
        strandVal,
        tickVal,
        gingerWave,
        1.0,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates a high-detail hair-strand ringed Tabico tail texture matching Photo 2:
 * rich ticked brown-black agouti tail with crisp dark charcoal rings, warm russet highlights,
 * and a dark espresso tail tip.
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

      const strandVal = valueNoise3(nx * 54, v * 28, nz * 54);
      const tickVal = valueNoise3(nx * 96 + 1.7, v * 62, nz * 96 - 1.3);
      const edgeNoise = (fbm3(nx * 2.8 + 3.1, v * 5.2, nz * 2.8 - 1.7) - 0.5) * 0.14;
      const vt = v + edgeNoise + (strandVal - 0.5) * 0.05;

      // Subtle warm russet-ginger marbling on lower-mid tail, ringed dark brown-black tabby throughout
      const gingerIn = smoothstep(0.14, 0.26, vt);
      const gingerOut = 1 - smoothstep(0.42, 0.56, vt);
      const gingerW = gingerIn * gingerOut * 0.48;
      const tabbyW = clamp(1 - gingerW * 0.55, 0.45, 1);

      // Crisp domestic-tabby tail rings + dark espresso tip
      const ringWave = Math.sin(v * 38.0 + edgeNoise * 4.5);
      const ringDark = smoothstep(0.0, 0.68, ringWave);
      const tipDark = smoothstep(0.76, 0.92, v);
      const stripeDark = clamp(0.26 + ringDark * 0.62 + tipDark * 0.56, 0.2, 0.97);

      const idx = (py * width + px) * 4;
      writeTabicoPixel(
        data,
        idx,
        c,
        gingerW,
        tabbyW,
        stripeDark,
        strandVal,
        tickVal,
        ringWave,
        1.0,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates a high-resolution tileable directional hair-strand bump map for tactile plush fur light scattering.
 */
export function createFurBumpTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let py = 0; py < size; py++) {
    const phiY = (py / size) * Math.PI * 2;
    const cy = Math.cos(phiY);
    const sy = Math.sin(phiY);

    for (let px = 0; px < size; px++) {
      const phiX = (px / size) * Math.PI * 2;
      const cx = Math.cos(phiX);
      const sx = Math.sin(phiX);

      // High-frequency horizontal x stretched vertical toroidal noise => realistic fine hair ridges
      const coarse = valueNoise3(cx * 14, cy * 4.2 + sy * 1.1, sx * 14);
      const fine = valueNoise3(cx * 36 + 2.3, cy * 9.5, sx * 36 - 1.7);
      const micro = valueNoise3(cx * 72 - 1.1, sy * 22.0, sx * 72 + 3.2);
      const h = coarse * 0.42 + fine * 0.38 + micro * 0.2;
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
  tex.repeat.set(3, 2);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a tileable alpha mask of fine hair-tip tufts used by subtle extruded fur-shell
 * layers so the silhouette of the cat's head, back, and flanks has a soft fuzzy realistic halo.
 */
export function createFurShellAlphaTexture(threshold = 0.56): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let py = 0; py < size; py++) {
    const phiY = (py / size) * Math.PI * 2;
    const cy = Math.cos(phiY);
    const sy = Math.sin(phiY);

    for (let px = 0; px < size; px++) {
      const phiX = (px / size) * Math.PI * 2;
      const cx = Math.cos(phiX);
      const sx = Math.sin(phiX);

      // Dense fine hair-strand tips
      const n1 = valueNoise3(cx * 28, cy * 9.0 + sy * 2.5, sx * 28);
      const n2 = valueNoise3(cx * 56 + 4.1, cy * 18.0, sx * 56 - 2.3);
      const tuft = n1 * 0.58 + n2 * 0.42;
      const alpha = smoothstep(threshold, threshold + 0.24, tuft);
      const val = clamp(Math.round(alpha * 255), 0, 255);

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
  tex.repeat.set(5, 3);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates realistic luminous pale celadon / sage-olive green cat eyes matching the user's cat:
 * intricate radial iris fibers, warm inner golden-green glow, bold black eyeliner limbal border,
 * slightly vertical feline pupil, and crisp natural corneal catchlights.
 */
export function createCatEyeTexture(palette: CalicoCoatPalette): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  const outerRgb = hexToRgb(palette.eyeOuter);
  const innerRgb = hexToRgb(palette.eyeInner);
  const limbalRgb: Rgb = { r: 15, g: 17, b: 16 };
  const pupilRgb: Rgb = { r: 8, g: 9, b: 12 };
  const scleraRgb: Rgb = { r: 224, g: 222, b: 214 };
  const whiteRgb: Rgb = { r: 255, g: 255, b: 255 };

  for (let py = 0; py < height; py++) {
    const theta = ((py + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const ny = Math.cos(theta);

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const nz = Math.sin(phi) * sinT;

      let r = scleraRgb.r;
      let g = scleraRgb.g;
      let b = scleraRgb.b;

      if (nz > 0.15) {
        const rad = Math.hypot(nx, ny);
        const angle = Math.atan2(ny, nx);

        const irisRadius = 0.80;
        if (rad < irisRadius) {
          const t = rad / irisRadius;
          // Intricate radial feline iris stroma fibers
          const fiber =
            Math.sin(angle * 34) * 0.045 +
            Math.cos(angle * 57 + rad * 9) * 0.035 +
            (valueNoise3(Math.cos(angle) * 8, Math.sin(angle) * 8, rad * 10) - 0.5) * 0.14;
          const gradT = clamp(Math.pow(t, 0.82) + fiber, 0, 1);

          r = innerRgb.r + (outerRgb.r - innerRgb.r) * gradT;
          g = innerRgb.g + (outerRgb.g - innerRgb.g) * gradT;
          b = innerRgb.b + (outerRgb.b - innerRgb.b) * gradT;

          // Upper eyelid cast shadow across top third of iris for authentic feline depth
          const topShade = smoothstep(0.10, 0.56, ny);
          r += (limbalRgb.r - r) * topShade * 0.44;
          g += (limbalRgb.g - g) * topShade * 0.44;
          b += (limbalRgb.b - b) * topShade * 0.44;

          // Luminous translucent lower celadon light-bounce
          const lowerGlow = smoothstep(-0.08, -0.52, ny) * (1 - t * 0.52);
          r += (226 - r) * lowerGlow * 0.36;
          g += (236 - g) * lowerGlow * 0.36;
          b += (182 - b) * lowerGlow * 0.36;

          // Crisp dark eyeliner limbal ring
          const limbal = smoothstep(0.73, 0.94, t);
          r += (limbalRgb.r - r) * limbal * 0.94;
          g += (limbalRgb.g - g) * limbal * 0.94;
          b += (limbalRgb.b - b) * limbal * 0.94;

          // Sleek slightly-almond feline pupil
          const pupilDist = Math.hypot(nx * 1.24, ny * 0.94);
          const pupilMask = 1 - smoothstep(0.39, 0.45, pupilDist);
          r += (pupilRgb.r - r) * pupilMask;
          g += (pupilRgb.g - g) * pupilMask;
          b += (pupilRgb.b - b) * pupilMask;

          // Soft primary upper-left window catchlight
          const sp1 = 1 - smoothstep(0.10, 0.17, Math.hypot((nx + 0.22) * 0.92, (ny - 0.23) * 1.08));
          r += (whiteRgb.r - r) * sp1 * 0.95;
          g += (whiteRgb.g - g) * sp1 * 0.95;
          b += (whiteRgb.b - b) * sp1 * 0.95;

          // Subtle secondary lower-right specular dot
          const sp2 = 1 - smoothstep(0.045, 0.08, Math.hypot(nx - 0.19, ny + 0.21));
          r += (whiteRgb.r - r) * sp2 * 0.78;
          g += (whiteRgb.g - g) * sp2 * 0.78;
          b += (whiteRgb.b - b) * sp2 * 0.78;
        } else {
          const edgeBlend = smoothstep(irisRadius, irisRadius + 0.1, rad);
          r = limbalRgb.r + (scleraRgb.r - limbalRgb.r) * edgeBlend;
          g = limbalRgb.g + (scleraRgb.g - limbalRgb.g) * edgeBlend;
          b = limbalRgb.b + (scleraRgb.b - limbalRgb.b) * edgeBlend;
        }
      }

      const idx = (py * width + px) * 4;
      data[idx] = clamp(Math.round(r), 0, 255);
      data[idx + 1] = clamp(Math.round(g), 0, 255);
      data[idx + 2] = clamp(Math.round(b), 0, 255);
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

      const idx = (y * size + x) * 4;
      data[idx] = clamp(Math.round(base.r + (accent.r - base.r) * t), 0, 255);
      data[idx + 1] = clamp(Math.round(base.g + (accent.g - base.g) * t), 0, 255);
      data[idx + 2] = clamp(Math.round(base.b + (accent.b - base.b) * t), 0, 255);
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

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
    agoutiBuff: {
      r: Math.round(agoutiTaupe.r * 0.55 + creamShadow.r * 0.45),
      g: Math.round(agoutiTaupe.g * 0.55 + creamShadow.g * 0.45),
      b: Math.round(agoutiTaupe.b * 0.55 + creamShadow.b * 0.45),
    },
  };
}

/**
 * Writes realistic ticked-agouti & directional hair-strand shaded tabico fur into ImageData.
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
  const hairMod = (strandVal - 0.5) * 0.58 + (tickVal - 0.5) * 0.42;

  // 1. Plush warm snowy-white fur with subtle fine strand depth
  const creamMix = clamp(0.16 + hairMod * 0.38, 0, 1);
  let r = c.cream.r + (c.creamShadow.r - c.cream.r) * creamMix;
  let g = c.cream.g + (c.creamShadow.g - c.cream.g) * creamMix;
  let b = c.cream.b + (c.creamShadow.b - c.cream.b) * creamMix;

  // 2. Warm golden-apricot / russet ginger with subtle cinnamon mackerel ripples & bright hair tips
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

  // 3. Domestic shorthair brown-black mackerel tabby: salt-and-pepper ticked agouti + crisp dark espresso stripes
  if (tabbyWeight > 0.001) {
    const buffHighlight = smoothstep(0.54, 0.88, tickVal * 0.65 + strandVal * 0.35);
    const rootDark = smoothstep(0.46, 0.12, strandVal);

    let ar = c.agoutiTaupe.r + (c.agoutiBuff.r - c.agoutiTaupe.r) * buffHighlight * 0.8;
    let ag = c.agoutiTaupe.g + (c.agoutiBuff.g - c.agoutiTaupe.g) * buffHighlight * 0.8;
    let ab = c.agoutiTaupe.b + (c.agoutiBuff.b - c.agoutiTaupe.b) * buffHighlight * 0.8;

    ar += (c.charcoal.r - ar) * rootDark * 0.58;
    ag += (c.charcoal.g - ag) * rootDark * 0.58;
    ab += (c.charcoal.b - ab) * rootDark * 0.58;

    const darkHairSheen = clamp(0.16 + strandVal * 0.42, 0, 1);
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
 * Unified 1024x512 realistic Tabico head + integrated muzzle coat texture modeled across all 3 photos:
 * - Radially flowing fine facial hair strands + ticked agouti hairs
 * - Crisp narrow snowy-white nose blaze, integrated white muzzle/chin & dusty-pink nose bridge
 * - Signature asymmetric espresso-brown (+X) & warm taupe (-X) mustache smudges painted seamlessly
 *   onto the unified sculpted snout, plus subtle whisker-follicle dots
 * - Warm apricot-ginger flame above the cat's left eye (+X) & apricot-ginger crown spot between ears
 * - Multi-tone forehead tabby M-stripes, sandy-buff ticked cheeks with 2 sweeping black mascara lines,
 *   and crisp dark espresso lower-cheek rim bordering the plush white neck ruff
 */
export function createHeadCalicoTexture(
  palette: CalicoCoatPalette,
  width = 1024,
  height = 512,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const c = parseCoatPalette(palette);
  const noseDustyPink = hexToRgb('#d8bec0');
  const paleEyeRim = hexToRgb('#e6dbc8');
  const follicleRgb = hexToRgb('#8a7a69');

  for (let py = 0; py < height; py++) {
    const theta = ((py + 0.5) / height) * Math.PI;
    const sinT = Math.sin(theta);
    const ny = Math.cos(theta);

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = -Math.cos(phi) * sinT;
      const nz = Math.sin(phi) * sinT;

      // Biological radial facial fur flow radiating outward & backward from nose bridge
      const faceRad = Math.hypot(nx, ny + 0.14);
      const faceAng = Math.atan2(ny + 0.14, nx);
      const ux = Math.cos(faceAng);
      const uy = Math.sin(faceAng);

      const strandFront = valueNoise3(ux * 38 + nx * 18, uy * 38 + ny * 18, faceRad * 14 + nz * 12);
      const strandBack = valueNoise3(nx * 72, ny * 26, nz * 72);
      const frontBlend = smoothstep(-0.15, 0.45, nz);
      const strandVal = strandBack + (strandFront - strandBack) * frontBlend;
      const tickVal = valueNoise3(nx * 124 + 3.4, ny * 68 - 1.9, nz * 124 + 2.2);

      const macroNoise = (fbm3(nx * 5.2 + 2.1, ny * 5.2 - 1.3, nz * 5.2 + 0.7) - 0.5) * 0.2;
      const hairFeather = (strandVal - 0.5) * 0.085 + (tickVal - 0.5) * 0.032;
      const n = macroNoise + hairFeather;

      // 1. Crisp snowy-white muzzle, chin & narrow nose blaze rising between the eyes
      const blazeCenterX = 0.01 - Math.max(0, ny) * 0.024;
      const blazeHalfWidth =
        ny < -0.18
          ? 0.42
          : 0.132 * (1 - smoothstep(-0.1, 0.48, ny)) + 0.022;
      const distFromBlaze = Math.abs(nx - blazeCenterX);
      const whiteBlazeMask =
        smoothstep(0.32, 0.56, nz + n * 0.2) *
        smoothstep(blazeHalfWidth + 0.052, blazeHalfWidth - 0.022, distFromBlaze - n * 0.24) *
        smoothstep(0.52, 0.26, ny - n * 0.26);

      const whiteChinMask =
        smoothstep(-0.28, -0.48, ny - n * 0.26) * smoothstep(-0.18, 0.28, nz + n * 0.24);
      const rawWhiteMask = Math.max(whiteBlazeMask, whiteChinMask);

      // 2. Signature asymmetric mustache smudges painted directly onto the unified snout (Photos 1, 2 & 3!)
      //    Left (+X, viewer's right): crisp dark espresso-brown horizontal-teardrop smudge right beside the nose
      const dLeftMustache = Math.hypot((nx - 0.145) * 0.78, (ny + 0.255) * 1.18, (nz - 0.945) * 1.1);
      const leftMustache = smoothstep(0.0, 0.055, 0.115 - dLeftMustache + n * 0.16);
      //    Right (-X, viewer's left): slightly smaller warm sandy-brown/taupe smudge curving neatly under nose
      const dRightMustache = Math.hypot((nx + 0.125) * 0.88, (ny + 0.275) * 1.25, (nz - 0.945) * 1.1);
      const rightMustache = smoothstep(0.0, 0.055, 0.095 - dRightMustache + n * 0.16) * 0.88;
      const mustacheMask = Math.max(leftMustache, rightMustache);

      // Preserve snowy white blaze & chin except where the iconic mustache smudges sit
      const whiteMask = clamp(rawWhiteMask * (1 - mustacheMask), 0, 1);

      // 3. Rich warm orange-ginger facial markings modeled directly after Candy's front closeup (Photo 5!):
      // (a) Broad, tall vibrant apricot-orange patch sweeping from above the left eye (+X)
      //     up along the white blaze and curving across the upper left eyelid & brow!
      const dGingerLeftMain = Math.hypot((nx - 0.24) * 1.48, (ny - 0.21) * 1.12, (nz - 0.84) * 1.18);
      const dGingerLeftOuterLid = Math.hypot((nx - 0.42) * 1.55, (ny - 0.14) * 1.65, (nz - 0.76) * 1.25);
      // (b) Prominent warm bright apricot-orange crown band visible right between the ears from the front!
      const dGingerCrownBand = Math.hypot((nx + 0.08) * 0.92, (ny - 0.78) * 1.18, (nz - 0.36) * 0.92);
      // (c) Warm orange-amber inner-brow highlight hugging the right side (-X) of the white blaze
      const dGingerRightInnerBrow = Math.hypot((nx + 0.18) * 1.95, (ny - 0.12) * 1.55, (nz - 0.88) * 1.2);
      // (d) Soft warm golden-orange warmth woven into the cheeks beneath both eyes & behind the ears
      const dGingerLeftCheekWarm = Math.hypot((nx - 0.46) * 1.35, (ny + 0.07) * 1.65, (nz - 0.74) * 1.25);
      const dGingerRightCheekWarm = Math.hypot((nx + 0.44) * 1.45, (ny + 0.09) * 1.7, (nz - 0.74) * 1.25);
      const dGingerEarTrail = Math.hypot((nx - 0.40) * 1.25, (ny - 0.38) * 1.0, (nz + 0.46) * 1.08);

      const gingerPrimaryField =
        Math.max(
          0.46 - dGingerLeftMain,
          0.35 - dGingerLeftOuterLid,
          0.52 - dGingerCrownBand,
          0.39 - dGingerEarTrail,
        ) +
        macroNoise * 0.72 +
        hairFeather * 1.12;

      const gingerSecondaryField =
        Math.max(
          0.31 - dGingerRightInnerBrow,
          0.36 - dGingerLeftCheekWarm,
          0.33 - dGingerRightCheekWarm,
        ) +
        macroNoise * 0.65 +
        hairFeather * 1.0;

      const primaryGingerW = smoothstep(0.0, 0.10, gingerPrimaryField) * (1 - rawWhiteMask);
      const secondaryGingerW = smoothstep(0.0, 0.14, gingerSecondaryField) * 0.62 * (1 - rawWhiteMask);
      const gingerW = clamp(Math.max(primaryGingerW, secondaryGingerW), 0, 1);

      const tabbyBaseField = Math.max(1.0 - rawWhiteMask * 1.14, mustacheMask);
      // Keep primary orange patches vibrant & pure; allow delicate tabby mascara/brow stripes to weave over warm cheek glows
      const tabbyW = clamp(
        smoothstep(0.04, 0.2, tabbyBaseField) * (1 - primaryGingerW * 0.92) * (1 - secondaryGingerW * 0.45),
        0,
        1,
      );

      // 4. Authentic domestic-shorthair tabby facial markings
      const warp = (fbm3(nx * 6.8, ny * 6.8, nz * 6.8) - 0.5) * 0.92;

      // Multi-line vertical forehead M-stripes sweeping from brow up over the crown
      const foreheadZone =
        smoothstep(0.12, 0.40, ny) * smoothstep(-0.15, 0.45, nz) * smoothstep(0.68, 0.20, Math.abs(nx));
      const mLinePhase = nx * 35.0 + Math.sin(ny * 7.5) * 0.65 + warp * 1.8;
      const foreheadFineStripe = smoothstep(0.26, 0.82, Math.cos(mLinePhase)) * foreheadZone;
      const centerBrowLine =
        Math.exp(-Math.pow((nx + 0.075) / 0.052, 2)) *
        smoothstep(0.14, 0.36, ny) *
        smoothstep(0.45, 0.85, nz);

      // Sweeping dark charcoal-black mascara cheek stripes radiating from outer eye corners
      const absX = Math.abs(nx);
      const cheekZone =
        smoothstep(0.24, 0.46, absX) *
        smoothstep(-0.30, -0.06, ny) *
        (1 - smoothstep(0.16, 0.36, ny)) *
        smoothstep(-0.25, 0.25, nz);
      const mascara1 =
        Math.exp(-Math.pow((ny - (0.02 - (absX - 0.35) * 0.22) + warp * 0.04) / 0.04, 2)) *
        cheekZone;
      const mascara2 =
        Math.exp(-Math.pow((ny - (-0.115 - (absX - 0.35) * 0.16) + warp * 0.04) / 0.042, 2)) *
        cheekZone;

      // Crisp dark espresso lower cheek trim meeting the snowy white neck ruff (Photos 2, 3 & 5!)
      const cheekBottomRim =
        Math.exp(-Math.pow((ny + 0.25 + warp * 0.04) / 0.055, 2)) *
        smoothstep(0.26, 0.54, absX) *
        smoothstep(-0.2, 0.45, nz);

      const warmCheekLift = cheekZone * (1 - Math.max(mascara1, mascara2) * 0.9) * 0.26;

      const backMottle =
        smoothstep(0.24, 0.72, fbm3(nx * 8.2 + 1.3, ny * 6.5, nz * 8.2 - 0.7)) *
        smoothstep(0.25, -0.4, nz);
      const crownDark = smoothstep(0.48, 0.85, ny) * 0.30;

      // Left smudge (+X, viewer's right) dark espresso; right smudge (-X, viewer's left) warm golden-ginger tan (Photo 5!)
      const mustacheDarkness = leftMustache > rightMustache ? 0.74 : 0.22;
      const rightMustacheGinger = rightMustache > leftMustache ? rightMustache * 0.65 : 0;
      const finalGingerW = clamp(Math.max(gingerW, rightMustacheGinger), 0, 1);
      const finalTabbyW = clamp(
        rightMustacheGinger > 0.1 ? tabbyW * (1 - rightMustacheGinger * 0.65) : tabbyW,
        0,
        1,
      );

      let stripeDarkness = clamp(
        0.24 -
          warmCheekLift +
          foreheadFineStripe * 0.64 +
          centerBrowLine * 0.55 +
          mascara1 * 0.76 +
          mascara2 * 0.72 +
          cheekBottomRim * 0.64 +
          backMottle * 0.56 +
          crownDark,
        0.06,
        0.96,
      );
      if (mustacheMask > 0.05) {
        stripeDarkness = stripeDarkness * (1 - mustacheMask) + mustacheDarkness * mustacheMask;
      }

      // Subtle pale creamy-buff tabby eye-rim highlight
      const eyeSpectacle =
        Math.exp(-Math.pow((absX - 0.38) / 0.10, 2)) *
        Math.exp(-Math.pow((ny - 0.03) / 0.085, 2)) *
        smoothstep(0.68, 0.92, nz) *
        (1 - rawWhiteMask);

      // Subtle dusty-pinkish nose bridge tint right above the dark espresso nose
      const noseBridgeGlow =
        Math.exp(-Math.pow(nx / 0.085, 2)) *
        Math.exp(-Math.pow((ny + 0.12) / 0.075, 2)) *
        smoothstep(0.86, 0.97, nz);

      // Delicate subtle whisker-follicle shadow dots on the white muzzle cheeks
      let follicle = 0;
      if (nz > 0.75 && ny < -0.14 && ny > -0.40 && absX > 0.14 && absX < 0.36) {
        for (let r = 0; r < 3; r++) {
          for (let col = 0; col < 2; col++) {
            const fx = 0.21 + col * 0.068;
            const fy = -0.22 - r * 0.048;
            const d = Math.hypot(absX - fx, ny - fy);
            follicle = Math.max(follicle, 1 - smoothstep(0.01, 0.022, d));
          }
        }
      }

      // Subtle mouth-cleft occlusion right below the nose
      const mouthCleft =
        Math.exp(-Math.pow(nx / 0.018, 2)) *
        smoothstep(-0.20, -0.25, ny) *
        smoothstep(-0.36, -0.29, ny) *
        smoothstep(0.85, 0.94, nz);
      const ao = 1.0 - mouthCleft * 0.35;

      const gingerWave = Math.sin(ny * 18 + nx * 6 + warp * 2.2);
      let extraRgb = paleEyeRim;
      let extraWeight = eyeSpectacle * 0.24;
      if (noseBridgeGlow * 0.36 > extraWeight) {
        extraRgb = noseDustyPink;
        extraWeight = noseBridgeGlow * 0.36;
      }
      if (follicle * 0.24 * whiteMask > extraWeight) {
        extraRgb = follicleRgb;
        extraWeight = follicle * 0.24 * whiteMask;
      }

      const idx = (py * width + px) * 4;
      writeTabicoPixel(
        data,
        idx,
        c,
        finalGingerW,
        finalTabbyW,
        stripeDarkness,
        strandVal,
        tickVal,
        gingerWave,
        ao,
        extraRgb,
        extraWeight,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * 3-Photo Accurate 1024x512 realistic Tabico torso texture:
 * - Front (+Z): Plush snowy-white neck collar, deep fluffy chest & lower belly
 * - Right side (-X, viewer's left — Photo 3!): Broad snowy-white neck collar -> dark brown-black tabby
 *   upper shoulder -> vibrant warm golden-ginger right flank -> crisp white lower flank band -> dark charcoal-brown
 *   tabby lower rear hip/thigh!
 * - Left side (+X, viewer's right — Photos 1 & 2!): Tiny ginger neck fleck -> dark ticked tabby front shoulder
 *   with curved black stripes + signature diagonal dark tabby drop into white chest -> vibrant golden-apricot
 *   vertical mid-flank sash -> marbled dark tabby loin & spine -> broad warm ginger rear thigh over snowy-white lower trim!
 */
export function createTorsoCalicoTexture(
  palette: CalicoCoatPalette,
  width = 1024,
  height = 512,
): THREE.CanvasTexture {
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

      // Plush downward-and-backward fur strands + salt-and-pepper agouti ticking
      const strandVal = valueNoise3(nx * 96, ny * 22 + nz * 12, nz * 96);
      const tickVal = valueNoise3(nx * 148 + 4.1, ny * 54 - 2.7, nz * 148 + 1.3);

      const macroNoise = (fbm3(nx * 4.6 + 4.2, ny * 4.6 + 1.5, nz * 4.6 - 2.3) - 0.5) * 0.22;
      const hairFeather = (strandVal - 0.5) * 0.088 + (tickVal - 0.5) * 0.032;
      const n = macroNoise + hairFeather;

      // 1. Plush snowy-white chest bib (+Z), broad white right neck collar (Photo 3!),
      //    and lower belly/haunch white band — scoped strictly to the anatomical front chest
      //    so both the right tabby shoulder/ginger flank (Photo 3) and left tabby/ginger flank (Photo 2) show clearly!
      const chestBib = smoothstep(0.46, 0.72, nz + n * 0.30);
      // Photo 3: snowy-white neck collar sweeping smoothly across upper throat & right neck
      const rightNeckCollar =
        smoothstep(0.46, 0.78, ny + n * 0.28) *
        smoothstep(0.05, -0.52, nx) *
        smoothstep(-0.10, 0.45, nz + n * 0.28);
      // Photo 3: crisp snowy-white lower-flank band on right side (-X) above the dark lower rear hip!
      const rightLowerWhiteBand =
        smoothstep(-0.28, -0.56, ny + n * 0.28) *
        smoothstep(-0.84, -0.58, ny + n * 0.22) *
        smoothstep(-0.20, -0.62, nx) *
        smoothstep(-0.55, 0.65, nz + n * 0.26);
      // Photo 2: crisp snowy-white lower belly / left lower haunch trim (+X)
      const leftLowerWhiteTrim =
        smoothstep(-0.46, -0.78, ny + n * 0.34) *
        smoothstep(-0.05, 0.45, nx) *
        smoothstep(-0.72, 0.45, nz + nx * 0.48);

      // Photo 2: signature diagonal dark tabby shoulder drop dipping into the white lower left chest (+X)
      const dLeftShoulderDrop = Math.hypot((nx - 0.62) * 1.45, (ny + 0.44) * 1.32, (nz - 0.58) * 1.35);
      const leftShoulderDrop = smoothstep(0.0, 0.11, 0.34 - dLeftShoulderDrop + n * 0.6);

      // Photo 3: dark charcoal-brown tabby lower rear right hip/thigh patch tucked at bottom-left (-X, low ny)
      const dRightLowerHip = Math.hypot((nx + 0.78) * 1.12, (ny + 0.72) * 1.28, (nz + 0.12) * 1.05);
      const rightLowerHipTabby = smoothstep(0.0, 0.12, 0.48 - dRightLowerHip + n * 0.65);

      const whiteMask = clamp(
        Math.max(chestBib, rightNeckCollar * 0.96, rightLowerWhiteBand * 0.94, leftLowerWhiteTrim * 0.94) -
          leftShoulderDrop * 0.88 -
          rightLowerHipTabby * 0.95,
        0,
        1,
      );

      // 2. Vibrant golden-apricot GINGER markings (exact across ALL 3 photos!):
      // (a) Left side (+X, Photo 2): bold vertical warm ginger mid-flank sash sweeping top-to-bottom
      const leftSashZ = -0.06 + ny * 0.16;
      const leftGingerSash =
        smoothstep(0.28, 0.62, nx) *
        smoothstep(0.30, 0.06, Math.abs(nz - leftSashZ) - n * 0.42) *
        smoothstep(-0.82, -0.40, ny + n * 0.3);

      // (b) Left side (+X, Photos 1 & 2): broad warm ginger rear thigh / rump sweep
      const dLeftGingerRump = Math.hypot((nx - 0.58) * 0.84, (ny + 0.20) * 0.88, (nz + 0.70) * 0.82);
      const leftGingerRump = smoothstep(0.0, 0.14, 0.58 - dLeftGingerRump + n * 0.85);

      // (c) Left neck edge (+X, Photo 2): tiny subtle warm ginger fleck on white neck border
      const dNeckFleck = Math.hypot((nx - 0.56) * 1.9, (ny - 0.50) * 1.6, (nz - 0.58) * 1.7);
      const neckGingerFleck = smoothstep(0.0, 0.1, 0.28 - dNeckFleck + n * 0.55);

      // (d) Right side (-X, Photo 3!): rich warm golden-amber mid-flank sweeping visibly right behind the dark shoulder!
      const dRightGingerFlank = Math.hypot((nx + 0.86) * 0.82, (ny + 0.02) * 0.86, (nz + 0.14) * 0.86);
      const rightGingerFlank =
        smoothstep(0.0, 0.14, 0.68 - dRightGingerFlank + n * 0.82) *
        smoothstep(-0.56, -0.22, ny + n * 0.25);

      const gingerW = clamp(
        Math.max(leftGingerSash, leftGingerRump, neckGingerFleck, rightGingerFlank) *
          (1 - whiteMask) *
          (1 - rightLowerHipTabby * 0.9),
        0,
        1,
      );

      // 3. Rich dark brown-black mackerel tabby covers shoulders, dorsal spine, mid-loin, and Photo 3's right lower hip!
      const tabbyW = clamp((1 - whiteMask) * (1 - gingerW * 0.9), 0, 1);

      // 4. Sweeping curved black mackerel tabby tiger stripes + dark dorsal spine ridge
      const warp = (fbm3(nx * 5.6, ny * 4.8, nz * 5.6) - 0.5) * 1.15;
      const stripeCoord = nz * 15.5 - ny * 4.8 + Math.abs(nx) * 2.2 + warp * 2.6;
      const primaryStripes = smoothstep(0.08, 0.76, Math.sin(stripeCoord));
      const brokenMarbling = smoothstep(0.32, 0.78, fbm3(nx * 8.6 + 1.2, ny * 7.2, nz * 8.6 - 0.9));
      const dorsalSpine = smoothstep(-0.28, -0.88, nz) * smoothstep(-0.32, 0.62, ny);

      const stripeDarkness = clamp(
        0.24 +
          primaryStripes * 0.58 +
          brokenMarbling * 0.24 +
          dorsalSpine * 0.44 +
          leftShoulderDrop * 0.48 +
          rightLowerHipTabby * 0.42,
        0.16,
        0.97,
      );

      const gingerWave = Math.sin(nz * 15.0 - ny * 5.5 + warp * 2.4);

      // Realistic soft ambient occlusion under perch contact & subtle vertical chest fur shadow
      const baseOcclusion = smoothstep(0.0, 0.18, v);
      const chestFurPart =
        Math.exp(-Math.pow(nx / 0.12, 2)) * smoothstep(0.65, 0.95, nz) * smoothstep(-0.5, 0.35, ny) * 0.045;
      const ao = (0.82 + 0.18 * baseOcclusion) - chestFurPart;

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
 * Generates realistic anatomical foreleg fur textures matching Photo 3:
 * - 'right' (-X, viewer's left): dark brown-black mackerel tabby upper-arm/elbow sleeve
 *   wrapping cleanly down the outer upper arm and feathering strand-by-strand into snowy-white forearm!
 * - 'left' (+X, viewer's right): plush snowy-white foreleg with subtle fur-strand depth.
 */
export function createForelegTexture(
  palette: CalicoCoatPalette,
  side: 'left' | 'right',
  size = 256,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const c = parseCoatPalette(palette);

  for (let py = 0; py < size; py++) {
    const v = 1 - (py + 0.5) / size; // 0 = wrist, 1 = shoulder
    for (let px = 0; px < size; px++) {
      const phi = ((px + 0.5) / size) * Math.PI * 2;
      const nx = Math.sin(phi);
      const nz = Math.cos(phi);

      const strandVal = valueNoise3(nx * 58, v * 22, nz * 58);
      const tickVal = valueNoise3(nx * 105 + 1.9, v * 48, nz * 105 - 1.2);
      const n =
        (fbm3(nx * 4.2 + 1.1, v * 4.5, nz * 4.2 - 0.8) - 0.5) * 0.22 +
        (strandVal - 0.5) * 0.085;

      let tabbyW = 0;
      let gingerW = 0;
      let stripeDark = 0.55;

      if (side === 'right') {
        // Photo 3 hallmark: rich dark brown-black mackerel tabby "sleeve" sweeping down the outer-front right upper arm to the elbow!
        const outerFront = smoothstep(-0.55, 0.15, -nx + nz * 0.45);
        const sleeveHeight = smoothstep(0.42, 0.58, v + n * 0.42) * outerFront;
        tabbyW = sleeveHeight;
        const stripe = smoothstep(0.05, 0.72, Math.sin(v * 26 + nz * 5 + n * 3.5));
        stripeDark = 0.38 + stripe * 0.56;
        // Subtle warm golden-ginger glow right behind the outer upper shoulder edge (Photo 3!)
        gingerW = smoothstep(0.56, 0.86, v + n * 0.3) * smoothstep(-0.05, -0.65, nz) * 0.55;
      }

      const wristAo = 0.9 + 0.1 * smoothstep(0.0, 0.2, v);
      const idx = (py * size + px) * 4;
      writeTabicoPixel(
        data,
        idx,
        c,
        gingerW,
        tabbyW * (1 - gingerW * 0.6),
        stripeDark,
        strandVal,
        tickVal,
        0,
        wristAo,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates high-detail hair-strand fur textures for cream paws, tawny-brown ears, and eyelid shells.
 */
export function createSolidFurTexture(
  palette: CalicoCoatPalette,
  tone: 'cream' | 'tabbyEar' | 'eyelidTabby',
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
      const phi = ((px + 0.5) / size) * Math.PI * 2;
      const nx = Math.cos(phi);
      const nz = Math.sin(phi);
      const ny = v * 2 - 1;

      const strandVal = valueNoise3(nx * 56, ny * 18, nz * 56);
      const tickVal = valueNoise3(nx * 96 + 2.1, ny * 46, nz * 96 - 1.4);
      const n =
        (fbm3(nx * 4.0 + 1.1, ny * 4.0, nz * 4.0 - 0.8) - 0.5) * 0.2 +
        (strandVal - 0.5) * 0.08;

      let gingerW = 0;
      let tabbyW = 0;
      let stripeDark = 0.45;

      if (tone === 'tabbyEar') {
        // Photo 5: Candy's ears are predominantly warm russet-orange / cinnamon-ginger
        // with just a subtle dark espresso pencil trim along the very top tip & outer edge!
        const tipTrim = smoothstep(0.76, 0.97, v + n * 0.14);
        const outerEdgeTrim = smoothstep(0.68, 0.96, Math.abs(nx)) * smoothstep(0.25, 0.85, v);
        const darkTrim = clamp(Math.max(tipTrim * 0.62, outerEdgeTrim * 0.42), 0, 0.72);
        gingerW = 0.96;
        tabbyW = 0.10 + darkTrim * 0.72; // kept low across the ear body so warm orange dominates!
        stripeDark = clamp(0.45 + darkTrim * 0.48, 0.35, 0.92);
      } else if (tone === 'eyelidTabby') {
        // Warm amber-tinted brown-tabby eyelid fur darkening gently toward the lash rim
        gingerW = 0.32;
        tabbyW = 0.78;
        stripeDark = clamp(0.32 + smoothstep(0.45, 0.05, v) * 0.46, 0.22, 0.88);
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
        0,
        1.0,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates a high-detail hair-strand ringed Tabico tail texture matching Photo 2.
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

      const gingerIn = smoothstep(0.14, 0.26, vt);
      const gingerOut = 1 - smoothstep(0.42, 0.56, vt);
      const gingerW = gingerIn * gingerOut * 0.46;
      const tabbyW = clamp(1 - gingerW * 0.55, 0.48, 1);

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
 * Generates a tileable directional hair-strand bump map for plush micro-fur light scattering.
 */
export function createFurBumpTexture(size = 256): THREE.CanvasTexture {
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
 * Generates a single shared 512x512 tileable Lengyel Volumetric Fur Heightfield alphaMap.
 * Thousands of fine overlapping hair strands rise as smooth cones from 1.0 (dense roots)
 * to 0.0 (gaps between hairs); stacked alphaTest shells sample this texture at increasing
 * thresholds so every hair physically tapers to a crisp point in 3D with zero depth-sorting glitches!
 */
export function createFurHeightAlphaTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  // Deterministic tiled grid of jittered tapered hair follicles (36x36 cells per tile)
  const cells = 36;
  const cellJitterX = new Float32Array(cells * cells);
  const cellJitterY = new Float32Array(cells * cells);
  const cellHeight = new Float32Array(cells * cells);

  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const i = cy * cells + cx;
      cellJitterX[i] = 0.18 + hash3(cx, cy, 11) * 0.64;
      cellJitterY[i] = 0.18 + hash3(cx, cy, 29) * 0.64;
      cellHeight[i] = 0.62 + hash3(cx, cy, 47) * 0.38;
    }
  }

  for (let py = 0; py < size; py++) {
    const gy = (py / size) * cells;
    const iy = Math.floor(gy);
    for (let px = 0; px < size; px++) {
      const gx = (px / size) * cells;
      const ix = Math.floor(gx);

      let maxH = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = ((iy + dy) % cells + cells) % cells;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = ((ix + dx) % cells + cells) % cells;
          const ci = ny * cells + nx;
          const fx = ix + dx + cellJitterX[ci];
          const fy = iy + dy + cellJitterY[ci];
          // Slightly elliptical strands along vertical fur lay
          const dist = Math.hypot((gx - fx) * 1.18, (gy - fy) * 0.78);
          const cone = Math.max(0, 1 - dist * 1.38) * cellHeight[ci];
          if (cone > maxH) maxH = cone;
        }
      }

      const val = clamp(Math.round(maxH * 255), 0, 255);
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
  tex.repeat.set(6, 4);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates realistic luminous celadon / sage-olive green domestic cat eyes:
 * intricate radial iris stroma fibers, dark eyeliner limbal border, vertical-oval feline pupil,
 * subtle upper eyelid shadow, and natural wet corneal catchlights.
 */
export function createCatEyeTexture(
  palette: CalicoCoatPalette,
  width = 512,
  height = 256,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  const outerRgb = hexToRgb(palette.eyeOuter);
  const innerRgb = hexToRgb(palette.eyeInner);
  const limbalRgb: Rgb = { r: 14, g: 16, b: 15 };
  const pupilRgb: Rgb = { r: 7, g: 8, b: 10 };
  const scleraRgb: Rgb = { r: 215, g: 212, b: 204 };
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

        const irisRadius = 0.82;
        if (rad < irisRadius) {
          const t = rad / irisRadius;
          const fiber =
            Math.sin(angle * 36) * 0.045 +
            Math.cos(angle * 61 + rad * 10) * 0.035 +
            (valueNoise3(Math.cos(angle) * 9, Math.sin(angle) * 9, rad * 11) - 0.5) * 0.15;
          const gradT = clamp(Math.pow(t, 0.84) + fiber, 0, 1);

          r = innerRgb.r + (outerRgb.r - innerRgb.r) * gradT;
          g = innerRgb.g + (outerRgb.g - innerRgb.g) * gradT;
          b = innerRgb.b + (outerRgb.b - innerRgb.b) * gradT;

          // Subtle upper-lid shadow for authentic feline depth
          const topShade = smoothstep(0.08, 0.56, ny);
          r += (limbalRgb.r - r) * topShade * 0.42;
          g += (limbalRgb.g - g) * topShade * 0.42;
          b += (limbalRgb.b - b) * topShade * 0.42;

          // Translucent lower celadon light-bounce
          const lowerGlow = smoothstep(-0.08, -0.54, ny) * (1 - t * 0.52);
          r += (220 - r) * lowerGlow * 0.34;
          g += (230 - g) * lowerGlow * 0.34;
          b += (178 - b) * lowerGlow * 0.34;

          // Bold natural black limbal ring
          const limbal = smoothstep(0.75, 0.95, t);
          r += (limbalRgb.r - r) * limbal * 0.94;
          g += (limbalRgb.g - g) * limbal * 0.94;
          b += (limbalRgb.b - b) * limbal * 0.94;

          // Natural vertical-oval domestic cat pupil (Photo 3!)
          const pupilDist = Math.hypot(nx * 1.48, ny * 0.96);
          const pupilMask = 1 - smoothstep(0.36, 0.42, pupilDist);
          r += (pupilRgb.r - r) * pupilMask;
          g += (pupilRgb.g - g) * pupilMask;
          b += (pupilRgb.b - b) * pupilMask;

          // Soft natural upper-left daylight window reflection
          const sp1 = 1 - smoothstep(0.085, 0.145, Math.hypot((nx + 0.22) * 0.9, (ny - 0.22) * 1.1));
          r += (whiteRgb.r - r) * sp1 * 0.92;
          g += (whiteRgb.g - g) * sp1 * 0.92;
          b += (whiteRgb.b - b) * sp1 * 0.92;

          // Delicate lower-right catchlight
          const sp2 = 1 - smoothstep(0.038, 0.068, Math.hypot(nx - 0.19, ny + 0.20));
          r += (whiteRgb.r - r) * sp2 * 0.65;
          g += (whiteRgb.g - g) * sp2 * 0.65;
          b += (whiteRgb.b - b) * sp2 * 0.65;
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
 * Generates a realistic speckled heather-grey felt texture inspired by the felt cat perch in Photo 3.
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
      // Natural mottled wool-felt fibers
      const fiberA = valueNoise3(x * 0.18, y * 0.18, 3.1);
      const fiberB = hash3(x, y, 17);
      const fleck = hash3(x >> 1, y >> 1, 53);
      const t = clamp(fiberA * 0.45 + fiberB * 0.35 + (fleck > 0.88 ? 0.22 : 0), 0, 1);

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
  tex.repeat.set(3, 3);
  return tex;
}

/** Soft radial contact ambient-occlusion shadow placed under the cat on the felt perch. */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 18, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(4, 7, 15, 0.72)');
  g.addColorStop(0.58, 'rgba(4, 7, 15, 0.38)');
  g.addColorStop(1, 'rgba(4, 7, 15, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/** Soft subtle warm heart texture for delicate petting feedback particles. */
export function createHeartParticleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(size / 2, size / 2 + 4);

  const halo = ctx.createRadialGradient(0, -4, 4, 0, -4, 52);
  halo.addColorStop(0, 'rgba(251, 113, 133, 0.42)');
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

/** Delicate four-point warm starlight sparkle texture for petting feedback particles. */
export function createSparkleParticleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  const glow = ctx.createRadialGradient(c, c, 2, c, c, 54);
  glow.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
  glow.addColorStop(0.3, 'rgba(253, 186, 116, 0.42)');
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

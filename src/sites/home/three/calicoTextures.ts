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

/**
 * Rich 7-tone realistic torbie-calico palette derived across all 5 reference photos of Candy:
 * Snowy cream, fiery marmalade-apricot, burnt mahogany-chestnut, warm honey-ochre,
 * cool silver-pewter frost, dark espresso-umber, and glossy jet-black velvet.
 */
interface ParsedPalette {
  cream: Rgb;
  creamShadow: Rgb;
  ginger: Rgb;
  gingerDeep: Rgb;
  gingerLight: Rgb;
  mahogany: Rgb;
  honeyOchre: Rgb;
  silverFrost: Rgb;
  pewterMid: Rgb;
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
    ginger: hexToRgb('#de822f'),
    gingerDeep: hexToRgb(palette.gingerDeep),
    gingerLight: hexToRgb('#f3b05d'),
    mahogany: hexToRgb('#6b2d10'),
    honeyOchre: hexToRgb('#bc8f4c'),
    silverFrost: hexToRgb('#aba69c'),
    pewterMid: hexToRgb('#7d7870'),
    charcoal: hexToRgb(palette.charcoal),
    charcoalDeep: hexToRgb(palette.charcoalDeep),
    agoutiTaupe,
    agoutiBuff: {
      r: Math.round(agoutiTaupe.r * 0.52 + creamShadow.r * 0.48),
      g: Math.round(agoutiTaupe.g * 0.52 + creamShadow.g * 0.48),
      b: Math.round(agoutiTaupe.b * 0.52 + creamShadow.b * 0.48),
    },
  };
}

/**
 * Writes realistic 7-tone torbie-calico fur directly into ImageData:
 * - Snowy cream-white base
 * - Vibrant fiery apricot-marmalade ginger with peach-gold highlights & burnt-mahogany depth
 * - Rich brown-black mackerel tabby with warm honey-ochre ticking, cool silver-pewter frosted tips,
 *   fine tortoiseshell brindle flecks, and glossy jet-black stripes/saddles
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
  silverFrostWeight = 0,
  mahoganyWeight = 0,
  tortieFleck = 0,
  extraTintRgb?: Rgb,
  extraTintWeight = 0,
): void {
  const hairMod = (strandVal - 0.5) * 0.58 + (tickVal - 0.5) * 0.42;

  // 1. Plush snowy cream-white fur
  const creamMix = clamp(0.15 + hairMod * 0.36, 0, 1);
  let r = c.cream.r + (c.creamShadow.r - c.cream.r) * creamMix;
  let g = c.cream.g + (c.creamShadow.g - c.cream.g) * creamMix;
  let b = c.cream.b + (c.creamShadow.b - c.cream.b) * creamMix;

  // 2. Fiery golden-apricot / marmalade ginger with soft natural hair depth, peach tips & mahogany shading
  if (gingerWeight > 0.001) {
    const stripeT = smoothstep(-0.75, 0.75, gingerStripeWave);
    const gBaseMix = 0.56 + stripeT * 0.44;
    let gr = c.gingerDeep.r + (c.ginger.r - c.gingerDeep.r) * gBaseMix;
    let gg = c.gingerDeep.g + (c.ginger.g - c.gingerDeep.g) * gBaseMix;
    let gb = c.gingerDeep.b + (c.ginger.b - c.gingerDeep.b) * gBaseMix;

    const tipHi = clamp(0.24 + (strandVal - 0.5) * 0.62 + (tickVal - 0.5) * 0.34, 0, 1);
    gr += (c.gingerLight.r - gr) * tipHi;
    gg += (c.gingerLight.g - gg) * tipHi;
    gb += (c.gingerLight.b - gb) * tipHi;

    if (mahoganyWeight > 0.001) {
      const mw = clamp(mahoganyWeight, 0, 0.78);
      gr += (c.mahogany.r - gr) * mw;
      gg += (c.mahogany.g - gg) * mw;
      gb += (c.mahogany.b - gb) * mw;
    }

    const gw = clamp(gingerWeight, 0, 1);
    r += (gr - r) * gw;
    g += (gg - g) * gw;
    b += (gb - b) * gw;
  }

  // 3. Multi-tone torbie mackerel tabby: warm honey-ochre & taupe agouti + cool silver-pewter frost
  //    + fine fiery tortoiseshell brindle hairs + deep jet-black velvet stripes/rosettes
  if (tabbyWeight > 0.001) {
    const buffHighlight = smoothstep(0.50, 0.88, tickVal * 0.62 + strandVal * 0.38);
    const rootDark = smoothstep(0.46, 0.12, strandVal);

    // Base warm taupe-honey agouti coat
    const honeyMix = clamp(0.30 + (tickVal - 0.5) * 0.48, 0, 0.75);
    let ar = c.agoutiTaupe.r + (c.honeyOchre.r - c.agoutiTaupe.r) * honeyMix;
    let ag = c.agoutiTaupe.g + (c.honeyOchre.g - c.agoutiTaupe.g) * honeyMix;
    let ab = c.agoutiTaupe.b + (c.honeyOchre.b - c.agoutiTaupe.b) * honeyMix;

    // Pale sandy-buff hair tips
    ar += (c.agoutiBuff.r - ar) * buffHighlight * 0.62;
    ag += (c.agoutiBuff.g - ag) * buffHighlight * 0.62;
    ab += (c.agoutiBuff.b - ab) * buffHighlight * 0.62;

    // Cool silver-ash / pewter frost characteristic of Candy's aerial rump & shoulder coat!
    if (silverFrostWeight > 0.001) {
      const frostTip = clamp(silverFrostWeight * (0.48 + buffHighlight * 0.72), 0, 0.94);
      const fr = c.pewterMid.r + (c.silverFrost.r - c.pewterMid.r) * buffHighlight;
      const fg = c.pewterMid.g + (c.silverFrost.g - c.pewterMid.g) * buffHighlight;
      const fb = c.pewterMid.b + (c.silverFrost.b - c.pewterMid.b) * buffHighlight;
      ar += (fr - ar) * frostTip;
      ag += (fg - ag) * frostTip;
      ab += (fb - ab) * frostTip;
    }

    // Fine tortoiseshell orange/mahogany brindle hairs sprinkled organically through the tabby coat
    if (tortieFleck > 0.001) {
      const fw = clamp(tortieFleck, 0, 0.88);
      const tCol = strandVal > 0.48 ? c.ginger : c.mahogany;
      ar += (tCol.r - ar) * fw;
      ag += (tCol.g - ag) * fw;
      ab += (tCol.b - ab) * fw;
    }

    // Deep mahogany-chestnut warmth on rear flanks & transitions
    if (mahoganyWeight > 0.001) {
      const mw = clamp(mahoganyWeight * 0.68, 0, 0.68);
      ar += (c.mahogany.r - ar) * mw;
      ag += (c.mahogany.g - ag) * mw;
      ab += (c.mahogany.b - ab) * mw;
    }

    // Dark espresso root shading
    ar += (c.charcoal.r - ar) * rootDark * 0.55;
    ag += (c.charcoal.g - ag) * rootDark * 0.55;
    ab += (c.charcoal.b - ab) * rootDark * 0.55;

    // Glossy jet-black mackerel stripes, rosettes & spine diamond
    const darkHairSheen = clamp(0.14 + strandVal * 0.34, 0, 1);
    const sr = c.charcoalDeep.r + (c.charcoal.r - c.charcoalDeep.r) * darkHairSheen;
    const sg = c.charcoalDeep.g + (c.charcoal.g - c.charcoalDeep.g) * darkHairSheen;
    const sb = c.charcoalDeep.b + (c.charcoal.b - c.charcoalDeep.b) * darkHairSheen;

    const sd = clamp(stripeDarkness + (tickVal - 0.5) * 0.14, 0, 1);
    let tr = ar + (sr - ar) * sd;
    let tg = ag + (sg - ag) * sd;
    let tb = ab + (sb - ab) * sd;

    // Silvery-ash frosted guard-hair tips shimmering lightly over Candy's dark silver-pewter rump/shoulders!
    if (silverFrostWeight > 0.08) {
      const guardHair = smoothstep(0.60, 0.92, strandVal * 0.55 + tickVal * 0.45);
      const frostSheen = clamp(silverFrostWeight * guardHair * 0.52 * (1 - sd * 0.45), 0, 0.48);
      tr += (c.silverFrost.r - tr) * frostSheen;
      tg += (c.silverFrost.g - tg) * frostSheen;
      tb += (c.silverFrost.b - tb) * frostSheen;
    }

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
 * Unified realistic 7-tone head + muzzle coat texture modeled across ALL 5 photos of Candy
 * (including the aerial view revealing her huge bright golden-apricot back-of-head cap!):
 * - Huge radiant golden-apricot / marmalade cap spanning the entire back of her skull behind the ears
 * - Jet-black crown diamond nestled right between the front-inner edges of her ears
 * - Crisp snowy-white nape edge, narrow nose blaze, muzzle, chin & dusty-pink nose bridge
 * - Signature asymmetric dark espresso (+X) & warm honey-tan (-X) mustache smudges
 * - Broad fiery apricot flame above her left eye (+X), warm golden-ochre cheek warmth,
 *   multi-tone forehead M-stripes, and crisp sweeping black mascara lines
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
      const strandBack = valueNoise3(nx * 74, ny * 26, nz * 74);
      const frontBlend = smoothstep(-0.15, 0.45, nz);
      const strandVal = strandBack + (strandFront - strandBack) * frontBlend;
      const tickVal = valueNoise3(nx * 124 + 3.4, ny * 68 - 1.9, nz * 124 + 2.2);

      const macroNoise = (fbm3(nx * 5.2 + 2.1, ny * 5.2 - 1.3, nz * 5.2 + 0.7) - 0.5) * 0.2;
      const hairFeather = (strandVal - 0.5) * 0.085 + (tickVal - 0.5) * 0.032;
      const n = macroNoise + hairFeather;

      // 1. Snowy-white muzzle, chin, narrow nose blaze & crisp white nape collar edge (Aerial Photo!)
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

      // Aerial photo hallmark: crisp bright white nape trim peeking neatly along lower back & right-side neck!
      const whiteNapeEdge =
        smoothstep(-0.36, -0.62, ny + n * 0.20) *
        smoothstep(0.22, -0.35, nz + n * 0.20) *
        (0.75 + smoothstep(0.1, -0.6, nx) * 0.25);

      const rawWhiteMask = Math.max(whiteBlazeMask, whiteChinMask, whiteNapeEdge);

      // 2. Signature asymmetric mustache smudges painted directly onto the unified snout
      const dLeftMustache = Math.hypot((nx - 0.145) * 0.78, (ny + 0.255) * 1.18, (nz - 0.945) * 1.1);
      const leftMustache = smoothstep(0.0, 0.055, 0.115 - dLeftMustache + n * 0.16);
      const dRightMustache = Math.hypot((nx + 0.125) * 0.88, (ny + 0.275) * 1.25, (nz - 0.945) * 1.1);
      const rightMustache = smoothstep(0.0, 0.055, 0.095 - dRightMustache + n * 0.16) * 0.88;
      const mustacheMask = Math.max(leftMustache, rightMustache);

      const whiteMask = clamp(rawWhiteMask * (1 - mustacheMask), 0, 1);

      // 3. AERIAL PHOTO BREAKTHROUGH: Candy's HUGE luminous golden-apricot / marmalade BACK-OF-HEAD CAP!
      //    Covers the entire occiput & upper crown behind her ears, softly mottled with silky hair grain!
      const backOrangeCapField =
        smoothstep(0.22, -0.20, nz + n * 0.28) *
        smoothstep(-0.56, -0.18, ny + n * 0.25) *
        smoothstep(0.96, 0.44, Math.abs(nx) - smoothstep(0.0, -0.6, nz) * 0.36);

      // Prominent bright apricot crown band extending forward behind the dark forehead wedge
      const dGingerCrownBand = Math.hypot((nx + 0.06) * 0.82, (ny - 0.76) * 1.02, (nz + 0.18) * 0.68);
      // Broad tall vibrant apricot-orange patch sweeping above her left eye (+X)
      const dGingerLeftMain = Math.hypot((nx - 0.24) * 1.48, (ny - 0.21) * 1.12, (nz - 0.84) * 1.18);
      const dGingerLeftOuterLid = Math.hypot((nx - 0.42) * 1.55, (ny - 0.14) * 1.65, (nz - 0.76) * 1.25);

      // Continuous feathered JET-BLACK CROWN WEDGE connecting seamlessly from dark forehead M-stripes
      // straight back between her ears into a jagged fur-feathered point (Aerial + Box Photo — ZERO floating dot!)
      const crownWedgeHalfW = clamp(0.18 + Math.max(0, nz) * 0.14, 0.06, 0.30);
      const crownWedgeCenterX = -0.02 + Math.max(0, nz) * 0.03;
      const crownFeather =
        (fbm3(nx * 14.0, ny * 10.0, nz * 14.0) - 0.5) * 0.18 + (strandVal - 0.5) * 0.10;
      const blackCrownWedge =
        smoothstep(crownWedgeHalfW + 0.07, crownWedgeHalfW - 0.04, Math.abs(nx - crownWedgeCenterX) - crownFeather) *
        smoothstep(0.46, 0.76, ny + crownFeather * 0.5) *
        smoothstep(-0.08, 0.36, nz + crownFeather * 0.85) *
        smoothstep(0.95, 0.68, nz);

      // Secondary warm golden-amber highlights on right inner brow & cheeks
      const dGingerRightInnerBrow = Math.hypot((nx + 0.18) * 1.95, (ny - 0.12) * 1.55, (nz - 0.88) * 1.2);
      const dGingerLeftCheekWarm = Math.hypot((nx - 0.46) * 1.35, (ny + 0.07) * 1.65, (nz - 0.74) * 1.25);
      const dGingerRightCheekWarm = Math.hypot((nx + 0.44) * 1.45, (ny + 0.09) * 1.7, (nz - 0.74) * 1.25);

      const gingerPrimaryField =
        Math.max(
          0.46 - dGingerLeftMain,
          0.35 - dGingerLeftOuterLid,
          0.60 - dGingerCrownBand,
        ) +
        macroNoise * 0.68 +
        hairFeather * 1.1;

      const gingerSecondaryField =
        Math.max(
          0.31 - dGingerRightInnerBrow,
          0.36 - dGingerLeftCheekWarm,
          0.33 - dGingerRightCheekWarm,
        ) +
        macroNoise * 0.65 +
        hairFeather * 1.0;

      const primaryGingerW =
        clamp(Math.max(smoothstep(0.0, 0.10, gingerPrimaryField), backOrangeCapField * 0.96), 0, 1) *
        (1 - rawWhiteMask) *
        (1 - blackCrownWedge * 0.96);
      const secondaryGingerW =
        smoothstep(0.0, 0.14, gingerSecondaryField) * 0.62 * (1 - rawWhiteMask);
      const gingerW = clamp(Math.max(primaryGingerW, secondaryGingerW), 0, 1);

      // Dark brown-black tabby covers front forehead, cheeks, temples, continuous black crown wedge & left ear-side temple (+X)
      const leftTempleDark =
        smoothstep(0.46, 0.78, nx) *
        smoothstep(-0.42, 0.15, nz) *
        smoothstep(0.55, 0.05, nz) *
        smoothstep(-0.22, 0.38, ny) *
        0.88;
      const tabbyBaseField = Math.max(1.0 - rawWhiteMask * 1.14, mustacheMask, blackCrownWedge);
      const tabbyW = clamp(
        Math.max(
          smoothstep(0.04, 0.2, tabbyBaseField) *
            (1 - primaryGingerW * 0.94) *
            (1 - secondaryGingerW * 0.45),
          blackCrownWedge * 0.96,
          leftTempleDark * (1 - rawWhiteMask) * smoothstep(0.32, 0.56, dGingerLeftMain),
        ),
        0,
        1,
      );

      // 4. Authentic domestic-shorthair tabby facial markings
      const warp = (fbm3(nx * 6.8, ny * 6.8, nz * 6.8) - 0.5) * 0.92;

      const foreheadZone =
        smoothstep(0.12, 0.42, ny) * smoothstep(-0.05, 0.45, nz) * smoothstep(0.68, 0.18, Math.abs(nx));
      const mLinePhase = nx * 36.0 + Math.sin(ny * 7.5) * 0.65 + warp * 1.8;
      const foreheadFineStripe = smoothstep(0.24, 0.82, Math.cos(mLinePhase)) * foreheadZone;
      const centerBrowLine =
        Math.exp(-Math.pow((nx + 0.075) / 0.052, 2)) *
        smoothstep(0.14, 0.38, ny) *
        smoothstep(0.45, 0.85, nz);

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

      const cheekBottomRim =
        Math.exp(-Math.pow((ny + 0.25 + warp * 0.04) / 0.055, 2)) *
        smoothstep(0.26, 0.54, absX) *
        smoothstep(-0.2, 0.45, nz);

      const warmCheekLift = cheekZone * (1 - Math.max(mascara1, mascara2) * 0.9) * 0.26;
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
          centerBrowLine * 0.56 +
          mascara1 * 0.76 +
          mascara2 * 0.72 +
          cheekBottomRim * 0.64 +
          blackCrownWedge * 0.84,
        0.06,
        0.97,
      );
      if (mustacheMask > 0.05) {
        stripeDarkness = stripeDarkness * (1 - mustacheMask) + mustacheDarkness * mustacheMask;
      }

      // Subtle cool silver-pewter frost along the outer dark temples & silky mottled golden depth in the orange cap (NO zebra bars!)
      const templeFrost = smoothstep(0.35, 0.78, absX) * smoothstep(-0.2, 0.35, ny) * 0.25;
      const capCenterTawny =
        Math.exp(-Math.pow(nx / 0.14, 2)) * smoothstep(0.1, -0.55, nz) * smoothstep(-0.2, 0.65, ny);
      const gingerWave =
        (fbm3(nx * 7.5 + 1.2, ny * 5.0 - 0.8, nz * 7.5 + 2.4) - 0.45) * 1.1 - capCenterTawny * 0.65;

      const eyeSpectacle =
        Math.exp(-Math.pow((absX - 0.38) / 0.10, 2)) *
        Math.exp(-Math.pow((ny - 0.03) / 0.085, 2)) *
        smoothstep(0.68, 0.92, nz) *
        (1 - rawWhiteMask);

      const noseBridgeGlow =
        Math.exp(-Math.pow(nx / 0.085, 2)) *
        Math.exp(-Math.pow((ny + 0.12) / 0.075, 2)) *
        smoothstep(0.86, 0.97, nz);

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

      const mouthCleft =
        Math.exp(-Math.pow(nx / 0.018, 2)) *
        smoothstep(-0.20, -0.25, ny) *
        smoothstep(-0.36, -0.29, ny) *
        smoothstep(0.85, 0.94, nz);
      const ao = 1.0 - mouthCleft * 0.35;

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
        templeFrost,
        0,
        0,
        extraRgb,
        extraWeight,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * 5-Photo Accurate 7-tone Torbie-Calico torso texture incorporating the new AERIAL coat view:
 * - Front (+Z): Plush snowy-white chest bib, broad white right neck collar (Photo 3), snowy nape edge
 * - Mid-Spine Center (-Z, ny ≈ +0.05): Bold glossy JET-BLACK VELVET central diamond patch (Aerial Photo!)
 * - Left-of-Spine & Left Flank (+X, Photos 2 & Aerial):
 *     * Dark silver-frosted brown-black mackerel tabby upper shoulder + diagonal drop into white chest
 *     * Broad FIERY MARMALADE-ORANGE saddle right beside the black spine diamond curving seamlessly down into
 *       the bold vertical golden-orange mid-flank sash!
 *     * Marbled dark tabby & deep mahogany-chestnut mid-loin
 *     * Vibrant golden-orange rear thigh above snowy-white lower haunch trim
 * - Right-of-Spine & Right Flank (-X, Photos 3 & Aerial):
 *     * Broad snowy-white right neck collar -> vibrant apricot-orange diagonal upper-shoulder blaze!
 *     * Crisp dark brown-black mackerel tabby shoulder/elbow & striped mid-flank with warm honey-ochre & tortie flecks
 *     * Rich warm golden-amber right flank patch -> crisp snowy-white lower-flank band -> dark charcoal lower rear hip
 * - Lower Rump (Aerial Photo!): Cool SILVER-ASH / PEWTER-GREY frosted tabby coat with jet-black marbling,
 *   deep burnt-mahogany outer haunch shading, and a tiny warm amber-chestnut fleck at top-center tail base!
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
    const ny = v * 2 - 1; // [-1 bottom/rump, +1 top/neck]

    for (let px = 0; px < width; px++) {
      const phi = ((px + 0.5) / width) * Math.PI * 2;
      const nx = Math.sin(phi);
      const nz = Math.cos(phi);

      const strandVal = valueNoise3(nx * 96, ny * 22 + nz * 12, nz * 96);
      const tickVal = valueNoise3(nx * 148 + 4.1, ny * 54 - 2.7, nz * 148 + 1.3);

      const macroNoise = (fbm3(nx * 4.6 + 4.2, ny * 4.6 + 1.5, nz * 4.6 - 2.3) - 0.5) * 0.22;
      const hairFeather = (strandVal - 0.5) * 0.088 + (tickVal - 0.5) * 0.032;
      const n = macroNoise + hairFeather;

      // 1. Crisp snowy-white chest bib (+Z), iconic bright white right-neck & nape collar (Photo 3 & Aerial!), & lower white belly trims
      const chestBib = smoothstep(0.46, 0.72, nz + n * 0.30);
      const rightNeckCollar =
        smoothstep(0.42, 0.68, ny + n * 0.24) *
        smoothstep(0.10, -0.42, nx) *
        smoothstep(-0.78, 0.18, nz + n * 0.24);
      // Aerial photo hallmark: crisp bright white nape collar peeking cleanly on right & left neck right behind the orange head cap!
      const leftNeckWhitePeek =
        smoothstep(0.58, 0.80, ny + n * 0.20) *
        smoothstep(0.25, 0.72, nx) *
        smoothstep(-0.58, 0.22, nz + n * 0.22) *
        0.92;
      const napeWhiteTrim =
        smoothstep(0.66, 0.86, ny + n * 0.16) *
        smoothstep(0.35, -0.88, nz + n * 0.18) *
        (0.78 + smoothstep(0.35, -0.55, nx) * 0.22);
      const rightLowerWhiteBand =
        smoothstep(-0.28, -0.56, ny + n * 0.28) *
        smoothstep(-0.84, -0.58, ny + n * 0.22) *
        smoothstep(-0.20, -0.62, nx) *
        smoothstep(-0.55, 0.65, nz + n * 0.26);
      const leftLowerWhiteTrim =
        smoothstep(-0.46, -0.78, ny + n * 0.34) *
        smoothstep(-0.05, 0.45, nx) *
        smoothstep(-0.72, 0.45, nz + nx * 0.48);

      const dLeftShoulderDrop = Math.hypot((nx - 0.62) * 1.45, (ny + 0.44) * 1.32, (nz - 0.58) * 1.35);
      const leftShoulderDrop = smoothstep(0.0, 0.11, 0.34 - dLeftShoulderDrop + n * 0.6);

      const dRightLowerHip = Math.hypot((nx + 0.78) * 1.12, (ny + 0.72) * 1.28, (nz + 0.12) * 1.05);
      const rightLowerHipTabby = smoothstep(0.0, 0.12, 0.48 - dRightLowerHip + n * 0.65);

      const whiteMask = clamp(
        Math.max(
          chestBib,
          rightNeckCollar * 0.98,
          leftNeckWhitePeek,
          napeWhiteTrim,
          rightLowerWhiteBand * 0.94,
          leftLowerWhiteTrim * 0.94,
        ) -
          leftShoulderDrop * 0.88 -
          rightLowerHipTabby * 0.95,
        0,
        1,
      );

      // 2. AERIAL PHOTO SIGNATURE: Centered glossy JET-BLACK VELVET mid-back diamond (surrounded by silver-frosted rump behind it!)
      const dBlackSpineDiamond = Math.hypot((nx - 0.02) * 1.32, (ny - 0.08) * 1.38, (nz + 0.94) * 1.25);
      const blackSpineDiamond = smoothstep(0.0, 0.15, 0.46 - dBlackSpineDiamond + n * 0.68);

      // 3. Vibrant FIERY MARMALADE / APRICOT-GINGER patchwork across ALL 5 photos:
      // (a) Aerial + Photo 2: Broad fiery orange saddle right beside the black spine diamond (+X, mid-back)
      //     curving seamlessly down into the bold vertical golden-orange mid-flank sash!
      const dLeftBackOrangeSaddle = Math.hypot((nx - 0.42) * 1.05, (ny + 0.06) * 1.12, (nz + 0.80) * 1.04);
      const leftBackOrangeSaddle = smoothstep(0.0, 0.15, 0.55 - dLeftBackOrangeSaddle + n * 0.82);

      const leftSashZ = -0.06 + ny * 0.18;
      const leftGingerSash =
        smoothstep(0.32, 0.68, nx) *
        smoothstep(0.28, 0.06, Math.abs(nz - leftSashZ) - n * 0.42) *
        smoothstep(-0.76, -0.34, ny + n * 0.32);

      // (b) Photo 2 & Aerial: Warm golden-orange rear left thigh sweep (+X rear side, cleanly above lower rump!)
      const dLeftGingerRump = Math.hypot((nx - 0.72) * 0.94, (ny + 0.42) * 1.02, (nz + 0.48) * 0.92);
      const leftGingerRump = smoothstep(0.0, 0.15, 0.46 - dLeftGingerRump + n * 0.78);

      // (c) Aerial + Photo 3: Vibrant apricot-orange diagonal RIGHT upper-shoulder blaze (-X, right behind white collar!)
      const dRightShoulderBlaze = Math.hypot((nx + 0.50) * 1.10, (ny - 0.44) * 1.30, (nz + 0.56) * 1.12);
      const rightShoulderBlaze = smoothstep(0.0, 0.14, 0.46 - dRightShoulderBlaze + n * 0.72);

      // (d) Photo 3: Rich warm golden-amber right SIDE flank patch (-X side, keeping lower-right aerial rump silver-frosted tabby!)
      const dRightGingerFlank = Math.hypot((nx + 0.92) * 0.95, (ny - 0.02) * 0.96, (nz - 0.04) * 0.98);
      const rightGingerFlank =
        smoothstep(0.0, 0.14, 0.56 - dRightGingerFlank + n * 0.82) *
        smoothstep(-0.52, -0.20, ny + n * 0.25);

      // (e) Aerial Photo: Tiny warm amber-chestnut fleck right at top-center tail base & tiny left neck fleck
      const dTailBaseFleck = Math.hypot((nx - 0.04) * 2.0, (ny + 0.78) * 1.9, (nz + 0.92) * 1.6);
      const tailBaseFleck = smoothstep(0.0, 0.1, 0.30 - dTailBaseFleck + n * 0.52);
      const dNeckFleck = Math.hypot((nx - 0.56) * 1.9, (ny - 0.50) * 1.6, (nz - 0.58) * 1.7);
      const neckGingerFleck = smoothstep(0.0, 0.1, 0.28 - dNeckFleck + n * 0.55);

      const gingerW = clamp(
        Math.max(
          leftBackOrangeSaddle,
          leftGingerSash,
          leftGingerRump,
          rightShoulderBlaze,
          rightGingerFlank,
          tailBaseFleck * 0.85,
          neckGingerFleck,
        ) *
          (1 - whiteMask) *
          (1 - blackSpineDiamond * 0.96) *
          (1 - rightLowerHipTabby * 0.9),
        0,
        1,
      );

      // 4. Rich multi-tone torbie tabby covers shoulders, dorsal spine, marbled flanks & silver-frosted lower rump
      const tabbyW = clamp((1 - whiteMask) * (1 - gingerW * 0.90), 0, 1);

      // 5. ORGANIC domain-warped feline mackerel & classic tabby blotches + transverse curved ribs (NO rigid vertical zebra bars!)
      const warpX = (fbm3(nx * 4.8 + 1.3, ny * 4.8 - 2.1, nz * 4.8 + 0.9) - 0.5) * 1.35;
      const warpY = (fbm3(nx * 5.2 - 3.4, ny * 5.2 + 1.7, nz * 5.2 - 2.2) - 0.5) * 1.35;
      // Curved transverse rib stripes wrapping naturally around the seated ribcage
      const ribCoord = ny * 18.5 + nz * 4.2 - Math.abs(nx) * 3.5 + warpX * 3.4 + warpY * 2.2;
      const ribBreakup = smoothstep(0.28, 0.72, fbm3(nx * 8.5 + warpX, ny * 7.5 + warpY, nz * 8.5));
      const transverseRibs = smoothstep(0.18, 0.80, Math.sin(ribCoord)) * (0.45 + 0.55 * ribBreakup);
      // Organic irregular dark classic-tabby rosettes / blotches seen across Candy's aerial shoulders & rump
      const classicBlotches = smoothstep(
        0.50,
        0.78,
        fbm3(nx * 6.8 + warpX * 1.4, ny * 6.4 + warpY * 1.4, nz * 6.8 - warpX),
      );
      const dorsalSpine = smoothstep(-0.55, -0.94, nz) * smoothstep(-0.35, 0.55, ny) * 0.28;

      const stripeDarkness = clamp(
        0.20 +
          transverseRibs * 0.44 +
          classicBlotches * 0.46 +
          dorsalSpine +
          blackSpineDiamond * 0.88 +
          leftShoulderDrop * 0.48 +
          rightLowerHipTabby * 0.44,
        0.12,
        0.97,
      );

      // 6. AERIAL PHOTO MULTI-COLOR LAYERS:
      //    (a) Cool SILVER-ASH / PEWTER-GREY frosted coat across her lower rump, lower-right back & dark shoulders!
      const rumpSilverFrost =
        smoothstep(-0.08, -0.68, ny + n * 0.28) *
        smoothstep(-0.05, -0.70, nz + n * 0.25) *
        smoothstep(0.95, 0.22, Math.abs(nx)) *
        0.90;
      const shoulderSilverFrost =
        smoothstep(0.08, 0.62, ny) * smoothstep(-0.12, -0.72, nz) * 0.44;
      const silverFrostW = clamp(
        Math.max(rumpSilverFrost, shoulderSilverFrost) * (1 - blackSpineDiamond * 0.88),
        0,
        0.92,
      );

      //    (b) Deep burnt-mahogany / roasted-chestnut shading ONLY on dark tabby rear flanks & orange-to-tabby borders
      //        (strictly masked off from snowy-white borders so orange->white transitions stay crisp and clean!)
      const nonWhiteGuard = smoothstep(0.28, 0.0, whiteMask);
      const rearOuterMahogany =
        smoothstep(-0.18, -0.74, ny) *
        smoothstep(0.32, 0.88, Math.abs(nx)) *
        smoothstep(0.22, -0.68, nz) *
        0.58 *
        nonWhiteGuard;
      const gingerBorderMahogany = gingerW * tabbyW * 1.65 * nonWhiteGuard;
      const mahoganyW = clamp(Math.max(rearOuterMahogany, gingerBorderMahogany), 0, 0.68);

      //    (c) Fine tortoiseshell orange-gold brindle speckling woven naturally inside the dark tabby coat!
      const brindleNoise = valueNoise3(nx * 24 + 7.3, ny * 20 - 4.1, nz * 24 + 2.9);
      const tortieFleck =
        smoothstep(0.64, 0.88, brindleNoise) *
        smoothstep(0.84, 0.22, stripeDarkness) *
        (1 - blackSpineDiamond) *
        0.64;

      // Soft organic dappled warmth across orange patches (zero mechanical sine-bar stripes!)
      const gingerWave =
        (fbm3(nx * 6.5 + warpX * 0.7, ny * 6.5 + warpY * 0.7, nz * 6.5) - 0.44) * 1.5 +
        (transverseRibs - 0.5) * 0.42;

      const baseOcclusion = smoothstep(0.0, 0.18, v);
      const chestFurPart =
        Math.exp(-Math.pow(nx / 0.12, 2)) *
        smoothstep(0.65, 0.95, nz) *
        smoothstep(-0.5, 0.35, ny) *
        0.045;
      const ao = 0.82 + 0.18 * baseOcclusion - chestFurPart;

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
        silverFrostW,
        mahoganyW,
        tortieFleck,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates realistic anatomical foreleg fur textures matching Photo 3:
 * - 'right' (-X, viewer's left): dark brown-black mackerel tabby upper-arm sleeve with warm chestnut edge
 *   feathering strand-by-strand into snowy-white forearm with soft inner-leg shading.
 * - 'left' (+X, viewer's right): plush snowy-white foreleg with gentle realistic shadow depth.
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
        // Photo 3 signature: bold dark brown-black tabby upper-arm sleeve wrapping visibly over outer-front right arm down to mid-forearm!
        const outerFront = smoothstep(-0.35, 0.30, -nx + nz * 0.65);
        const sleeveHeight = smoothstep(0.32, 0.52, v + n * 0.36) * outerFront;
        tabbyW = sleeveHeight;
        const stripe = smoothstep(0.05, 0.72, Math.sin(v * 24 + nz * 4 + n * 3.8));
        stripeDark = 0.48 + stripe * 0.48;
        gingerW = smoothstep(0.52, 0.84, v + n * 0.3) * smoothstep(-0.05, -0.65, nz) * 0.55;
      }

      // Soft ambient darkening on the inner/rear side of each foreleg so they ground naturally against the chest
      const innerFace = side === 'left' ? smoothstep(0.2, -0.8, nx) : smoothstep(-0.2, 0.8, nx);
      const legAo = (0.90 + 0.10 * smoothstep(0.0, 0.22, v)) * (1 - innerFace * 0.07);

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
        legAo,
        tabbyW * 0.18,
        gingerW * 0.25,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates high-detail hair-strand fur textures for cream paws, asymmetric orange-chestnut ears,
 * and warm amber-brown eyelid shells (Aerial + Photo 5 accurate!).
 */
export function createSolidFurTexture(
  palette: CalicoCoatPalette,
  tone: 'cream' | 'leftEar' | 'rightEar' | 'eyelidTabby',
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
      // CylinderGeometry UV convention: u=0 is +Z (front), u=0.25 is +X (outer left / inner right), u=0.5 is -Z (back)
      const phi = ((px + 0.5) / size) * Math.PI * 2;
      const nx = Math.sin(phi);
      const nz = Math.cos(phi);
      const ny = v * 2 - 1;

      const strandVal = valueNoise3(nx * 56, ny * 18, nz * 56);
      const tickVal = valueNoise3(nx * 96 + 2.1, ny * 46, nz * 96 - 1.4);
      const n =
        (fbm3(nx * 4.0 + 1.1, ny * 4.0, nz * 4.0 - 0.8) - 0.5) * 0.2 +
        (strandVal - 0.5) * 0.08;

      let gingerW = 0;
      let tabbyW = 0;
      let stripeDark = 0.45;
      let mahoganyW = 0;

      if (tone === 'rightEar') {
        // Aerial + Photo 5: Candy's RIGHT ear (-X) is lush warm chestnut-orange with a rich dark-mahogany tip
        const tipTrim = smoothstep(0.66, 0.96, v + n * 0.14);
        const outerEdgeTrim = smoothstep(0.62, 0.95, Math.abs(nx)) * smoothstep(0.22, 0.85, v);
        const darkTrim = clamp(Math.max(tipTrim * 0.66, outerEdgeTrim * 0.36), 0, 0.74);
        gingerW = 0.96;
        mahoganyW = 0.22 + tipTrim * 0.42;
        tabbyW = 0.08 + darkTrim * 0.62;
        stripeDark = clamp(0.44 + darkTrim * 0.46, 0.35, 0.92);
      } else if (tone === 'leftEar') {
        // Aerial Photo: Candy's LEFT ear (+X) has a darker charcoal-brown outer-back base crescent
        // framing a luminous warm fiery cinnamon-orange inner back & tip!
        const outerBackDark =
          smoothstep(0.68, 0.14, v + n * 0.22) *
          smoothstep(-0.15, 0.72, nx) *
          smoothstep(0.35, -0.35, nz);
        const tipTrim = smoothstep(0.78, 0.97, v + n * 0.12);
        gingerW = 0.95;
        mahoganyW = 0.14 + outerBackDark * 0.32;
        tabbyW = clamp(0.08 + outerBackDark * 0.78 + tipTrim * 0.44, 0.08, 0.88);
        stripeDark = clamp(0.45 + outerBackDark * 0.44 + tipTrim * 0.38, 0.35, 0.94);
      } else if (tone === 'eyelidTabby') {
        gingerW = 0.34;
        tabbyW = 0.76;
        stripeDark = clamp(0.30 + smoothstep(0.45, 0.05, v) * 0.46, 0.22, 0.88);
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
        0,
        mahoganyW,
      );
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeTexture(canvas, THREE.SRGBColorSpace);
}

/**
 * Generates a high-detail hair-strand ringed Tabico tail texture with silver-pewter frost,
 * warm russet-mahogany undertones, and crisp dark espresso tabby rings.
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
      const edgeNoise =
        (fbm3(nx * 3.8 + 3.1, v * 7.2, nz * 3.8 - 1.7) - 0.5) * 0.22 + (strandVal - 0.5) * 0.08;
      const vt = v + edgeNoise;

      const gingerIn = smoothstep(0.14, 0.26, vt);
      const gingerOut = 1 - smoothstep(0.46, 0.62, vt);
      const gingerW = gingerIn * gingerOut * 0.44;
      const tabbyW = clamp(1 - gingerW * 0.48, 0.52, 1);

      const ringWave = Math.sin(v * 34.0 + edgeNoise * 6.5);
      const ringDark = smoothstep(-0.08, 0.66, ringWave);
      const dorsalDark = smoothstep(-0.2, 0.8, nz) * 0.20;
      const tipDark = smoothstep(0.76, 0.94, v);
      const stripeDark = clamp(0.28 + ringDark * 0.60 + dorsalDark + tipDark * 0.54, 0.20, 0.97);
      const silverFrostW = (1 - ringDark) * 0.44 * (1 - tipDark);
      const tortieFleck = smoothstep(0.68, 0.90, tickVal) * 0.38 * (1 - tipDark);

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
        ringWave * 0.5,
        1.0,
        silverFrostW,
        0.18 + gingerW * 0.28,
        tortieFleck,
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
 * Generates a shared tileable Lengyel Volumetric Fur Heightfield alphaMap.
 */
export function createFurHeightAlphaTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

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
 * Generates realistic luminous celadon / sage-olive green domestic cat eyes.
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

          const topShade = smoothstep(0.08, 0.56, ny);
          r += (limbalRgb.r - r) * topShade * 0.42;
          g += (limbalRgb.g - g) * topShade * 0.42;
          b += (limbalRgb.b - b) * topShade * 0.42;

          const lowerGlow = smoothstep(-0.08, -0.54, ny) * (1 - t * 0.52);
          r += (220 - r) * lowerGlow * 0.34;
          g += (230 - g) * lowerGlow * 0.34;
          b += (178 - b) * lowerGlow * 0.34;

          const limbal = smoothstep(0.75, 0.95, t);
          r += (limbalRgb.r - r) * limbal * 0.94;
          g += (limbalRgb.g - g) * limbal * 0.94;
          b += (limbalRgb.b - b) * limbal * 0.94;

          const pupilDist = Math.hypot(nx * 1.48, ny * 0.96);
          const pupilMask = 1 - smoothstep(0.36, 0.42, pupilDist);
          r += (pupilRgb.r - r) * pupilMask;
          g += (pupilRgb.g - g) * pupilMask;
          b += (pupilRgb.b - b) * pupilMask;

          const sp1 = 1 - smoothstep(0.085, 0.145, Math.hypot((nx + 0.22) * 0.9, (ny - 0.22) * 1.1));
          r += (whiteRgb.r - r) * sp1 * 0.92;
          g += (whiteRgb.g - g) * sp1 * 0.92;
          b += (whiteRgb.b - b) * sp1 * 0.92;

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
 * Generates a realistic speckled heather-grey felt texture inspired by Candy's felt cat perch.
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

/** Soft radial contact ambient-occlusion shadow placed under Candy on the felt perch. */
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

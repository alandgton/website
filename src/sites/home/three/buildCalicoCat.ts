import * as THREE from 'three';
import type { CalicoCoatPalette } from '../config/home.config';
import {
  createCatEyeTexture,
  createContactShadowTexture,
  createCushionFabricTexture,
  createForelegTexture,
  createFurBumpTexture,
  createFurHeightAlphaTexture,
  createHeadCalicoTexture,
  createSolidFurTexture,
  createTailCalicoTexture,
  createTorsoCalicoTexture,
} from './calicoTextures';

export type PetZone = 'head' | 'chin' | 'back' | 'tail';

export interface CalicoCatRig {
  root: THREE.Group;
  catRoot: THREE.Group;
  bodyGroup: THREE.Group;
  headPivot: THREE.Group;
  leftEarPivot: THREE.Group;
  rightEarPivot: THREE.Group;
  leftEyeBall: THREE.Group;
  rightEyeBall: THREE.Group;
  leftUpperLid: THREE.Group;
  rightUpperLid: THREE.Group;
  leftLowerLid: THREE.Group;
  rightLowerLid: THREE.Group;
  leftFrontPawPivot: THREE.Group;
  rightFrontPawPivot: THREE.Group;
  pettableMeshes: THREE.Object3D[];
  updateTail: (dt: number, purrLevel: number, tailPlayPulse: number) => void;
  dispose: () => void;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Extrudes vertices along normals for Lengyel Volumetric Multi-Shell Fur.
 * Optional per-vertex length multiplier allows sleek shorter fur over the muzzle/eyes
 * and fuller plush fur over the cheeks, ruff, shoulders, and haunches.
 */
function createFurShellGeometry(
  source: THREE.BufferGeometry,
  offset: number,
  gravityDroop: number,
  lengthWeights?: Float32Array,
): THREE.BufferGeometry {
  const geom = source.clone();
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const w = lengthWeights ? lengthWeights[i] : 1.0;
    const d = offset * w;
    const droop = gravityDroop * w;
    pos.setXYZ(
      i,
      pos.getX(i) + norm.getX(i) * d,
      pos.getY(i) + norm.getY(i) * d - droop,
      pos.getZ(i) + norm.getZ(i) * d,
    );
  }
  pos.needsUpdate = true;
  return geom;
}

/**
 * Creates anatomical wide-based triangular domestic shorthair cat ears (Candy's low-set ears):
 * Widest at the skull base (embedded cleanly into the cranium — zero teardrop pinch!)
 * tapering monotonically to a softly rounded feline triangle tip with a subtle front pinna hollow.
 */
function createSculptedEarGeometry(): THREE.BufferGeometry {
  const geom = new THREE.CylinderGeometry(0.14, 1.0, 1.0, 28, 18, false);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // [-0.5, +0.5]
    const z = pos.getZ(i);

    const t = clamp(y + 0.5, 0, 1); // 0 = wide skull base, 1 = softly rounded tip
    const r = Math.hypot(x, z);
    const ang = r > 1e-5 ? Math.atan2(z, x) : 0;
    const ux = r > 1e-5 ? x / r : 0;
    const uz = r > 1e-5 ? z / r : 0;

    // Monotonically tapering triangular width & thickness (strictly widest at base t=0!)
    let tipRound = 1.0;
    if (t > 0.84) {
      const capT = (t - 0.84) / 0.16;
      tipRound = Math.sqrt(Math.max(0.015, 1 - capT * capT));
    }
    const baseRadiusFrac = r / Math.max(0.05, 1.0 - 0.86 * t); // preserves interior cap vertices at top/bottom
    const widthProfile = 0.142 * (1 - 0.78 * Math.pow(t, 1.08)) * tipRound * clamp(baseRadiusFrac, 0, 1);
    const depthProfile = 0.082 * (1 - 0.68 * Math.pow(t, 1.05)) * tipRound * clamp(baseRadiusFrac, 0, 1);

    const nx = Math.cos(ang) * widthProfile;
    let ny = t * 0.245;
    let nz = Math.sin(ang) * depthProfile;

    // Subtle soft dome at the top tip cap
    if (t > 0.88) {
      ny += (1 - clamp(baseRadiusFrac, 0, 1)) * 0.012;
    }

    // Gentle concave pinna hollow on the front face (+Z) of the ear
    if (uz > 0 && t > 0.18 && t < 0.92) {
      const scoop =
        Math.max(0, 1 - ux * ux * 1.45) *
        Math.sin(((t - 0.18) / 0.74) * Math.PI) *
        uz;
      nz -= scoop * 0.032;
    }

    // Subtle natural forward cup toward the tip
    nz += Math.pow(t, 2) * 0.014;
    pos.setXYZ(i, nx, ny, nz);
  }

  geom.computeVertexNormals();
  return geom;
}

/** Creates the understated concave triangular inner ear pinna nestled smoothly inside the ear shell. */
function createInnerEarGeometry(): THREE.BufferGeometry {
  const geom = new THREE.CylinderGeometry(0.12, 1.0, 1.0, 20, 12, false);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y + 0.5, 0, 1);
    const r = Math.hypot(x, z);
    const ang = r > 1e-5 ? Math.atan2(z, x) : 0;
    const baseFrac = clamp(r / Math.max(0.05, 1.0 - 0.88 * t), 0, 1);
    const tipRound = t > 0.85 ? Math.sqrt(Math.max(0.02, 1 - Math.pow((t - 0.85) / 0.15, 2))) : 1;

    const widthProfile = 0.074 * (1 - 0.82 * Math.pow(t, 1.1)) * tipRound * baseFrac;
    const depthProfile = 0.012 * (1 - 0.55 * t) * tipRound * baseFrac;

    const nx = Math.cos(ang) * widthProfile;
    const ny = 0.055 + t * 0.138;
    const nz = Math.sin(ang) * depthProfile + 0.024 * (1 - t * 0.42) + Math.pow(t, 2) * 0.011;
    pos.setXYZ(i, nx, ny, nz);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a true anatomical seated feline body (Photo 3):
 * - Narrower plush neck beneath the cheeks flowing into rounded shoulders (NO straight cone sides!)
 * - Ribcage & plush seated haunches shifted naturally BACKWARD behind the upright front legs
 * - Recessed lower-front belly so 100% of both front legs (shoulder -> elbow -> forearm -> paw) stand proudly visible!
 */
function createSeatedTorsoGeometry(): { geometry: THREE.BufferGeometry; furWeights: Float32Array } {
  const profilePoints: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.28, 0.015),
    new THREE.Vector2(0.375, 0.11),
    new THREE.Vector2(0.402, 0.24),
    new THREE.Vector2(0.388, 0.40),
    new THREE.Vector2(0.352, 0.56),
    new THREE.Vector2(0.312, 0.70), // rounded feline shoulders
    new THREE.Vector2(0.248, 0.83), // natural inward curve to plush neck
    new THREE.Vector2(0.205, 0.94), // distinct plush neck below cheeks
    new THREE.Vector2(0.185, 1.04),
    new THREE.Vector2(0.001, 1.10),
  ];

  const geom = new THREE.LatheGeometry(profilePoints, 72);
  const pos = geom.attributes.position;
  const furWeights = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    const t = clamp(y / 1.04, 0, 1);

    // True seated feline spine posture: pelvis & haunches sit BACK (-0.15), chest & neck curve smoothly FORWARD (+0.11)
    const spineShiftZ = -0.15 * (1 - smoothstep(0.0, 0.85, t)) + 0.11 * smoothstep(0.28, 0.95, t);

    // C-infinity smooth front-to-back depth modulation (eliminates any z=0 vertical side crease!)
    const rearT = smoothstep(0.32, -0.32, z);
    const depthFactor = 0.88 + rearT * 0.30;
    z = z * (0.95 + (depthFactor - 0.95) * (1 - t * 0.45)) + spineShiftZ;

    // Smoothly integrated folded rear haunches flaring organically behind the elbows (Photo 3!)
    const haunchVert = Math.exp(-Math.pow((t - 0.23) / 0.19, 2));
    const haunchSide = smoothstep(0.14, 0.38, Math.abs(x));
    const haunchZ = smoothstep(0.24, -0.26, z);
    const haunchSwell = haunchVert * haunchSide * haunchZ;
    x += Math.sign(x) * haunchSwell * 0.064;
    z -= haunchSwell * 0.022;

    // Keep upper chest warmly rounded in front, while gently recessing lower belly behind the two forelegs
    if (z > 0.04) {
      const upperChestPuff =
        Math.exp(-Math.pow((t - 0.68) / 0.20, 2)) *
        Math.exp(-Math.pow(x / 0.28, 2));
      z += upperChestPuff * 0.058;

      if (t < 0.52) {
        const behindLegsRecess = Math.sin((t / 0.52) * Math.PI) * Math.exp(-Math.pow(x / 0.24, 2));
        z -= behindLegsRecess * 0.048;
      }
    }

    pos.setXYZ(i, x, y, z);

    const contactFade = smoothstep(0.02, 0.12, y);
    const ruffBoost = z > 0.10 && t > 0.56 ? 1.16 : 1.0;
    furWeights[i] = contactFade * ruffBoost;
  }

  geom.computeVertexNormals();
  return { geometry: geom, furWeights };
}

/**
 * Creates ONE unified, anatomically sculpted adult domestic shorthair feline head (Photo 3):
 * - Balanced rounded-oval cranium (not flat/squashed!) with natural cheekbones & brow ridges
 * - Recessed orbital eye sockets so glossy almond eyes nest authentically inside the skull
 * - Continuous forward-protruding feline muzzle/snout with subtle whisker pads & compact chin
 */
function createAnatomicalHeadGeometry(): {
  geometry: THREE.BufferGeometry;
  furWeights: Float32Array;
} {
  const geom = new THREE.SphereGeometry(1, 72, 54);
  const pos = geom.attributes.position;
  const furWeights = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const absX = Math.abs(ux);

    // Balanced, fuller rounded-oval adult feline cranium matching Photo 3
    let x = ux * 0.252;
    let y = uy * 0.256;
    let z = uz * 0.274;

    // Soft cranial dome taper between the ears
    if (uy > 0.28) {
      x *= 1 - smoothstep(0.28, 0.96, uy) * 0.11;
    }

    // Natural domestic shorthair lower cheek fluff ruff
    const cheekMask =
      Math.exp(-Math.pow((uy + 0.16) / 0.32, 2)) *
      smoothstep(0.38, 0.85, absX) *
      smoothstep(-0.35, 0.4, uz);
    x *= 1 + cheekMask * 0.08;
    y -= cheekMask * 0.012;

    // Gently tapered jawline under cheeks
    if (uy < -0.28) {
      x *= 1 - smoothstep(-0.28, -0.92, uy) * 0.15;
    }

    // Recessed orbital eye sockets at (±0.38, +0.06, +0.92)
    const socketDist = Math.hypot((absX - 0.38) / 0.21, (uy - 0.06) / 0.175);
    const socketMask = Math.exp(-socketDist * socketDist) * smoothstep(0.45, 0.86, uz);
    z -= socketMask * 0.026;

    // Subtle feline brow ridge above sockets
    const browMask =
      Math.exp(-Math.pow((absX - 0.33) / 0.22, 2)) *
      Math.exp(-Math.pow((uy - 0.27) / 0.13, 2)) *
      smoothstep(0.5, 0.88, uz);
    z += browMask * 0.014;

    // Continuous sculpted forward feline muzzle / snout
    const snoutMask =
      Math.exp(-Math.pow(ux / 0.34, 2)) *
      Math.exp(-Math.pow((uy + 0.20) / 0.27, 2)) *
      smoothstep(0.54, 0.94, uz);
    z += snoutMask * 0.074;
    x *= 1 - snoutMask * 0.10;

    // Subtle organic twin whisker-pad contour with delicate central philtrum
    const padLobe =
      Math.exp(-Math.pow((absX - 0.155) / 0.125, 2)) *
      Math.exp(-Math.pow((uy + 0.265) / 0.105, 2)) *
      smoothstep(0.75, 0.96, uz);
    z += padLobe * 0.016;

    // Compact lower jaw & chin tucked cleanly under the muzzle
    const chinMask =
      Math.exp(-Math.pow(ux / 0.19, 2)) *
      Math.exp(-Math.pow((uy + 0.44) / 0.12, 2)) *
      smoothstep(0.64, 0.94, uz);
    z += chinMask * 0.024;

    pos.setXYZ(i, x, y, z);

    // Clear eye sockets & bare nose pad so volumetric fur shells never clip eyes/nose
    const eyeClear = 1 - smoothstep(0.34, 0.16, Math.hypot(absX - 0.38, uy - 0.06)) * smoothstep(0.54, 0.82, uz);
    const noseClear = 1 - smoothstep(0.18, 0.08, Math.hypot(ux, uy + 0.18)) * smoothstep(0.84, 0.96, uz);
    const muzzleSleek = 1 - snoutMask * 0.56;
    const cheekPlush = 1 + cheekMask * 0.42;
    furWeights[i] = clamp(eyeClear * noseClear * muzzleSleek * cheekPlush, 0, 1.32);
  }

  geom.computeVertexNormals();
  return { geometry: geom, furWeights };
}

/**
 * Creates a full-length, visibly distinct seated anatomical feline foreleg (Photo 3!):
 * fuller upper shoulder & arm curving gently through the elbow down a sleek tapered forearm to the wrist.
 */
function createAnatomicalForelegGeometry(sideSign: 1 | -1): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.056, 0.02),
    new THREE.Vector2(0.060, 0.18),
    new THREE.Vector2(0.069, 0.35),
    new THREE.Vector2(0.082, 0.50),
    new THREE.Vector2(0.092, 0.62), // smooth upper arm tapering cleanly into chest shoulders
    new THREE.Vector2(0.072, 0.70),
    new THREE.Vector2(0.001, 0.74),
  ];
  const geom = new THREE.LatheGeometry(points, 28);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / 0.72, 0, 1);

    // Shoulder tucks seamlessly inside the rounded chest while elbows & forearms stand proudly in front!
    const curveX = sideSign * Math.pow(t, 1.35) * 0.044;
    const curveZ = -Math.pow(t, 1.25) * 0.175 + Math.sin(t * Math.PI) * 0.022;
    pos.setXYZ(i, x + curveX, y, z + curveZ);
  }

  geom.computeVertexNormals();
  return geom;
}

/** Creates a cozy sculpted felt cat perch cushion inspired by Photo 3's grey felt cat bed. */
function createFeltPerchGeometry(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -0.22),
    new THREE.Vector2(0.84, -0.22),
    new THREE.Vector2(0.95, -0.19),
    new THREE.Vector2(0.99, -0.11),
    new THREE.Vector2(0.96, -0.02),
    new THREE.Vector2(0.82, 0.028),
    new THREE.Vector2(0.54, 0.014),
    new THREE.Vector2(0.20, -0.015),
    new THREE.Vector2(0.001, -0.02),
  ];
  const geom = new THREE.LatheGeometry(profile, 64);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Single continuous smooth procedural tail mesh driven by an animated CatmullRomCurve3.
 */
class SmoothAnimatedTail {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly lengthSegs = 34;
  private readonly radialSegs = 16;
  private readonly controlPoints: THREE.Vector3[] = [];
  private readonly curve: THREE.CatmullRomCurve3;

  private readonly pt = new THREE.Vector3();
  private readonly tan = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly binormal = new THREE.Vector3();
  private readonly prevTan = new THREE.Vector3();
  private readonly rotAxis = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly refUp = new THREE.Vector3(0, 1, 0);

  // Continuous phase-integrated motion state (eliminates frequency-change phase jumps!)
  private phase = 0;
  private bobPhase = 0;
  private smoothedAmp = 0.062;
  private smoothedLift = 0;

  constructor(material: THREE.Material) {
    const rings = this.lengthSegs + 1;
    const cols = this.radialSegs + 1;
    const vertexCount = rings * cols;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    for (let i = 0; i < rings; i++) {
      const v = i / this.lengthSegs;
      for (let j = 0; j < cols; j++) {
        const u = j / this.radialSegs;
        const idx = i * cols + j;
        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = v;
      }
    }

    for (let i = 0; i < this.lengthSegs; i++) {
      for (let j = 0; j < this.radialSegs; j++) {
        const a = i * cols + j;
        const b = (i + 1) * cols + j;
        const c = (i + 1) * cols + (j + 1);
        const d = i * cols + (j + 1);
        // Outward-facing CCW winding: (d - a) x (b - a) = binormal x tan = +normal
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setIndex(indices);

    for (let k = 0; k < 6; k++) {
      this.controlPoints.push(new THREE.Vector3());
    }
    this.curve = new THREE.CatmullRomCurve3(this.controlPoints, false, 'centripetal');

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    this.update(0, 0, 0);
  }

  private radiusAt(t: number): number {
    const baseBody = 0.060 + 0.015 * Math.sin(t * Math.PI * 0.85);
    if (t < 0.06) {
      const baseT = t / 0.06;
      return baseBody * Math.max(0.02, Math.sin(baseT * Math.PI * 0.5));
    }
    if (t > 0.9) {
      const capT = (t - 0.9) / 0.1;
      return baseBody * Math.sqrt(Math.max(0.0004, 1 - capT * capT));
    }
    return baseBody;
  }

  update(dt: number, purrLevel: number, tailPlayPulse: number): void {
    // Calm, strictly capped feline tail sway matching the relaxed neutral pace
    const speed = clamp(1.45 + purrLevel * 0.18 + tailPlayPulse * 0.22, 1.45, 1.8);
    const targetAmp = clamp(0.062 + purrLevel * 0.012 + tailPlayPulse * 0.016, 0.062, 0.085);
    const targetLift = clamp(purrLevel * 0.12, 0, 0.12);

    const smoothK = 1 - Math.exp(-5.0 * dt);
    this.smoothedAmp += (targetAmp - this.smoothedAmp) * smoothK;
    this.smoothedLift += (targetLift - this.smoothedLift) * smoothK;

    // Integrate phase smoothly so transitions never cause sudden whipping
    this.phase += dt * speed;
    this.bobPhase += dt * (speed * 0.85);

    const swayAmp = this.smoothedAmp;
    const happyLift = this.smoothedLift;

    const w1 = Math.sin(this.phase - 0.4) * swayAmp;
    const w2 = Math.sin(this.phase - 1.1) * swayAmp * 1.25;
    const w3 = Math.sin(this.phase - 1.9) * swayAmp * 1.5;
    const tipBob = Math.cos(this.bobPhase - 1.5) * swayAmp * 0.55;

    // Graceful low-resting S-curve emerging smoothly out of the lower rump
    this.controlPoints[0].set(0.0, 0.16, -0.34);
    this.controlPoints[1].set(0.08, 0.14, -0.60);
    this.controlPoints[2].set(0.42 + w1 * 0.55, 0.17 + happyLift * 0.25, -0.58 + w1 * 0.3);
    this.controlPoints[3].set(0.68 + w2 * 0.75, 0.30 + happyLift * 0.65, -0.38 + w2 * 0.4);
    this.controlPoints[4].set(0.76 + w3 * 0.9, 0.47 + happyLift * 1.05 + tipBob * 0.5, -0.15 + w3 * 0.48);
    this.controlPoints[5].set(0.70 + w3 * 1.1, 0.62 + happyLift * 1.25 + tipBob, 0.04 + w3 * 0.6);

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const rings = this.lengthSegs + 1;
    const cols = this.radialSegs + 1;

    for (let i = 0; i < rings; i++) {
      const t = i / this.lengthSegs;
      this.curve.getPoint(t, this.pt);
      this.curve.getTangent(t, this.tan).normalize();

      if (i === 0) {
        this.normal.crossVectors(this.refUp, this.tan);
        if (this.normal.lengthSq() < 1e-4) this.normal.set(1, 0, 0);
        else this.normal.normalize();
        this.binormal.crossVectors(this.tan, this.normal).normalize();
      } else {
        this.rotAxis.crossVectors(this.prevTan, this.tan);
        const sinA = this.rotAxis.length();
        if (sinA > 1e-5) {
          this.rotAxis.divideScalar(sinA);
          const cosA = clamp(this.prevTan.dot(this.tan), -1, 1);
          this.quat.setFromAxisAngle(this.rotAxis, Math.acos(cosA));
          this.normal.applyQuaternion(this.quat).normalize();
        }
        this.binormal.crossVectors(this.tan, this.normal).normalize();
      }
      this.prevTan.copy(this.tan);

      const r = this.radiusAt(t);
      for (let j = 0; j < cols; j++) {
        const phi = (j / this.radialSegs) * Math.PI * 2;
        const cosP = Math.cos(phi) * r;
        const sinP = Math.sin(phi) * r;
        const vIdx = (i * cols + j) * 3;
        posArr[vIdx] = this.pt.x + this.normal.x * cosP + this.binormal.x * sinP;
        posArr[vIdx + 1] = this.pt.y + this.normal.y * cosP + this.binormal.y * sinP;
        posArr[vIdx + 2] = this.pt.z + this.normal.z * cosP + this.binormal.z * sinP;
      }
    }

    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.geometry.dispose();
  }
}

/**
 * Builds the anatomically realistic 3D tabico cat with 6-layer volumetric alphaTest fur shells,
 * unified continuous head & pear-body geometry, animated furry eyelids, heather-grey felt perch,
 * and tagged raycast zones.
 */
export function buildCalicoCat(palette: CalicoCoatPalette): CalicoCatRig {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const pettableMeshes: THREE.Object3D[] = [];

  const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };
  const tagPettable = <T extends THREE.Object3D>(obj: T, zone: PetZone): T => {
    obj.userData.petZone = zone;
    pettableMeshes.push(obj);
    return obj;
  };

  // --- Procedural High-Res Tabico Coat & Volumetric Fur Heightfield Textures ---
  const furBump = trackTex(createFurBumpTexture());
  const furHeightAlpha = trackTex(createFurHeightAlphaTexture());
  const headTex = trackTex(createHeadCalicoTexture(palette));
  const torsoTex = trackTex(createTorsoCalicoTexture(palette));
  const leftLegTex = trackTex(createForelegTexture(palette, 'left'));
  const rightLegTex = trackTex(createForelegTexture(palette, 'right'));
  const tailTex = trackTex(createTailCalicoTexture(palette));
  const creamFurTex = trackTex(createSolidFurTexture(palette, 'cream'));
  const tabbyEarTex = trackTex(createSolidFurTexture(palette, 'tabbyEar'));
  const eyelidFurTex = trackTex(createSolidFurTexture(palette, 'eyelidTabby'));
  const eyeTex = trackTex(createCatEyeTexture(palette));
  const perchTex = trackTex(createCushionFabricTexture(palette));
  const contactShadowTex = trackTex(createContactShadowTexture());

  const sheenTint = new THREE.Color('#fff0dc');

  /** Base undercoat fur material (slightly deepened for authentic fur-root ambient occlusion). */
  const makeBaseFurMat = (
    map: THREE.CanvasTexture,
    undercoatShade = 0.84,
    sheenStrength = 0.55,
  ): THREE.MeshPhysicalMaterial =>
    trackMat(
      new THREE.MeshPhysicalMaterial({
        map,
        color: new THREE.Color().setScalar(undercoatShade),
        bumpMap: furBump,
        bumpScale: 0.014,
        roughness: 0.9,
        metalness: 0.0,
        sheen: sheenStrength,
        sheenRoughness: 0.58,
        sheenColor: sheenTint,
      }),
    );

  /**
   * Attaches N stacked Lengyel Volumetric Fur Shells (alphaTest cutout, depthWrite: true)
   * with root-to-tip ambient occlusion and gentle downward fur-lay droop.
   */
  const attachVolumetricFur = (
    parent: THREE.Object3D,
    baseMesh: THREE.Mesh,
    map: THREE.CanvasTexture,
    layers: number,
    maxLength: number,
    maxDroop: number,
    furWeights?: Float32Array,
  ) => {
    for (let l = 1; l <= layers; l++) {
      const frac = l / layers; // 1/N .. 1.0
      const offset = maxLength * frac;
      const droop = maxDroop * frac * frac;
      const alphaTest = 0.14 + frac * 0.58; // dense silky hair taper with zero shadow sparkle aliasing
      const aoShade = 0.87 + frac * 0.18; // darker roots -> sunlit soft silky tips

      const shellGeom = trackGeom(
        createFurShellGeometry(baseMesh.geometry, offset, droop, furWeights),
      );
      const shellMat = trackMat(
        new THREE.MeshPhysicalMaterial({
          map,
          alphaMap: furHeightAlpha,
          alphaTest,
          color: new THREE.Color().setScalar(aoShade),
          roughness: 0.88 - frac * 0.06,
          metalness: 0.0,
          sheen: 0.65 + frac * 0.3,
          sheenRoughness: 0.5,
          sheenColor: sheenTint,
        }),
      );

      const shellMesh = new THREE.Mesh(shellGeom, shellMat);
      shellMesh.position.copy(baseMesh.position);
      shellMesh.rotation.copy(baseMesh.rotation);
      shellMesh.scale.copy(baseMesh.scale);
      shellMesh.receiveShadow = l <= 2;
      parent.add(shellMesh);
    }
  };

  const headBaseMat = makeBaseFurMat(headTex, 0.88, 0.58);
  const torsoBaseMat = makeBaseFurMat(torsoTex, 0.84, 0.56);
  const leftLegBaseMat = makeBaseFurMat(leftLegTex, 0.86, 0.54);
  const rightLegBaseMat = makeBaseFurMat(rightLegTex, 0.86, 0.54);
  const tailMat = makeBaseFurMat(tailTex, 0.96, 0.68);
  const creamPawMat = makeBaseFurMat(creamFurTex, 0.95, 0.58);
  const tabbyEarMat = makeBaseFurMat(tabbyEarTex, 0.92, 0.62);
  const eyelidMat = makeBaseFurMat(eyelidFurTex, 0.92, 0.45);

  const noseMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: palette.nosePink,
      roughness: 0.42,
      metalness: 0.0,
      clearcoat: 0.38,
      clearcoatRoughness: 0.28,
    }),
  );

  const innerEarMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: palette.earPink,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.32,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color('#e6c9c8'),
    }),
  );

  const featureDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#1b1615',
      roughness: 0.48,
      metalness: 0.0,
    }),
  );

  const whiskerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f8f4ec',
      roughness: 0.42,
      transparent: true,
      opacity: 0.72,
    }),
  );

  const eyeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.08,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    }),
  );

  // --- Root Hierarchy ---
  const root = new THREE.Group();

  // --- Stage: Sleek Dark Slate Plinth + Heather-Grey Felt Cat Perch (Photo 3 inspired) ---
  const plinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0e1525',
      roughness: 0.6,
      metalness: 0.22,
    }),
  );
  const plinthMesh = new THREE.Mesh(
    trackGeom(new THREE.CylinderGeometry(1.08, 1.14, 0.075, 56)),
    plinthMat,
  );
  plinthMesh.position.y = -0.258;
  plinthMesh.receiveShadow = true;
  root.add(plinthMesh);

  const accentRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.16,
    }),
  );
  const accentRing = new THREE.Mesh(
    trackGeom(new THREE.TorusGeometry(1.085, 0.005, 10, 72)),
    accentRingMat,
  );
  accentRing.rotation.x = Math.PI / 2;
  accentRing.position.y = -0.222;
  root.add(accentRing);

  const perchMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: perchTex,
      bumpMap: furBump,
      bumpScale: 0.008,
      roughness: 0.94,
      metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color('#8e96a8'),
    }),
  );
  const perchMesh = new THREE.Mesh(trackGeom(createFeltPerchGeometry()), perchMat);
  perchMesh.receiveShadow = true;
  perchMesh.castShadow = true;
  root.add(perchMesh);

  // Subtle felt seam trim around perch edge
  const pipingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#464f61',
      roughness: 0.84,
      metalness: 0.0,
    }),
  );
  const pipingMesh = new THREE.Mesh(
    trackGeom(new THREE.TorusGeometry(0.985, 0.013, 12, 64)),
    pipingMat,
  );
  pipingMesh.rotation.x = Math.PI / 2;
  pipingMesh.position.y = -0.105;
  root.add(pipingMesh);

  // Soft contact AO shadow right beneath the cat on the felt perch
  const contactShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  const contactShadow = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(1.38, 1.38)),
    contactShadowMat,
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.006, 0.04);
  root.add(contactShadow);

  // --- Cat Assembly ---
  const catRoot = new THREE.Group();
  catRoot.position.set(0, -0.01, -0.04);
  root.add(catRoot);

  const bodyGroup = new THREE.Group();
  catRoot.add(bodyGroup);

  // 1. Unified Anatomical Seated Pear Body + 6-Layer Lengyel Volumetric Fur
  const torsoData = createSeatedTorsoGeometry();
  const torsoMesh = new THREE.Mesh(trackGeom(torsoData.geometry), torsoBaseMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  tagPettable(torsoMesh, 'back');
  bodyGroup.add(torsoMesh);
  attachVolumetricFur(bodyGroup, torsoMesh, torsoTex, 6, 0.026, 0.009, torsoData.furWeights);

  // 2. Full-Length Anatomical Curved Forelegs seamlessly anchored into rounded shoulders (Photo 3!)
  const leftLegMesh = new THREE.Mesh(
    trackGeom(createAnatomicalForelegGeometry(1)),
    leftLegBaseMat,
  );
  leftLegMesh.position.set(0.105, 0.036, 0.282);
  leftLegMesh.castShadow = true;
  leftLegMesh.receiveShadow = true;
  tagPettable(leftLegMesh, 'chin');
  bodyGroup.add(leftLegMesh);
  attachVolumetricFur(bodyGroup, leftLegMesh, leftLegTex, 4, 0.014, 0.005);

  const rightLegMesh = new THREE.Mesh(
    trackGeom(createAnatomicalForelegGeometry(-1)),
    rightLegBaseMat,
  );
  rightLegMesh.position.set(-0.105, 0.036, 0.282);
  rightLegMesh.castShadow = true;
  rightLegMesh.receiveShadow = true;
  tagPettable(rightLegMesh, 'chin');
  bodyGroup.add(rightLegMesh);
  attachVolumetricFur(bodyGroup, rightLegMesh, rightLegTex, 4, 0.014, 0.005);

  // Sleek realistic rounded feline paws (no bulbous cartoon toes)
  const pawGeom = trackGeom(new THREE.SphereGeometry(0.080, 22, 16));
  const pawToeGeom = trackGeom(new THREE.SphereGeometry(0.024, 12, 10));

  const createNaturalPaw = (isFront: boolean): THREE.Group => {
    const paw = new THREE.Group();
    const body = new THREE.Mesh(pawGeom, creamPawMat);
    body.scale.set(0.92, 0.50, isFront ? 1.32 : 1.15);
    body.castShadow = true;
    body.receiveShadow = true;
    paw.add(body);

    for (const tx of [-0.03, 0, 0.03]) {
      const toe = new THREE.Mesh(pawToeGeom, creamPawMat);
      toe.scale.set(0.96, 0.72, 1.35);
      toe.position.set(tx, -0.01, isFront ? 0.07 : 0.06);
      toe.castShadow = true;
      paw.add(toe);
    }
    return paw;
  };

  const leftFrontPawPivot = new THREE.Group();
  leftFrontPawPivot.position.set(0.103, 0.036, 0.328);
  leftFrontPawPivot.rotation.y = 0.06;
  leftFrontPawPivot.add(createNaturalPaw(true));
  bodyGroup.add(leftFrontPawPivot);

  const rightFrontPawPivot = new THREE.Group();
  rightFrontPawPivot.position.set(-0.103, 0.036, 0.328);
  rightFrontPawPivot.rotation.y = -0.06;
  rightFrontPawPivot.add(createNaturalPaw(true));
  bodyGroup.add(rightFrontPawPivot);

  // Subtle tucked hind paws nestled snugly beneath the lower haunches
  const leftBackPaw = createNaturalPaw(false);
  leftBackPaw.position.set(0.28, 0.034, 0.06);
  leftBackPaw.rotation.y = 0.42;
  bodyGroup.add(leftBackPaw);

  const rightBackPaw = createNaturalPaw(false);
  rightBackPaw.position.set(-0.28, 0.034, 0.06);
  rightBackPaw.rotation.y = -0.42;
  bodyGroup.add(rightBackPaw);

  // 3. Articulated Anatomical Head Pivot (seated naturally over the plush white neck)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.94, 0.11);
  bodyGroup.add(headPivot);

  const headCenter = new THREE.Group();
  headCenter.position.set(0, 0.195, 0.045);
  headPivot.add(headCenter);

  // Unified sculpted feline cranium + eye sockets + snout + 5-Layer Volumetric Fur
  const headData = createAnatomicalHeadGeometry();
  const headMesh = new THREE.Mesh(trackGeom(headData.geometry), headBaseMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  tagPettable(headMesh, 'head');
  headCenter.add(headMesh);
  attachVolumetricFur(headCenter, headMesh, headTex, 5, 0.015, 0.004, headData.furWeights);

  // Invisible chin hit target for ergonomic chin-scratch detection
  const chinHitProxy = new THREE.Mesh(
    trackGeom(new THREE.SphereGeometry(0.13, 12, 10)),
    trackMat(new THREE.MeshBasicMaterial({ visible: false })),
  );
  chinHitProxy.position.set(0, -0.085, 0.25);
  tagPettable(chinHitProxy, 'chin');
  headCenter.add(chinHitProxy);

  // Realistic dark espresso-chocolate sculpted feline nose leather embedded flush on the snout tip
  const noseGeom = trackGeom(new THREE.SphereGeometry(0.025, 18, 14));
  const nosePos = noseGeom.attributes.position;
  for (let i = 0; i < nosePos.count; i++) {
    let x = nosePos.getX(i);
    const y = nosePos.getY(i);
    const z = nosePos.getZ(i);
    const t = (y / 0.025 + 1) * 0.5;
    x *= 0.58 + t * 0.72;
    nosePos.setXYZ(i, x, y * 0.68, z * 0.58);
  }
  noseGeom.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeom, noseMat);
  noseMesh.position.set(0, -0.045, 0.343);
  tagPettable(noseMesh, 'chin');
  headCenter.add(noseMesh);

  // Subtle realistic feline mouth cleft (delicate & understated — NOT a thick cartoon :3 wire!)
  const makeLipLine = (sign: 1 | -1): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.058, 0.338),
      new THREE.Vector3(sign * 0.011, -0.076, 0.336),
      new THREE.Vector3(sign * 0.036, -0.087, 0.326),
      new THREE.Vector3(sign * 0.062, -0.082, 0.310),
    ]);
    return new THREE.Mesh(
      trackGeom(new THREE.TubeGeometry(curve, 12, 0.0028, 6, false)),
      featureDarkMat,
    );
  };
  headCenter.add(makeLipLine(1));
  headCenter.add(makeLipLine(-1));

  // Ultra-fine natural drooping white feline whiskers (5 per cheek + 2 tiny brow hairs)
  const addWhisker = (
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    radius: number,
  ) => {
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    const whisker = new THREE.Mesh(
      trackGeom(new THREE.TubeGeometry(curve, 10, radius, 5, false)),
      whiskerMat,
    );
    headCenter.add(whisker);
  };

  for (const sign of [1, -1] as const) {
    addWhisker(
      new THREE.Vector3(sign * 0.068, -0.056, 0.312),
      new THREE.Vector3(sign * 0.19, -0.054, 0.292),
      new THREE.Vector3(sign * 0.33, -0.078, 0.235),
      0.0014,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.072, -0.066, 0.314),
      new THREE.Vector3(sign * 0.21, -0.068, 0.288),
      new THREE.Vector3(sign * 0.365, -0.104, 0.222),
      0.0016,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.070, -0.076, 0.310),
      new THREE.Vector3(sign * 0.215, -0.090, 0.282),
      new THREE.Vector3(sign * 0.365, -0.135, 0.212),
      0.0016,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.064, -0.086, 0.302),
      new THREE.Vector3(sign * 0.19, -0.112, 0.275),
      new THREE.Vector3(sign * 0.32, -0.162, 0.210),
      0.0014,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.058, -0.094, 0.294),
      new THREE.Vector3(sign * 0.16, -0.128, 0.268),
      new THREE.Vector3(sign * 0.265, -0.175, 0.215),
      0.0012,
    );
  }

  // --- Recessed Glossy Eyes with Real Animated Furry Upper & Lower Eyelids ---
  const eyeballGeom = trackGeom(new THREE.SphereGeometry(0.059, 28, 22));
  const upperLidGeom = trackGeom(
    new THREE.SphereGeometry(0.064, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
  );
  const lowerLidGeom = trackGeom(
    new THREE.SphereGeometry(0.0635, 22, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
  );
  const lidRimGeom = trackGeom(new THREE.TorusGeometry(0.064, 0.0028, 8, 28));

  const buildRealisticEye = (sign: 1 | -1) => {
    const socket = new THREE.Group();
    socket.position.set(sign * 0.097, 0.016, 0.214);
    socket.rotation.set(-0.03, sign * 0.33, sign * 0.05);
    headCenter.add(socket);

    const eyeBallGroup = new THREE.Group();
    socket.add(eyeBallGroup);

    const eyeball = new THREE.Mesh(eyeballGeom, eyeMat);
    eyeball.scale.set(1.06, 0.98, 0.86);
    tagPettable(eyeball, 'head');
    eyeBallGroup.add(eyeball);

    // Animated furry upper eyelid (alert open at -0.82 -> soft blissful close at +0.12)
    const upperLid = new THREE.Group();
    const upperCap = new THREE.Mesh(upperLidGeom, eyelidMat);
    upperCap.scale.set(1.08, 0.99, 0.92);
    upperLid.add(upperCap);

    const upperRim = new THREE.Mesh(lidRimGeom, featureDarkMat);
    upperRim.rotation.x = Math.PI / 2;
    upperRim.scale.set(1.08, 0.92, 1.0);
    upperLid.add(upperRim);
    upperLid.rotation.x = -0.82;
    socket.add(upperLid);

    // Animated furry lower eyelid
    const lowerLid = new THREE.Group();
    const lowerCap = new THREE.Mesh(lowerLidGeom, eyelidMat);
    lowerCap.scale.set(1.07, 0.98, 0.91);
    lowerLid.add(lowerCap);

    const lowerRim = new THREE.Mesh(lidRimGeom, featureDarkMat);
    lowerRim.rotation.x = Math.PI / 2;
    lowerRim.scale.set(1.07, 0.91, 0.72);
    lowerLid.add(lowerRim);
    lowerLid.rotation.x = 0.78;
    socket.add(lowerLid);

    return { eyeBallGroup, upperLid, lowerLid };
  };

  const leftEye = buildRealisticEye(1);
  const rightEye = buildRealisticEye(-1);

  // --- Low-Set Wide-Base Domestic Shorthair Ears (embedded deeply into the upper skull like Candy!) ---
  const outerEarGeom = trackGeom(createSculptedEarGeometry());
  const innerEarGeom = trackGeom(createInnerEarGeometry());
  const earHairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ede5d6',
      roughness: 0.76,
      transparent: true,
      opacity: 0.82,
    }),
  );

  const buildEar = (sign: 1 | -1): THREE.Group => {
    const pivot = new THREE.Group();
    // Seated much lower & embedded deep into the upper-outer skull so the base blends seamlessly
    pivot.position.set(sign * 0.145, 0.098, -0.012);
    pivot.rotation.set(0.08, sign * 0.18, -sign * 0.42);
    headCenter.add(pivot);

    const outer = new THREE.Mesh(outerEarGeom, tabbyEarMat);
    outer.castShadow = true;
    outer.receiveShadow = true;
    tagPettable(outer, 'head');
    pivot.add(outer);
    attachVolumetricFur(pivot, outer, tabbyEarTex, 3, 0.007, 0.002);

    const inner = new THREE.Mesh(innerEarGeom, innerEarMat);
    tagPettable(inner, 'head');
    pivot.add(inner);

    // Soft pale cream inner-ear hair furnishings across the lower concave hollow
    for (let k = 0; k < 4; k++) {
      const yBase = 0.078 + k * 0.021;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-sign * 0.052, yBase, 0.022),
        new THREE.Vector3(-sign * 0.010, yBase + 0.009, 0.032),
        new THREE.Vector3(sign * 0.022, yBase + 0.016, 0.024),
      );
      const wisp = new THREE.Mesh(
        trackGeom(new THREE.TubeGeometry(curve, 7, 0.0022 - k * 0.0002, 5, false)),
        earHairMat,
      );
      pivot.add(wisp);
    }

    return pivot;
  };

  const leftEarPivot = buildEar(1);
  const rightEarPivot = buildEar(-1);

  // --- 4. Seamless Continuous Animated Ringed Tabico Tail ---
  const animatedTail = new SmoothAnimatedTail(tailMat);
  tagPettable(animatedTail.mesh, 'tail');
  bodyGroup.add(animatedTail.mesh);

  const dispose = () => {
    animatedTail.dispose();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
  };

  return {
    root,
    catRoot,
    bodyGroup,
    headPivot,
    leftEarPivot,
    rightEarPivot,
    leftEyeBall: leftEye.eyeBallGroup,
    rightEyeBall: rightEye.eyeBallGroup,
    leftUpperLid: leftEye.upperLid,
    rightUpperLid: rightEye.upperLid,
    leftLowerLid: leftEye.lowerLid,
    rightLowerLid: rightEye.lowerLid,
    leftFrontPawPivot,
    rightFrontPawPivot,
    pettableMeshes,
    updateTail: (dt, purrLevel, tailPlayPulse) =>
      animatedTail.update(dt, purrLevel, tailPlayPulse),
    dispose,
  };
}

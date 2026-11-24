import * as THREE from 'three';
import type { CalicoCoatPalette } from '../config/home.config';
import {
  createBlushTexture,
  createCatEyeTexture,
  createCushionFabricTexture,
  createFurBumpTexture,
  createFurShellAlphaTexture,
  createHeadCalicoTexture,
  createSolidFurTexture,
  createTailCalicoTexture,
  createTorsoCalicoTexture,
  createWhiskerPadTexture,
} from './calicoTextures';

export type PetZone = 'head' | 'chin' | 'back' | 'tail';

export interface CalicoCatRig {
  root: THREE.Group;
  catRoot: THREE.Group;
  bodyGroup: THREE.Group;
  headPivot: THREE.Group;
  leftEarPivot: THREE.Group;
  rightEarPivot: THREE.Group;
  leftEyePivot: THREE.Group;
  rightEyePivot: THREE.Group;
  leftOpenEye: THREE.Group;
  rightOpenEye: THREE.Group;
  leftSquintArc: THREE.Mesh;
  rightSquintArc: THREE.Mesh;
  leftBlushMat: THREE.MeshBasicMaterial;
  rightBlushMat: THREE.MeshBasicMaterial;
  leftFrontPawPivot: THREE.Group;
  rightFrontPawPivot: THREE.Group;
  pettableMeshes: THREE.Object3D[];
  updateTail: (time: number, purrLevel: number, tailPlayPulse: number) => void;
  dispose: () => void;
}

/**
 * Clones a geometry and extrudes vertices softly along their normals to form a lightweight
 * volumetric fur-tip shell (giving a plush fuzzy backlit hair edge along the silhouette).
 */
function createExtrudedFurShellGeometry(
  source: THREE.BufferGeometry,
  offset: number,
  gravityDroop = 0.003,
): THREE.BufferGeometry {
  const geom = source.clone();
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    pos.setXYZ(
      i,
      pos.getX(i) + nx * offset,
      pos.getY(i) + ny * offset - gravityDroop,
      pos.getZ(i) + nz * offset,
    );
  }
  pos.needsUpdate = true;
  return geom;
}

/** Creates a plush sculpted feline ear shell with natural domestic shorthair proportions. */
function createSculptedEarGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(1, 24, 20);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const t = (y + 1) * 0.5;
    // Natural domestic shorthair feline ears with softly rounded triangular tips
    const widthProfile =
      0.156 *
      (1 - 0.80 * Math.pow(t, 1.32)) *
      (0.74 + 0.26 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5));
    const depthProfile = 0.072 * (1 - 0.72 * Math.pow(t, 1.24));

    const nx = x * widthProfile;
    const ny = t * 0.305;
    let nz = z * depthProfile;

    // Gentle concave scoop on the front face (+Z) of the ear cup
    if (z > 0) {
      const centerMask = Math.max(0, 1 - x * x * 1.35) * Math.sin(t * Math.PI);
      nz -= centerMask * 0.032;
    }

    const tipCurveZ = Math.pow(t, 2) * 0.018;
    pos.setXYZ(i, nx, ny, nz + tipCurveZ);
  }

  geom.computeVertexNormals();
  return geom;
}

/** Creates a soft concave inner-ear pad nestled snugly inside the sculpted ear cup. */
function createInnerEarGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(1, 18, 14);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + 1) * 0.5;

    const widthProfile = 0.088 * (1 - 0.84 * Math.pow(t, 1.32));
    const depthProfile = 0.02 * (1 - 0.62 * t);
    const ny = 0.03 + t * 0.21;
    const nz = z * depthProfile + 0.022 + Math.pow(t, 2) * 0.014;
    pos.setXYZ(i, x * widthProfile, ny, nz);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a sculpted organic seated feline torso with cozy haunches, curved spine,
 * fluffy upper chest bib, gently recessed lower front for continuous front legs,
 * and a fuller plush neck transition seamlessly supporting the head.
 */
function createSeatedTorsoGeometry(): THREE.BufferGeometry {
  const profilePoints: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.24, 0.015),
    new THREE.Vector2(0.365, 0.11),
    new THREE.Vector2(0.402, 0.26),
    new THREE.Vector2(0.388, 0.44),
    new THREE.Vector2(0.352, 0.62),
    new THREE.Vector2(0.308, 0.78),
    new THREE.Vector2(0.275, 0.90),
    new THREE.Vector2(0.248, 1.00),
    new THREE.Vector2(0.001, 1.07),
  ];

  const geom = new THREE.LatheGeometry(profilePoints, 64);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    const t = Math.max(0, Math.min(1, y / 1.0));

    // Seated feline posture: rounded haunches sit slightly back, shoulders/neck lean gently forward
    const spineShiftZ = Math.sin((t - 0.36) * Math.PI) * 0.064 + (t - 0.34) * 0.11;
    const depthScale = 1.0 + 0.14 * Math.exp(-Math.pow((t - 0.26) / 0.28, 2));
    z = z * depthScale + spineShiftZ;

    // Tuck lower front belly slightly inward so the upright front legs sit cleanly in front
    if (z > 0.04 && t < 0.50) {
      const lowerFrontMask = Math.sin((t / 0.50) * Math.PI) * Math.min(1, z / 0.32);
      z -= lowerFrontMask * 0.072;
    }

    // Soft plush upper chest bib & throat ruff on upper front (+Z)
    if (z > 0.06 && t > 0.46) {
      const bibMask = Math.exp(-Math.pow((t - 0.72) / 0.22, 2)) * Math.min(1, z / 0.28);
      z += bibMask * 0.056;
    }

    x *= 1.0 - 0.04 * t;
    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a more naturalistic domestic shorthair feline head with subtle cheekbones,
 * soft brow ridge, gentle forward snout taper, and cozy lower cheek fluff.
 */
function createSculptedHeadGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(0.355, 64, 48);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Realistic plump-cheeked domestic shorthair proportions
    x *= 1.13;
    y *= 0.93;
    z *= 0.99;

    // Subtle feline cheek ruff tufts on lower sides (softer & more natural than a wide saucer)
    const cheekVert = Math.exp(-Math.pow((y + 0.07) / 0.125, 2));
    const cheekSide = Math.max(0, (Math.abs(x) - 0.15) / 0.25);
    x *= 1 + cheekVert * cheekSide * 0.085;

    // Gently tapered jaw & chin
    if (y < -0.13) {
      const chinT = Math.min(1, (-0.13 - y) / 0.20);
      x *= 1 - chinT * 0.15;
    }

    // Natural feline forward muzzle / nose bridge contour facing +Z
    if (z > 0.08) {
      const bridgeMask =
        Math.exp(-Math.pow(x / 0.105, 2)) *
        Math.exp(-Math.pow((y + 0.03) / 0.14, 2));
      z += bridgeMask * 0.046;

      // Subtle brow ridge above eyes for authentic expressive feline gaze
      const browMask =
        Math.exp(-Math.pow((Math.abs(x) - 0.13) / 0.095, 2)) *
        Math.exp(-Math.pow((y - 0.11) / 0.065, 2));
      z += browMask * 0.018;
    }

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/** Creates a smooth full-length seated front leg descending gracefully from shoulder to wrist. */
function createFrontLegGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.064, 0.015),
    new THREE.Vector2(0.066, 0.14),
    new THREE.Vector2(0.074, 0.30),
    new THREE.Vector2(0.088, 0.46),
    new THREE.Vector2(0.102, 0.58),
    new THREE.Vector2(0.086, 0.65),
    new THREE.Vector2(0.001, 0.68),
  ];
  const geom = new THREE.LatheGeometry(points, 24);
  geom.computeVertexNormals();
  return geom;
}

/** Creates a soft tufted round cat cushion with subtle radial lobes and a seated center dip. */
function createTuftedCushionGeometry(): THREE.BufferGeometry {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -0.22),
    new THREE.Vector2(0.76, -0.22),
    new THREE.Vector2(0.90, -0.185),
    new THREE.Vector2(0.96, -0.11),
    new THREE.Vector2(0.92, -0.025),
    new THREE.Vector2(0.74, 0.032),
    new THREE.Vector2(0.46, 0.015),
    new THREE.Vector2(0.18, -0.018),
    new THREE.Vector2(0.001, -0.024),
  ];

  const geom = new THREE.LatheGeometry(profile, 64);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.12) {
      const ang = Math.atan2(z, x);
      const lobeMask = Math.min(1, r / 0.85) * Math.max(0, 1 - Math.abs(y + 0.08) / 0.16);
      const puff = 1 + Math.cos(ang * 6) * 0.022 * lobeMask;
      pos.setXYZ(i, x * puff, y + Math.cos(ang * 6) * 0.006 * lobeMask, z * puff);
    }
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Single continuous smooth procedural tail mesh driven by an animated CatmullRomCurve3.
 * Eliminates all segment seams and polygon kinks while deforming in-place with zero per-frame allocations.
 */
class SmoothAnimatedTail {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly lengthSegs = 34;
  private readonly radialSegs = 16;
  private readonly controlPoints: THREE.Vector3[] = [];
  private readonly curve: THREE.CatmullRomCurve3;

  // Reusable scratch vectors for zero-GC per-frame updates
  private readonly pt = new THREE.Vector3();
  private readonly tan = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly binormal = new THREE.Vector3();
  private readonly prevTan = new THREE.Vector3();
  private readonly rotAxis = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly refUp = new THREE.Vector3(0, 1, 0);

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
        indices.push(a, b, d);
        indices.push(b, c, d);
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
    // Closed rounded base & softly rounded hemispherical tip (zero hollow ends from any orbit angle)
    const baseBody = 0.064 + 0.018 * Math.sin(t * Math.PI * 0.85);
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

  update(time: number, purrLevel: number, tailPlayPulse: number): void {
    const speed = 1.7 + purrLevel * 1.4 + tailPlayPulse * 3.2;
    const swayAmp = 0.075 + purrLevel * 0.065 + tailPlayPulse * 0.14;
    const happyLift = purrLevel * 0.22;

    const w1 = Math.sin(time * speed - 0.4) * swayAmp;
    const w2 = Math.sin(time * speed - 1.1) * swayAmp * 1.35;
    const w3 = Math.sin(time * speed - 1.9) * swayAmp * 1.65;
    const tipBob = Math.cos(time * speed * 0.85 - 1.5) * swayAmp * 0.7;

    // Smooth S-curve anchored cleanly inside the lower rump and exiting rearward (zero rump-shell grazing)
    this.controlPoints[0].set(0.0, 0.16, -0.22);
    this.controlPoints[1].set(0.05, 0.15, -0.47);
    this.controlPoints[2].set(0.36 + w1 * 0.6, 0.24 + happyLift * 0.3, -0.52 + w1 * 0.3);
    this.controlPoints[3].set(0.60 + w2 * 0.8, 0.40 + happyLift * 0.75, -0.35 + w2 * 0.4);
    this.controlPoints[4].set(0.70 + w3 * 0.95, 0.57 + happyLift * 1.15 + tipBob * 0.5, -0.14 + w3 * 0.5);
    this.controlPoints[5].set(0.65 + w3 * 1.15, 0.72 + happyLift * 1.35 + tipBob, 0.03 + w3 * 0.65);

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const rings = this.lengthSegs + 1;
    const cols = this.radialSegs + 1;

    for (let i = 0; i < rings; i++) {
      const t = i / this.lengthSegs;
      this.curve.getPoint(t, this.pt);
      this.curve.getTangent(t, this.tan).normalize();

      if (i === 0) {
        // Initial twist-free orthonormal frame
        this.normal.crossVectors(this.refUp, this.tan);
        if (this.normal.lengthSq() < 1e-4) {
          this.normal.set(1, 0, 0);
        } else {
          this.normal.normalize();
        }
        this.binormal.crossVectors(this.tan, this.normal).normalize();
      } else {
        // Parallel-transport frame along the curve (eliminates Frenet flips)
        this.rotAxis.crossVectors(this.prevTan, this.tan);
        const sinA = this.rotAxis.length();
        if (sinA > 1e-5) {
          this.rotAxis.divideScalar(sinA);
          const cosA = Math.max(-1, Math.min(1, this.prevTan.dot(this.tan)));
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
 * Builds the complete sculpted 3D calico cat, cozy cushion stage, articulated rig pivots,
 * smooth vertex-deformed calico tail, and tagged raycast targets.
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

  // --- Procedural Tabico & Stage Textures ---
  const furBump = trackTex(createFurBumpTexture());
  const furShellAlphaInner = trackTex(createFurShellAlphaTexture(0.46));
  const furShellAlphaOuter = trackTex(createFurShellAlphaTexture(0.64));
  const headTex = trackTex(createHeadCalicoTexture(palette));
  const torsoTex = trackTex(createTorsoCalicoTexture(palette));
  const tailTex = trackTex(createTailCalicoTexture(palette));
  const creamFurTex = trackTex(createSolidFurTexture(palette, 'cream'));
  const tabbyEarTex = trackTex(createSolidFurTexture(palette, 'tabbyEar'));
  const leftHaunchTex = trackTex(createSolidFurTexture(palette, 'leftHaunchTabico'));
  const rightHaunchTex = trackTex(createSolidFurTexture(palette, 'rightHaunchTabico'));
  const leftWhiskerPadTex = trackTex(createWhiskerPadTexture(palette, 'left'));
  const rightWhiskerPadTex = trackTex(createWhiskerPadTexture(palette, 'right'));
  const eyeTex = trackTex(createCatEyeTexture(palette));
  const cushionTex = trackTex(createCushionFabricTexture(palette));
  const blushTex = trackTex(createBlushTexture());

  const sheenTint = new THREE.Color('#fff1de');

  const makeFurMat = (map: THREE.CanvasTexture, sheenStrength = 0.62): THREE.MeshPhysicalMaterial =>
    trackMat(
      new THREE.MeshPhysicalMaterial({
        map,
        bumpMap: furBump,
        bumpScale: 0.015,
        roughness: 0.88,
        metalness: 0.0,
        sheen: sheenStrength,
        sheenRoughness: 0.56,
        sheenColor: sheenTint,
      }),
    );

  const makeFurShellMat = (
    map: THREE.CanvasTexture,
    alphaMap: THREE.CanvasTexture,
    opacity: number,
  ): THREE.MeshPhysicalMaterial =>
    trackMat(
      new THREE.MeshPhysicalMaterial({
        map,
        alphaMap,
        transparent: true,
        opacity,
        alphaTest: 0.08,
        depthWrite: false,
        roughness: 0.9,
        metalness: 0.0,
        sheen: 0.82,
        sheenRoughness: 0.48,
        sheenColor: sheenTint,
      }),
    );

  /** Wraps a primary fur mesh with two ultra-subtle fuzzy hair-tip shells for a plush realistic silhouette. */
  const attachFurShells = (
    parent: THREE.Object3D,
    baseMesh: THREE.Mesh,
    map: THREE.CanvasTexture,
    scaleInner = 0.008,
    scaleOuter = 0.015,
  ) => {
    const innerShell = new THREE.Mesh(
      trackGeom(createExtrudedFurShellGeometry(baseMesh.geometry, scaleInner, 0.0025)),
      makeFurShellMat(map, furShellAlphaInner, 0.72),
    );
    innerShell.position.copy(baseMesh.position);
    innerShell.rotation.copy(baseMesh.rotation);
    innerShell.scale.copy(baseMesh.scale);
    parent.add(innerShell);

    const outerShell = new THREE.Mesh(
      trackGeom(createExtrudedFurShellGeometry(baseMesh.geometry, scaleOuter, 0.0055)),
      makeFurShellMat(map, furShellAlphaOuter, 0.44),
    );
    outerShell.position.copy(baseMesh.position);
    outerShell.rotation.copy(baseMesh.rotation);
    outerShell.scale.copy(baseMesh.scale);
    parent.add(outerShell);
  };

  const headMat = makeFurMat(headTex, 0.64);
  const torsoMat = makeFurMat(torsoTex, 0.65);
  const tailMat = makeFurMat(tailTex, 0.68);
  const creamFurMat = makeFurMat(creamFurTex, 0.58);
  const tabbyEarMat = makeFurMat(tabbyEarTex, 0.66);
  const leftHaunchMat = makeFurMat(leftHaunchTex, 0.65);
  const rightHaunchMat = makeFurMat(rightHaunchTex, 0.65);
  const leftWhiskerPadMat = makeFurMat(leftWhiskerPadTex, 0.52);
  const rightWhiskerPadMat = makeFurMat(rightWhiskerPadTex, 0.52);

  const noseMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: palette.nosePink,
      roughness: 0.34,
      metalness: 0.0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    }),
  );

  const innerEarMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: palette.earPink,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color('#ffd9e0'),
    }),
  );

  const featureDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#251e22',
      roughness: 0.52,
      metalness: 0.0,
    }),
  );

  const whiskerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#fbf6ef',
      roughness: 0.45,
      transparent: true,
      opacity: 0.78,
    }),
  );

  const eyeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: eyeTex,
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    }),
  );

  // --- Root Hierarchy ---
  const root = new THREE.Group();

  // --- Stage: Sleek Dark Slate Plinth + Cozy Tufted Cushion ---
  const plinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0e1628',
      roughness: 0.55,
      metalness: 0.25,
    }),
  );
  const plinthMesh = new THREE.Mesh(
    trackGeom(new THREE.CylinderGeometry(1.06, 1.12, 0.075, 56)),
    plinthMat,
  );
  plinthMesh.position.y = -0.258;
  plinthMesh.receiveShadow = true;
  root.add(plinthMesh);

  const accentRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.24,
    }),
  );
  const accentRing = new THREE.Mesh(
    trackGeom(new THREE.TorusGeometry(1.065, 0.006, 10, 72)),
    accentRingMat,
  );
  accentRing.rotation.x = Math.PI / 2;
  accentRing.position.y = -0.222;
  root.add(accentRing);

  const cushionMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: cushionTex,
      bumpMap: furBump,
      bumpScale: 0.005,
      roughness: 0.9,
      metalness: 0.0,
      sheen: 0.5,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color('#6482ad'),
    }),
  );
  const cushionMesh = new THREE.Mesh(trackGeom(createTuftedCushionGeometry()), cushionMat);
  cushionMesh.receiveShadow = true;
  cushionMesh.castShadow = true;
  root.add(cushionMesh);

  const pipingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#324869',
      roughness: 0.72,
      metalness: 0.05,
    }),
  );
  const pipingMesh = new THREE.Mesh(
    trackGeom(new THREE.TorusGeometry(0.955, 0.015, 12, 64)),
    pipingMat,
  );
  pipingMesh.rotation.x = Math.PI / 2;
  pipingMesh.position.y = -0.105;
  root.add(pipingMesh);

  // --- Cat Assembly ---
  const catRoot = new THREE.Group();
  catRoot.position.set(0, -0.01, -0.04);
  root.add(catRoot);

  const bodyGroup = new THREE.Group();
  catRoot.add(bodyGroup);

  // 1. Seated Torso + soft volumetric fur shells
  const torsoMesh = new THREE.Mesh(trackGeom(createSeatedTorsoGeometry()), torsoMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  tagPettable(torsoMesh, 'back');
  bodyGroup.add(torsoMesh);
  attachFurShells(bodyGroup, torsoMesh, torsoTex, 0.009, 0.017);

  // Plush snowy-white chest ruff seamlessly bridging upper chest, shoulders & throat
  const chestFluff = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.24, 28, 22)), creamFurMat);
  chestFluff.scale.set(1.12, 1.18, 0.72);
  chestFluff.position.set(0, 0.79, 0.23);
  chestFluff.castShadow = true;
  tagPettable(chestFluff, 'chin');
  bodyGroup.add(chestFluff);
  attachFurShells(bodyGroup, chestFluff, creamFurTex, 0.007, 0.014);

  // 2. Seamlessly Tucked Hind Haunches + plush fur shells
  const haunchGeom = trackGeom(new THREE.SphereGeometry(0.24, 28, 22));
  const leftHaunch = new THREE.Mesh(haunchGeom, leftHaunchMat);
  leftHaunch.scale.set(0.78, 1.02, 1.34);
  leftHaunch.position.set(0.215, 0.225, -0.06);
  leftHaunch.rotation.set(0.16, 0.16, -0.06);
  leftHaunch.castShadow = true;
  leftHaunch.receiveShadow = true;
  tagPettable(leftHaunch, 'back');
  bodyGroup.add(leftHaunch);
  attachFurShells(bodyGroup, leftHaunch, leftHaunchTex, 0.008, 0.015);

  const rightHaunch = new THREE.Mesh(haunchGeom, rightHaunchMat);
  rightHaunch.scale.set(0.78, 1.02, 1.34);
  rightHaunch.position.set(-0.215, 0.225, -0.06);
  rightHaunch.rotation.set(0.16, -0.16, 0.06);
  rightHaunch.castShadow = true;
  rightHaunch.receiveShadow = true;
  tagPettable(rightHaunch, 'back');
  bodyGroup.add(rightHaunch);
  attachFurShells(bodyGroup, rightHaunch, rightHaunchTex, 0.008, 0.015);

  // 3. Full-Length Graceful Front Legs & Dainty White Mittens
  const frontLegGeom = trackGeom(createFrontLegGeometry());
  const pawBaseGeom = trackGeom(new THREE.SphereGeometry(0.084, 20, 16));
  const toeGeom = trackGeom(new THREE.SphereGeometry(0.031, 12, 10));

  const createPaw = (isFront: boolean): THREE.Group => {
    const paw = new THREE.Group();
    const pad = new THREE.Mesh(pawBaseGeom, creamFurMat);
    pad.scale.set(1.0, 0.56, isFront ? 1.24 : 1.14);
    pad.castShadow = true;
    pad.receiveShadow = true;
    paw.add(pad);

    const toeOffsets = [-0.04, 0, 0.04];
    for (const tx of toeOffsets) {
      const toe = new THREE.Mesh(toeGeom, creamFurMat);
      toe.scale.set(0.95, 0.78, 1.15);
      toe.position.set(tx, -0.008, isFront ? 0.08 : 0.07);
      toe.castShadow = true;
      paw.add(toe);
    }
    return paw;
  };

  // Full front legs positioned cleanly in front of the recessed lower chest
  const leftFrontLeg = new THREE.Mesh(frontLegGeom, creamFurMat);
  leftFrontLeg.position.set(0.115, 0.042, 0.345);
  leftFrontLeg.rotation.set(-0.15, 0, -0.04);
  leftFrontLeg.castShadow = true;
  leftFrontLeg.receiveShadow = true;
  tagPettable(leftFrontLeg, 'chin');
  bodyGroup.add(leftFrontLeg);

  const rightFrontLeg = new THREE.Mesh(frontLegGeom, creamFurMat);
  rightFrontLeg.position.set(-0.115, 0.042, 0.345);
  rightFrontLeg.rotation.set(-0.15, 0, 0.04);
  rightFrontLeg.castShadow = true;
  rightFrontLeg.receiveShadow = true;
  tagPettable(rightFrontLeg, 'chin');
  bodyGroup.add(rightFrontLeg);

  const leftFrontPawPivot = new THREE.Group();
  leftFrontPawPivot.position.set(0.112, 0.042, 0.388);
  leftFrontPawPivot.rotation.y = 0.07;
  leftFrontPawPivot.add(createPaw(true));
  bodyGroup.add(leftFrontPawPivot);

  const rightFrontPawPivot = new THREE.Group();
  rightFrontPawPivot.position.set(-0.112, 0.042, 0.388);
  rightFrontPawPivot.rotation.y = -0.07;
  rightFrontPawPivot.add(createPaw(true));
  bodyGroup.add(rightFrontPawPivot);

  // Back paws peeking neatly out below the tucked haunches
  const leftBackPaw = createPaw(false);
  leftBackPaw.position.set(0.285, 0.04, 0.145);
  leftBackPaw.rotation.y = 0.48;
  bodyGroup.add(leftBackPaw);

  const rightBackPaw = createPaw(false);
  rightBackPaw.position.set(-0.285, 0.04, 0.145);
  rightBackPaw.rotation.y = -0.48;
  bodyGroup.add(rightBackPaw);

  // 4. Articulated Head Pivot (seated seamlessly over the blended plush neck)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.90, 0.13);
  bodyGroup.add(headPivot);

  const headCenter = new THREE.Group();
  headCenter.position.set(0, 0.20, 0.03);
  headPivot.add(headCenter);

  const headMesh = new THREE.Mesh(trackGeom(createSculptedHeadGeometry()), headMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  tagPettable(headMesh, 'head');
  headCenter.add(headMesh);
  attachFurShells(headCenter, headMesh, headTex, 0.007, 0.014);

  // Soft blended whisker pads carrying the signature asymmetric brown/taupe mustache smudges
  const padGeom = trackGeom(new THREE.SphereGeometry(0.082, 22, 18));
  const leftWhiskerPad = new THREE.Mesh(padGeom, leftWhiskerPadMat);
  leftWhiskerPad.scale.set(0.98, 0.72, 0.72);
  leftWhiskerPad.position.set(0.056, -0.078, 0.324);
  leftWhiskerPad.castShadow = true;
  tagPettable(leftWhiskerPad, 'chin');
  headCenter.add(leftWhiskerPad);

  const rightWhiskerPad = new THREE.Mesh(padGeom, rightWhiskerPadMat);
  rightWhiskerPad.scale.set(0.98, 0.72, 0.72);
  rightWhiskerPad.position.set(-0.056, -0.078, 0.324);
  rightWhiskerPad.castShadow = true;
  tagPettable(rightWhiskerPad, 'chin');
  headCenter.add(rightWhiskerPad);

  const chinMesh = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.068, 18, 14)), creamFurMat);
  chinMesh.scale.set(0.94, 0.62, 0.78);
  chinMesh.position.set(0, -0.136, 0.298);
  tagPettable(chinMesh, 'chin');
  headCenter.add(chinMesh);

  // Realistic sculpted dark espresso-chocolate nose leather
  const noseGeom = trackGeom(new THREE.SphereGeometry(0.031, 18, 14));
  const nosePos = noseGeom.attributes.position;
  for (let i = 0; i < nosePos.count; i++) {
    let x = nosePos.getX(i);
    const y = nosePos.getY(i);
    const z = nosePos.getZ(i);
    const t = (y / 0.031 + 1) * 0.5;
    x *= 0.66 + t * 0.62;
    nosePos.setXYZ(i, x, y * 0.74, z * 0.68);
  }
  noseGeom.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeom, noseMat);
  noseMesh.position.set(0, -0.034, 0.382);
  tagPettable(noseMesh, 'chin');
  headCenter.add(noseMesh);

  // Delicate feline mouth curve tucked cleanly under the nose
  const makeSmileSide = (sign: 1 | -1): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.052, 0.382),
      new THREE.Vector3(sign * 0.012, -0.08, 0.384),
      new THREE.Vector3(sign * 0.048, -0.106, 0.376),
      new THREE.Vector3(sign * 0.086, -0.097, 0.362),
    ]);
    return new THREE.Mesh(
      trackGeom(new THREE.TubeGeometry(curve, 14, 0.0046, 8, false)),
      featureDarkMat,
    );
  };
  headCenter.add(makeSmileSide(1));
  headCenter.add(makeSmileSide(-1));

  // Fine natural multi-length feline cheek whiskers (5 slender drooping hairs per cheek)
  const addWhisker = (
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    radius = 0.0021,
  ) => {
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    const whisker = new THREE.Mesh(
      trackGeom(new THREE.TubeGeometry(curve, 10, radius, 6, false)),
      whiskerMat,
    );
    headCenter.add(whisker);
  };

  for (const sign of [1, -1] as const) {
    addWhisker(
      new THREE.Vector3(sign * 0.092, -0.056, 0.346),
      new THREE.Vector3(sign * 0.23, -0.048, 0.326),
      new THREE.Vector3(sign * 0.375, -0.068, 0.27),
      0.0019,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.096, -0.068, 0.348),
      new THREE.Vector3(sign * 0.255, -0.066, 0.324),
      new THREE.Vector3(sign * 0.425, -0.095, 0.255),
      0.0022,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.096, -0.081, 0.345),
      new THREE.Vector3(sign * 0.26, -0.092, 0.318),
      new THREE.Vector3(sign * 0.435, -0.132, 0.245),
      0.0022,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.088, -0.094, 0.338),
      new THREE.Vector3(sign * 0.23, -0.118, 0.312),
      new THREE.Vector3(sign * 0.38, -0.168, 0.242),
      0.0019,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.082, -0.104, 0.328),
      new THREE.Vector3(sign * 0.195, -0.138, 0.302),
      new THREE.Vector3(sign * 0.315, -0.186, 0.248),
      0.0016,
    );
  }

  // --- Expressive Almond-Framed Eyes (Luminous Celadon-Green Open Eyes + Happy ^ ^ Squint Arcs) ---
  const eyeballGeom = trackGeom(new THREE.SphereGeometry(0.077, 28, 22));
  const lashCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.076, 0.006, 0.028),
    new THREE.Vector3(0.004, 0.066, 0.052),
    new THREE.Vector3(0.078, 0.024, 0.022),
  );
  const lashGeom = trackGeom(new THREE.TubeGeometry(lashCurve, 16, 0.0085, 8, false));

  const lowerLidCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.070, -0.018, 0.025),
    new THREE.Vector3(0, -0.062, 0.047),
    new THREE.Vector3(0.070, -0.006, 0.025),
  );
  const lowerLidGeom = trackGeom(new THREE.TubeGeometry(lowerLidCurve, 14, 0.0042, 8, false));

  const squintCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.072, -0.014, 0.059),
    new THREE.Vector3(0, 0.047, 0.072),
    new THREE.Vector3(0.072, -0.014, 0.059),
  );
  const squintGeom = trackGeom(new THREE.TubeGeometry(squintCurve, 16, 0.0108, 10, false));

  const buildEyeAssembly = (sign: 1 | -1) => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(sign * 0.138, 0.026, 0.292);
    eyePivot.rotation.set(-0.04, sign * 0.33, sign * 0.05);
    headCenter.add(eyePivot);

    const openEye = new THREE.Group();
    eyePivot.add(openEye);

    const eyeball = new THREE.Mesh(eyeballGeom, eyeMat);
    eyeball.scale.set(1.06, 0.98, 0.72);
    tagPettable(eyeball, 'head');
    openEye.add(eyeball);

    const lash = new THREE.Mesh(lashGeom, featureDarkMat);
    if (sign === -1) lash.scale.x = -1;
    openEye.add(lash);

    const lowerLid = new THREE.Mesh(lowerLidGeom, featureDarkMat);
    if (sign === -1) lowerLid.scale.x = -1;
    openEye.add(lowerLid);

    const squintArc = new THREE.Mesh(squintGeom, featureDarkMat);
    squintArc.visible = false;
    eyePivot.add(squintArc);

    return { eyePivot, openEye, squintArc };
  };

  const leftEye = buildEyeAssembly(1);
  const rightEye = buildEyeAssembly(-1);

  // Rosy cheek blush decals fading in smoothly while purring
  const blushGeom = trackGeom(new THREE.PlaneGeometry(0.12, 0.078));
  const leftBlushMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: blushTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const rightBlushMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: blushTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );

  const leftBlush = new THREE.Mesh(blushGeom, leftBlushMat);
  leftBlush.position.set(0.218, -0.06, 0.282);
  leftBlush.rotation.set(0.08, 0.56, -0.06);
  headCenter.add(leftBlush);

  const rightBlush = new THREE.Mesh(blushGeom, rightBlushMat);
  rightBlush.position.set(-0.218, -0.06, 0.282);
  rightBlush.rotation.set(0.08, -0.56, 0.06);
  headCenter.add(rightBlush);

  // --- Articulated Pointed Tabico Ears with Delicate Pale Cream Inner Ear Furnishings ---
  const outerEarGeom = trackGeom(createSculptedEarGeometry());
  const innerEarGeom = trackGeom(createInnerEarGeometry());
  const earHairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#efe7d8',
      roughness: 0.75,
      transparent: true,
      opacity: 0.76,
    }),
  );

  const buildEar = (sign: 1 | -1, outerMat: THREE.Material): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.212, 0.215, 0.012);
    pivot.rotation.set(0.11, sign * 0.24, -sign * 0.43);
    headCenter.add(pivot);

    const outer = new THREE.Mesh(outerEarGeom, outerMat);
    outer.castShadow = true;
    outer.receiveShadow = true;
    tagPettable(outer, 'head');
    pivot.add(outer);

    const inner = new THREE.Mesh(innerEarGeom, innerEarMat);
    tagPettable(inner, 'head');
    pivot.add(inner);

    // Subtle wispy pale cream inner-ear hair furnishings (Photo 2 hallmark!)
    for (let k = 0; k < 4; k++) {
      const yBase = 0.045 + k * 0.032;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-sign * 0.058, yBase, 0.024),
        new THREE.Vector3(-sign * 0.012, yBase + 0.014, 0.036),
        new THREE.Vector3(sign * 0.022, yBase + 0.026, 0.028),
      );
      const wisp = new THREE.Mesh(
        trackGeom(new THREE.TubeGeometry(curve, 8, 0.0028 - k * 0.0003, 5, false)),
        earHairMat,
      );
      pivot.add(wisp);
    }

    return pivot;
  };

  const leftEarPivot = buildEar(1, tabbyEarMat);
  const rightEarPivot = buildEar(-1, tabbyEarMat);

  // --- 5. Seamless Continuous Animated Tricolor Calico Tail ---
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
    leftEyePivot: leftEye.eyePivot,
    rightEyePivot: rightEye.eyePivot,
    leftOpenEye: leftEye.openEye,
    rightOpenEye: rightEye.openEye,
    leftSquintArc: leftEye.squintArc,
    rightSquintArc: rightEye.squintArc,
    leftBlushMat,
    rightBlushMat,
    leftFrontPawPivot,
    rightFrontPawPivot,
    pettableMeshes,
    updateTail: (time, purrLevel, tailPlayPulse) =>
      animatedTail.update(time, purrLevel, tailPlayPulse),
    dispose,
  };
}

import * as THREE from 'three';
import type { CalicoCoatPalette } from '../config/home.config';
import {
  createBlushTexture,
  createCatEyeTexture,
  createCushionFabricTexture,
  createFurBumpTexture,
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

/** Creates a plush sculpted feline ear shell with a softly rounded tip and gentle front hollow. */
function createSculptedEarGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(1, 24, 20);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const t = (y + 1) * 0.5;
    // Sleek, slightly taller domestic shorthair feline ears matching the reference cat
    const widthProfile =
      0.152 *
      (1 - 0.84 * Math.pow(t, 1.28)) *
      (0.72 + 0.28 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5));
    const depthProfile = 0.074 * (1 - 0.72 * Math.pow(t, 1.22));

    const nx = x * widthProfile;
    const ny = t * 0.335;
    let nz = z * depthProfile;

    // Gentle concave scoop on the front face (+Z) of the ear cup
    if (z > 0) {
      const centerMask = Math.max(0, 1 - x * x * 1.35) * Math.sin(t * Math.PI);
      nz -= centerMask * 0.032;
    }

    const tipCurveZ = Math.pow(t, 2) * 0.02;
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

    const widthProfile = 0.088 * (1 - 0.86 * Math.pow(t, 1.3));
    const depthProfile = 0.02 * (1 - 0.62 * t);
    const ny = 0.03 + t * 0.235;
    const nz = z * depthProfile + 0.022 + Math.pow(t, 2) * 0.014;
    pos.setXYZ(i, x * widthProfile, ny, nz);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates a sculpted organic seated feline torso with cozy haunches, curved spine,
 * fluffy upper chest bib, gently recessed lower front for continuous front legs,
 * and a smooth tapered neck transition extending up into the skull.
 */
function createSeatedTorsoGeometry(): THREE.BufferGeometry {
  const profilePoints: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.24, 0.015),
    new THREE.Vector2(0.355, 0.11),
    new THREE.Vector2(0.388, 0.26),
    new THREE.Vector2(0.372, 0.44),
    new THREE.Vector2(0.335, 0.62),
    new THREE.Vector2(0.285, 0.78),
    new THREE.Vector2(0.245, 0.90),
    new THREE.Vector2(0.22, 1.00),
    new THREE.Vector2(0.001, 1.06),
  ];

  const geom = new THREE.LatheGeometry(profilePoints, 56);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    const t = Math.max(0, Math.min(1, y / 1.0));

    // Seated feline posture: rounded haunches sit slightly back, shoulders/neck lean gently forward
    const spineShiftZ = Math.sin((t - 0.36) * Math.PI) * 0.062 + (t - 0.34) * 0.11;
    const depthScale = 1.0 + 0.12 * Math.exp(-Math.pow((t - 0.26) / 0.26, 2));
    z = z * depthScale + spineShiftZ;

    // Tuck lower front belly slightly inward so the upright front legs sit cleanly in front
    if (z > 0.04 && t < 0.52) {
      const lowerFrontMask = Math.sin((t / 0.52) * Math.PI) * Math.min(1, z / 0.32);
      z -= lowerFrontMask * 0.075;
    }

    // Soft upper chest bib puff
    if (z > 0.06 && t > 0.48) {
      const bibMask = Math.exp(-Math.pow((t - 0.7) / 0.2, 2)) * Math.min(1, z / 0.28);
      z += bibMask * 0.05;
    }

    x *= 1.0 - 0.05 * t;
    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/** Creates a sculpted stylized feline head with plump lower cheeks, soft crown, and delicate nose bridge. */
function createSculptedHeadGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(0.355, 56, 42);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Adorable plump feline oval proportions
    x *= 1.15;
    y *= 0.95;
    z *= 0.98;

    // Soft lower cheek fluff tufts
    const cheekVert = Math.exp(-Math.pow((y + 0.065) / 0.125, 2));
    const cheekSide = Math.max(0, (Math.abs(x) - 0.15) / 0.26);
    x *= 1 + cheekVert * cheekSide * 0.1;

    // Softly tapered lower jaw/chin
    if (y < -0.14) {
      const chinT = Math.min(1, (-0.14 - y) / 0.2);
      x *= 1 - chinT * 0.12;
    }

    // Gentle nose bridge contour
    if (z > 0.1) {
      const bridgeMask =
        Math.exp(-Math.pow(x / 0.095, 2)) *
        Math.exp(-Math.pow((y + 0.01) / 0.13, 2));
      z += bridgeMask * 0.026;
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

    // Smooth S-curve anchored deeply inside the lower pelvis so the tail emerges organically with zero exposed cap
    this.controlPoints[0].set(0.0, 0.21, -0.06);
    this.controlPoints[1].set(0.08, 0.16, -0.34);
    this.controlPoints[2].set(0.38 + w1 * 0.6, 0.24 + happyLift * 0.3, -0.47 + w1 * 0.3);
    this.controlPoints[3].set(0.60 + w2 * 0.8, 0.40 + happyLift * 0.75, -0.33 + w2 * 0.4);
    this.controlPoints[4].set(0.70 + w3 * 0.95, 0.57 + happyLift * 1.15 + tipBob * 0.5, -0.13 + w3 * 0.5);
    this.controlPoints[5].set(0.65 + w3 * 1.15, 0.72 + happyLift * 1.35 + tipBob, 0.04 + w3 * 0.65);

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

  const makeFurMat = (map: THREE.CanvasTexture, sheenStrength = 0.42): THREE.MeshPhysicalMaterial =>
    trackMat(
      new THREE.MeshPhysicalMaterial({
        map,
        bumpMap: furBump,
        bumpScale: 0.006,
        roughness: 0.87,
        metalness: 0.0,
        sheen: sheenStrength,
        sheenRoughness: 0.68,
        sheenColor: sheenTint,
      }),
    );

  const headMat = makeFurMat(headTex, 0.46);
  const torsoMat = makeFurMat(torsoTex, 0.46);
  const tailMat = makeFurMat(tailTex, 0.5);
  const creamFurMat = makeFurMat(creamFurTex, 0.42);
  const tabbyEarMat = makeFurMat(tabbyEarTex, 0.52);
  const leftHaunchMat = makeFurMat(leftHaunchTex, 0.46);
  const rightHaunchMat = makeFurMat(rightHaunchTex, 0.48);
  const leftWhiskerPadMat = makeFurMat(leftWhiskerPadTex, 0.4);
  const rightWhiskerPadMat = makeFurMat(rightWhiskerPadTex, 0.4);

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

  // 1. Seated Torso
  const torsoMesh = new THREE.Mesh(trackGeom(createSeatedTorsoGeometry()), torsoMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  tagPettable(torsoMesh, 'back');
  bodyGroup.add(torsoMesh);

  // Plush snowy-white chest ruff seamlessly bridging upper chest & chin
  const chestFluff = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.21, 24, 18)), creamFurMat);
  chestFluff.scale.set(1.06, 1.15, 0.68);
  chestFluff.position.set(0, 0.74, 0.235);
  chestFluff.castShadow = true;
  tagPettable(chestFluff, 'chin');
  bodyGroup.add(chestFluff);

  // 2. Seamlessly Tucked Hind Haunches
  const haunchGeom = trackGeom(new THREE.SphereGeometry(0.24, 28, 22));
  const leftHaunch = new THREE.Mesh(haunchGeom, leftHaunchMat);
  leftHaunch.scale.set(0.76, 1.02, 1.32);
  leftHaunch.position.set(0.215, 0.225, -0.06);
  leftHaunch.rotation.set(0.16, 0.16, -0.06);
  leftHaunch.castShadow = true;
  leftHaunch.receiveShadow = true;
  tagPettable(leftHaunch, 'back');
  bodyGroup.add(leftHaunch);

  const rightHaunch = new THREE.Mesh(haunchGeom, rightHaunchMat);
  rightHaunch.scale.set(0.76, 1.02, 1.32);
  rightHaunch.position.set(-0.215, 0.225, -0.06);
  rightHaunch.rotation.set(0.16, -0.16, 0.06);
  rightHaunch.castShadow = true;
  rightHaunch.receiveShadow = true;
  tagPettable(rightHaunch, 'back');
  bodyGroup.add(rightHaunch);

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

  // 4. Articulated Head Pivot (seated seamlessly over the blended neck)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.90, 0.125);
  bodyGroup.add(headPivot);

  const headCenter = new THREE.Group();
  headCenter.position.set(0, 0.21, 0.03);
  headPivot.add(headCenter);

  const headMesh = new THREE.Mesh(trackGeom(createSculptedHeadGeometry()), headMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  tagPettable(headMesh, 'head');
  headCenter.add(headMesh);

  // Twin plump white whisker pads carrying the signature asymmetric brown/taupe mustache smudges
  const padGeom = trackGeom(new THREE.SphereGeometry(0.082, 20, 16));
  const leftWhiskerPad = new THREE.Mesh(padGeom, leftWhiskerPadMat);
  leftWhiskerPad.scale.set(0.96, 0.74, 0.78);
  leftWhiskerPad.position.set(0.056, -0.074, 0.308);
  leftWhiskerPad.castShadow = true;
  tagPettable(leftWhiskerPad, 'chin');
  headCenter.add(leftWhiskerPad);

  const rightWhiskerPad = new THREE.Mesh(padGeom, rightWhiskerPadMat);
  rightWhiskerPad.scale.set(0.96, 0.74, 0.78);
  rightWhiskerPad.position.set(-0.056, -0.074, 0.308);
  rightWhiskerPad.castShadow = true;
  tagPettable(rightWhiskerPad, 'chin');
  headCenter.add(rightWhiskerPad);

  const chinMesh = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.068, 18, 14)), creamFurMat);
  chinMesh.scale.set(0.95, 0.65, 0.8);
  chinMesh.position.set(0, -0.134, 0.284);
  tagPettable(chinMesh, 'chin');
  headCenter.add(chinMesh);

  // Cute sculpted soft pink nose
  const noseGeom = trackGeom(new THREE.SphereGeometry(0.032, 18, 14));
  const nosePos = noseGeom.attributes.position;
  for (let i = 0; i < nosePos.count; i++) {
    let x = nosePos.getX(i);
    const y = nosePos.getY(i);
    const z = nosePos.getZ(i);
    const t = (y / 0.032 + 1) * 0.5;
    x *= 0.68 + t * 0.58;
    nosePos.setXYZ(i, x, y * 0.78, z * 0.72);
  }
  noseGeom.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeom, noseMat);
  noseMesh.position.set(0, -0.03, 0.366);
  tagPettable(noseMesh, 'chin');
  headCenter.add(noseMesh);

  // Delicate :3 kitty smile curved under the nose
  const makeSmileSide = (sign: 1 | -1): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, 0.366),
      new THREE.Vector3(sign * 0.012, -0.078, 0.369),
      new THREE.Vector3(sign * 0.048, -0.105, 0.361),
      new THREE.Vector3(sign * 0.088, -0.096, 0.347),
    ]);
    return new THREE.Mesh(
      trackGeom(new THREE.TubeGeometry(curve, 14, 0.0052, 8, false)),
      featureDarkMat,
    );
  };
  headCenter.add(makeSmileSide(1));
  headCenter.add(makeSmileSide(-1));

  // Delicate slender curved feline cheek whiskers
  const addWhisker = (
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    radius = 0.0026,
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
      new THREE.Vector3(sign * 0.095, -0.058, 0.33),
      new THREE.Vector3(sign * 0.245, -0.05, 0.312),
      new THREE.Vector3(sign * 0.405, -0.064, 0.255),
      0.0026,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.098, -0.077, 0.328),
      new THREE.Vector3(sign * 0.255, -0.082, 0.302),
      new THREE.Vector3(sign * 0.425, -0.112, 0.235),
      0.0028,
    );
    addWhisker(
      new THREE.Vector3(sign * 0.09, -0.096, 0.318),
      new THREE.Vector3(sign * 0.225, -0.118, 0.292),
      new THREE.Vector3(sign * 0.365, -0.156, 0.225),
      0.0024,
    );
  }

  // --- Expressive Soulful Eyes (Luminous Open Eyes + Happy ^ ^ Squint Arcs) ---
  const eyeballGeom = trackGeom(new THREE.SphereGeometry(0.078, 26, 20));
  const lashCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.073, 0.018, 0.026),
    new THREE.Vector3(0, 0.081, 0.048),
    new THREE.Vector3(0.076, 0.014, 0.023),
  );
  const lashGeom = trackGeom(new THREE.TubeGeometry(lashCurve, 14, 0.0072, 8, false));

  const squintCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.072, -0.014, 0.059),
    new THREE.Vector3(0, 0.047, 0.072),
    new THREE.Vector3(0.072, -0.014, 0.059),
  );
  const squintGeom = trackGeom(new THREE.TubeGeometry(squintCurve, 16, 0.0108, 10, false));

  const buildEyeAssembly = (sign: 1 | -1) => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(sign * 0.136, 0.028, 0.28);
    eyePivot.rotation.set(-0.04, sign * 0.33, 0);
    headCenter.add(eyePivot);

    const openEye = new THREE.Group();
    eyePivot.add(openEye);

    const eyeball = new THREE.Mesh(eyeballGeom, eyeMat);
    eyeball.scale.set(1.0, 1.04, 0.72);
    tagPettable(eyeball, 'head');
    openEye.add(eyeball);

    const lash = new THREE.Mesh(lashGeom, featureDarkMat);
    if (sign === -1) lash.scale.x = -1;
    openEye.add(lash);

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

  // --- Articulated Pointed Tabico Ears (expressive slightly outward-angled brown-tabby ears) ---
  const outerEarGeom = trackGeom(createSculptedEarGeometry());
  const innerEarGeom = trackGeom(createInnerEarGeometry());

  const buildEar = (sign: 1 | -1, outerMat: THREE.Material): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.215, 0.218, 0.012);
    pivot.rotation.set(0.11, sign * 0.24, -sign * 0.45);
    headCenter.add(pivot);

    const outer = new THREE.Mesh(outerEarGeom, outerMat);
    outer.castShadow = true;
    outer.receiveShadow = true;
    tagPettable(outer, 'head');
    pivot.add(outer);

    const inner = new THREE.Mesh(innerEarGeom, innerEarMat);
    tagPettable(inner, 'head');
    pivot.add(inner);

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

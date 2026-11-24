import * as THREE from 'three';
import type { CalicoCoatPalette } from '../config/home.config';
import { buildCalicoCat, type CalicoCatRig, type PetZone } from './buildCalicoCat';
import { PetFeedbackSystem } from './petParticles';

export type CatMood = 'relaxed' | 'curious' | 'purring' | 'blissful';

export interface CatSceneStatus {
  mood: CatMood;
  isPetting: boolean;
  isOrbited: boolean;
  hasInteracted: boolean;
}

export interface CalicoCatSceneOptions {
  container: HTMLElement;
  palette: CalicoCoatPalette;
  onStatusChange?: (status: CatSceneStatus) => void;
}

const DEFAULT_YAW = 0.14;
const DEFAULT_PITCH = 0.20;
const LOOK_TARGET = new THREE.Vector3(0, 0.61, 0.04);

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Self-contained Three.js scene controller for the interactive /home/ calico cat.
 * Handles studio lighting, raycast stroke-to-pet interaction, turntable camera orbit,
 * spring-damped feline animation, pooled visual feedback, and clean resource disposal.
 */
export class CalicoCatScene {
  private readonly container: HTMLElement;
  private readonly onStatusChange?: (status: CatSceneStatus) => void;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly envRenderTarget: THREE.WebGLRenderTarget;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig: CalicoCatRig;
  private readonly feedback: PetFeedbackSystem;
  private readonly touchGlowLight: THREE.PointLight;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly scratchVec = new THREE.Vector3();

  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private elapsedTime = 0;
  private isVisible = true;
  private isDisposed = false;

  // Camera turntable orbit state
  private yaw = DEFAULT_YAW;
  private pitch = DEFAULT_PITCH;
  private targetYaw = DEFAULT_YAW;
  private targetPitch = DEFAULT_PITCH;
  private cameraDistance = 3.25;

  // Pointer & petting interaction state
  private dragMode: 'none' | 'pet' | 'orbit' = 'none';
  private activePointerId: number | null = null;
  private lastClientX = 0;
  private lastClientY = 0;
  private pointerDownTime = 0;
  private pointerMoveAccum = 0;
  private isHoveringCat = false;
  private hoveredPointerX = 0;
  private hoveredPointerY = 0;
  private hasPointerInCanvas = false;

  // Expressive feline animation state
  private purrLevel = 0;
  private activePetPulse = 0;
  private tailPlayPulse = 0;
  private activeZone: PetZone = 'head';
  private strokeLeanX = 0;
  private strokeLeanY = 0;
  private strokeParticleAccum = 0;
  private lastHitWorld = new THREE.Vector3(0, 1.15, 0.25);

  // Smoothed animation channels
  private headRotX = 0;
  private headRotY = 0;
  private headRotZ = 0;
  private eyeGazeX = 0;
  private eyeGazeY = 0;
  private squintAmount = 0;
  private earRelaxAmount = 0;
  private backArchAmount = 0;
  private glowIntensity = 0;

  // Blinking & ear-twitch timers
  private blinkTimer = 2.8;
  private blinkPhase = 0;
  private earTwitchTimer = 4.2;
  private earTwitchSide: 1 | -1 = 1;
  private earTwitchPhase = 0;

  // Discrete React HUD status tracking (zero per-frame React re-renders)
  private lastEmittedStatus: CatSceneStatus = {
    mood: 'relaxed',
    isPetting: false,
    isOrbited: false,
    hasInteracted: false,
  };
  private hasInteracted = false;

  constructor(options: CalicoCatSceneOptions) {
    this.container = options.container;
    this.onStatusChange = options.onStatusChange;

    this.scene = new THREE.Scene();

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 30);
    this.updateCameraDistanceForAspect(width / height);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.cursor = 'grab';
    canvas.setAttribute('aria-label', 'Interactive 3D calico cat — stroke to pet or drag outside to rotate');
    this.container.appendChild(canvas);

    // --- Lightweight Procedural Studio Environment (soft corneal & fur sheen reflections) ---
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#141c2f');
    const softboxTop = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: '#fff3e4', side: THREE.DoubleSide }),
    );
    softboxTop.position.set(2, 5, 3);
    softboxTop.lookAt(0, 0, 0);
    envScene.add(softboxTop);
    const softboxRim = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: '#7dd3fc', side: THREE.DoubleSide }),
    );
    softboxRim.position.set(-4, 2.5, -4);
    softboxRim.lookAt(0, 0, 0);
    envScene.add(softboxRim);
    this.envRenderTarget = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.42;
    softboxTop.geometry.dispose();
    (softboxTop.material as THREE.Material).dispose();
    softboxRim.geometry.dispose();
    (softboxRim.material as THREE.Material).dispose();
    pmrem.dispose();

    // --- Natural Daylight Window + Soft Rim Studio Lighting ---
    const hemiLight = new THREE.HemisphereLight('#e8f1ff', '#1b202e', 0.96);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fff8ef', 1.85);
    keyLight.position.set(2.4, 3.6, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 10.0;
    keyLight.shadow.camera.left = -1.8;
    keyLight.shadow.camera.right = 1.8;
    keyLight.shadow.camera.top = 2.0;
    keyLight.shadow.camera.bottom = -1.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.018;
    this.scene.add(keyLight);

    // Subtle cool skylight rim tracing the volumetric fur silhouette against dark slate
    const rimLight = new THREE.DirectionalLight('#93c5fd', 1.18);
    rimLight.position.set(-2.7, 2.3, -2.5);
    this.scene.add(rimLight);

    // Gentle warm front bounce so snowy chest fur & muzzle details stay crisp
    const fillLight = new THREE.PointLight('#f7e8d4', 0.44, 6, 1.4);
    fillLight.position.set(-1.3, 0.85, 2.1);
    this.scene.add(fillLight);

    // Subtle warm point light glowing softly beneath your hand while stroking
    this.touchGlowLight = new THREE.PointLight('#ffe0c2', 0, 1.35, 1.8);
    this.scene.add(this.touchGlowLight);

    // --- Build Sculpted Calico Cat & Feedback Pool ---
    this.rig = buildCalicoCat(options.palette);
    this.scene.add(this.rig.root);

    this.feedback = new PetFeedbackSystem(24, 4);
    this.scene.add(this.feedback.group);

    this.applyCameraTransform();

    // --- Event Listeners & Observers ---
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        this.isVisible = entry ? entry.isIntersecting : true;
        this.syncAnimationLoop();
      },
      { threshold: 0.05 },
    );
    this.intersectionObserver.observe(this.container);

    // Render initial frame immediately and begin smooth loop
    this.renderer.render(this.scene, this.camera);
    this.startLoop();
  }

  /** Smoothly resets the camera back to the welcoming front-3/4 angle. */
  resetView(): void {
    this.targetYaw = DEFAULT_YAW;
    this.targetPitch = DEFAULT_PITCH;
  }

  /** Programmatically triggers a gentle friendly pat (used by keyboard accessibility action). */
  triggerFriendlyPat(): void {
    this.hasInteracted = true;
    this.activeZone = 'head';
    this.purrLevel = Math.min(1, this.purrLevel + 0.42);
    this.activePetPulse = Math.max(this.activePetPulse, 0.85);
    this.strokeLeanX = (Math.random() - 0.5) * 0.45;
    this.strokeLeanY = 0.35;
    this.lastHitWorld.set(0, 1.38, 0.2);
    this.touchGlowLight.position.copy(this.lastHitWorld).add(new THREE.Vector3(0, 0.12, 0.2));
    this.feedback.emitAt(this.lastHitWorld, true);
    this.feedback.emitAt(this.lastHitWorld, false);
    this.emitStatusIfChanged();
  }

  private updateCameraDistanceForAspect(aspect: number): void {
    // Balanced portrait framing for realistic adult feline proportions on desktop & mobile
    this.cameraDistance = aspect < 1.15 ? 4.35 : 3.85;
  }

  private handleResize(): void {
    if (this.isDisposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.updateCameraDistanceForAspect(width / height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.applyCameraTransform();
  }

  private handleVisibilityChange = (): void => {
    this.syncAnimationLoop();
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.stopLoop();
  };

  private handleContextRestored = (): void => {
    if (!this.isDisposed) {
      this.syncAnimationLoop();
    }
  };

  private syncAnimationLoop(): void {
    if (this.isDisposed) return;
    if (this.isVisible && !document.hidden) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  private startLoop(): void {
    if (this.rafId !== null || this.isDisposed) return;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private updatePointerNdc(clientX: number, clientY: number): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.pointerNdc.set(nx, ny);
    this.hoveredPointerX = clamp(nx, -1, 1);
    this.hoveredPointerY = clamp(ny, -1, 1);
    return true;
  }

  private raycastCat(): { zone: PetZone; point: THREE.Vector3 } | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.rig.pettableMeshes, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    const zone = (hit.object.userData.petZone as PetZone | undefined) ?? 'back';
    return { zone, point: hit.point };
  }

  private applyPetStroke(
    zone: PetZone,
    hitPoint: THREE.Vector3,
    dx: number,
    dy: number,
    intensityScale: number,
  ): void {
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;

    this.hasInteracted = true;
    this.activeZone = zone;
    this.lastHitWorld.copy(hitPoint);

    const energy = Math.min(0.24, (dist / 120) * intensityScale);
    this.purrLevel = Math.min(1, this.purrLevel + energy);
    this.activePetPulse = Math.min(1, this.activePetPulse + energy * 3.1);

    if (zone === 'tail') {
      this.tailPlayPulse = Math.min(1, this.tailPlayPulse + energy * 3.5);
    }

    // Soft directional lean matching the user's hand stroke
    this.strokeLeanX = clamp(this.strokeLeanX + (dx / 120) * 0.45, -0.75, 0.75);
    this.strokeLeanY = clamp(this.strokeLeanY - (dy / 120) * 0.4, -0.6, 0.6);

    // Emit warm hearts / sparkles smoothly spaced along the stroke distance
    this.strokeParticleAccum += dist * intensityScale;
    const emitThreshold = this.purrLevel > 0.6 ? 42 : 60;
    if (this.strokeParticleAccum >= emitThreshold) {
      this.strokeParticleAccum = 0;
      const preferHeart = Math.random() < 0.72;
      this.feedback.emitAt(hitPoint, preferHeart);
    }

    this.emitStatusIfChanged();
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.isDisposed) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.hasPointerInCanvas = true;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    this.pointerDownTime = performance.now();
    this.pointerMoveAccum = 0;
    this.activePointerId = e.pointerId;

    if (!this.updatePointerNdc(e.clientX, e.clientY)) return;
    const hit = this.raycastCat();

    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events in tests may not register an active pointer ID
    }

    if (hit) {
      this.dragMode = 'pet';
      this.isHoveringCat = true;
      this.hasInteracted = true;
      this.activeZone = hit.zone;
      this.lastHitWorld.copy(hit.point);
      this.purrLevel = Math.min(1, this.purrLevel + 0.12);
      this.activePetPulse = Math.max(this.activePetPulse, 0.45);
      if (hit.zone === 'tail') {
        this.tailPlayPulse = Math.max(this.tailPlayPulse, 0.55);
      }
      this.renderer.domElement.style.cursor = 'pointer';
      this.emitStatusIfChanged();
    } else {
      this.dragMode = 'orbit';
      this.renderer.domElement.style.cursor = 'grabbing';
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.isDisposed) return;
    this.hasPointerInCanvas = true;

    const dx = e.clientX - this.lastClientX;
    const dy = e.clientY - this.lastClientY;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;

    if (this.dragMode === 'orbit' && this.activePointerId === e.pointerId) {
      this.targetYaw -= dx * 0.0085;
      this.targetPitch = clamp(this.targetPitch + dy * 0.0065, 0.02, 0.78);
      this.emitStatusIfChanged();
      return;
    }

    if (!this.updatePointerNdc(e.clientX, e.clientY)) return;
    const hit = this.raycastCat();

    if (this.dragMode === 'pet' && this.activePointerId === e.pointerId) {
      this.pointerMoveAccum += Math.hypot(dx, dy);
      if (hit) {
        this.isHoveringCat = true;
        this.applyPetStroke(hit.zone, hit.point, dx, dy, 1.15);
      } else {
        // Gentle forgiveness if stroke briefly skirts past the ear/head silhouette
        this.isHoveringCat = false;
      }
      return;
    }

    // Idle hover state on desktop: cursor tracks cat & gentle hover-stroking also pets!
    if (hit) {
      this.isHoveringCat = true;
      this.renderer.domElement.style.cursor = 'pointer';
      if (e.pointerType === 'mouse') {
        this.applyPetStroke(hit.zone, hit.point, dx, dy, 0.62);
      }
    } else {
      this.isHoveringCat = false;
      this.renderer.domElement.style.cursor = 'grab';
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.isDisposed) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    const wasQuickPat =
      this.dragMode === 'pet' &&
      performance.now() - this.pointerDownTime < 280 &&
      this.pointerMoveAccum < 14;

    if (wasQuickPat) {
      // Affectionate quick pat / nose boop reward
      this.purrLevel = Math.min(1, this.purrLevel + 0.24);
      this.activePetPulse = Math.max(this.activePetPulse, 0.78);
      this.feedback.emitAt(this.lastHitWorld, true);
    }

    try {
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic capture release errors
    }

    this.dragMode = 'none';
    this.activePointerId = null;
    this.renderer.domElement.style.cursor = this.isHoveringCat ? 'pointer' : 'grab';
    this.emitStatusIfChanged();
  };

  private handlePointerLeave = (): void => {
    if (this.dragMode === 'none') {
      this.hasPointerInCanvas = false;
      this.isHoveringCat = false;
      this.renderer.domElement.style.cursor = 'grab';
    }
  };

  private applyCameraTransform(): void {
    const cosPitch = Math.cos(this.pitch);
    const cx = LOOK_TARGET.x + Math.sin(this.yaw) * cosPitch * this.cameraDistance;
    const cy = LOOK_TARGET.y + Math.sin(this.pitch) * this.cameraDistance;
    const cz = LOOK_TARGET.z + Math.cos(this.yaw) * cosPitch * this.cameraDistance;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(LOOK_TARGET);
  }

  private computeMood(): CatMood {
    if (this.purrLevel >= 0.72) return 'blissful';
    if (this.purrLevel >= 0.24 || this.activePetPulse > 0.22) return 'purring';
    if (this.isHoveringCat) return 'curious';
    return 'relaxed';
  }

  private emitStatusIfChanged(): void {
    if (!this.onStatusChange) return;
    const mood = this.computeMood();
    const isPetting = this.dragMode === 'pet' || this.activePetPulse > 0.25;
    const isOrbited =
      Math.abs(this.targetYaw - DEFAULT_YAW) > 0.08 ||
      Math.abs(this.targetPitch - DEFAULT_PITCH) > 0.08;

    const prev = this.lastEmittedStatus;
    if (
      prev.mood !== mood ||
      prev.isPetting !== isPetting ||
      prev.isOrbited !== isOrbited ||
      prev.hasInteracted !== this.hasInteracted
    ) {
      this.lastEmittedStatus = {
        mood,
        isPetting,
        isOrbited,
        hasInteracted: this.hasInteracted,
      };
      this.onStatusChange(this.lastEmittedStatus);
    }
  }

  private tick = (now: number): void => {
    if (this.isDisposed) return;
    this.rafId = requestAnimationFrame(this.tick);

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    this.elapsedTime += dt;

    this.updateAnimation(dt);
    this.feedback.update(dt, this.purrLevel);
    this.renderer.render(this.scene, this.camera);
  };

  private updateAnimation(dt: number): void {
    const t = this.elapsedTime;

    // 1. Smoothly damp turntable camera orbit
    this.yaw = damp(this.yaw, this.targetYaw, 8.5, dt);
    this.pitch = damp(this.pitch, this.targetPitch, 8.5, dt);
    this.applyCameraTransform();

    // 2. Decay active petting pulses & purr energy naturally
    const isActivelyTouching = this.dragMode === 'pet' && this.isHoveringCat;
    const purrDecay = isActivelyTouching ? 0.06 : 0.22;
    this.purrLevel = Math.max(0, this.purrLevel - purrDecay * dt);
    this.activePetPulse = Math.max(0, this.activePetPulse - 1.35 * dt);
    this.tailPlayPulse = Math.max(0, this.tailPlayPulse - 1.5 * dt);
    this.strokeLeanX = damp(this.strokeLeanX, 0, 4.2, dt);
    this.strokeLeanY = damp(this.strokeLeanY, 0, 4.2, dt);

    // 3. Calm breathing + subtle cozy purr micro-vibration when happy
    const breathFreq = 2.0 + this.purrLevel * 1.15;
    const breathWave = Math.sin(t * breathFreq);
    const targetBackArch =
      this.activeZone === 'back' ? this.activePetPulse * 0.052 : this.purrLevel * 0.018;
    this.backArchAmount = damp(this.backArchAmount, targetBackArch, 7.5, dt);

    const purrJitter =
      this.purrLevel > 0.18 ? Math.sin(t * 46) * 0.0024 * this.purrLevel : 0;

    this.rig.bodyGroup.scale.set(
      1 + breathWave * 0.012 - this.backArchAmount * 0.35 + purrJitter,
      1 - breathWave * 0.009 + this.backArchAmount,
      1 + breathWave * 0.014 + purrJitter,
    );
    this.rig.bodyGroup.position.y = this.backArchAmount * 0.12;
    this.rig.bodyGroup.rotation.x = -this.backArchAmount * 0.65;

    // Subtle contented front-paw "biscuit kneading" micro-shifts while deeply purring
    if (this.purrLevel > 0.45) {
      const kneadAmt = (this.purrLevel - 0.45) / 0.55;
      const kneadWave = Math.sin(t * 4.2);
      this.rig.leftFrontPawPivot.position.y = 0.036 + Math.max(0, kneadWave) * 0.014 * kneadAmt;
      this.rig.rightFrontPawPivot.position.y = 0.036 + Math.max(0, -kneadWave) * 0.014 * kneadAmt;
    } else {
      this.rig.leftFrontPawPivot.position.y = damp(this.rig.leftFrontPawPivot.position.y, 0.036, 8, dt);
      this.rig.rightFrontPawPivot.position.y = damp(this.rig.rightFrontPawPivot.position.y, 0.036, 8, dt);
    }

    // 4. Expressive Head Tracking & Affectionate Petting Lean
    let targetHeadX = Math.sin(t * 0.85) * 0.025;
    let targetHeadY = Math.sin(t * 0.52) * 0.04;
    let targetHeadZ = Math.sin(t * 0.68) * 0.025;

    if (this.hasPointerInCanvas && this.dragMode !== 'orbit') {
      // Curious gaze following the pointer
      const followStrength = this.purrLevel > 0.5 ? 0.12 : 0.24;
      targetHeadY += this.hoveredPointerX * followStrength;
      targetHeadX += -this.hoveredPointerY * followStrength * 0.65;
    }

    if (this.activePetPulse > 0.05 || this.purrLevel > 0.25) {
      const p = Math.max(this.activePetPulse, this.purrLevel * 0.68);
      if (this.activeZone === 'chin') {
        // Lift chin blissfully upward for chin scratches
        targetHeadX = -0.26 * p + this.strokeLeanY * 0.12;
        targetHeadY += this.strokeLeanX * 0.22;
        targetHeadZ = -this.strokeLeanX * 0.22 + Math.sin(t * 2.6) * 0.06 * p;
      } else if (this.activeZone === 'head') {
        // Lean warmly upward/sideways into forehead & crown pets
        targetHeadX = -0.10 * p + this.strokeLeanY * 0.16;
        targetHeadY += this.strokeLeanX * 0.26;
        targetHeadZ = -this.strokeLeanX * 0.30 + Math.sin(t * 2.2) * 0.08 * p;
      } else if (this.activeZone === 'tail') {
        // Playful curious glance back toward its right-side tail
        targetHeadY += 0.34 * Math.max(this.tailPlayPulse, p * 0.6);
        targetHeadZ += -0.14 * Math.max(this.tailPlayPulse, p * 0.6);
      } else {
        // Back strokes: gentle happy head tilt & slight forward press
        targetHeadX = 0.05 * p + Math.sin(t * 2.0) * 0.03 * p;
        targetHeadZ = Math.sin(t * 1.9) * 0.11 * p - this.strokeLeanX * 0.16;
      }
    }

    this.headRotX = damp(this.headRotX, clamp(targetHeadX, -0.36, 0.28), 7.5, dt);
    this.headRotY = damp(this.headRotY, clamp(targetHeadY, -0.52, 0.52), 7.5, dt);
    this.headRotZ = damp(this.headRotZ, clamp(targetHeadZ, -0.34, 0.34), 7.5, dt);
    this.rig.headPivot.rotation.set(this.headRotX, this.headRotY, this.headRotZ);

    // 5. Realistic Animated Furry Eyelids: Calm Gaze, Natural Blinking & Blissful Feline Slow-Blink
    const targetSquint =
      this.purrLevel > 0.24 || this.activePetPulse > 0.32
        ? clamp((this.purrLevel - 0.14) * 1.35 + this.activePetPulse * 0.5, 0, 1)
        : 0;
    this.squintAmount = damp(this.squintAmount, targetSquint, 7.2, dt);

    // Periodic natural blink when awake
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.squintAmount < 0.35) {
      this.blinkPhase = 1.0;
      this.blinkTimer = 3.2 + Math.random() * 3.0;
    }
    if (this.blinkPhase > 0) {
      this.blinkPhase = Math.max(0, this.blinkPhase - dt * 6.5);
    }
    const blinkClose = this.blinkPhase > 0 ? Math.sin(this.blinkPhase * Math.PI) : 0;

    // Subtle iris gaze tracking toward pointer
    const targetGazeX = this.hasPointerInCanvas ? this.hoveredPointerX * 0.14 : 0;
    const targetGazeY = this.hasPointerInCanvas ? -this.hoveredPointerY * 0.09 : 0;
    this.eyeGazeX = damp(this.eyeGazeX, targetGazeX, 10, dt);
    this.eyeGazeY = damp(this.eyeGazeY, targetGazeY, 10, dt);

    this.rig.leftEyeBall.rotation.set(this.eyeGazeY, this.eyeGazeX, 0);
    this.rig.rightEyeBall.rotation.set(this.eyeGazeY, this.eyeGazeX, 0);

    // Upper eyelid sweeps smoothly from bright open (-0.82) -> soft closed (+0.14)
    // Lower eyelid gently lifts from open (+0.78) -> blissful closed smile (+0.18)
    const closeFactor = Math.max(blinkClose, this.squintAmount * 0.94);
    const upperLidRotX = -0.82 + closeFactor * 0.96;
    const lowerLidRotX = 0.78 - (this.squintAmount * 0.56 + blinkClose * 0.16);

    this.rig.leftUpperLid.rotation.x = upperLidRotX;
    this.rig.rightUpperLid.rotation.x = upperLidRotX;
    this.rig.leftLowerLid.rotation.x = lowerLidRotX;
    this.rig.rightLowerLid.rotation.x = lowerLidRotX;

    // 6. Articulated Ears: Natural Relaxed Tilt + Occasional Idle Ear Twitches
    this.earTwitchTimer -= dt;
    if (this.earTwitchTimer <= 0) {
      this.earTwitchPhase = 1.0;
      this.earTwitchSide = Math.random() < 0.5 ? 1 : -1;
      this.earTwitchTimer = 3.8 + Math.random() * 4.4;
    }
    if (this.earTwitchPhase > 0) {
      this.earTwitchPhase = Math.max(0, this.earTwitchPhase - dt * 5.2);
    }
    const earTwitch = this.earTwitchPhase > 0 ? Math.sin(this.earTwitchPhase * Math.PI * 2) * 0.15 : 0;

    const targetEarRelax =
      this.activeZone === 'head'
        ? Math.max(this.purrLevel * 0.72, this.activePetPulse * 0.92)
        : this.purrLevel * 0.48;
    this.earRelaxAmount = damp(this.earRelaxAmount, targetEarRelax, 8.0, dt);

    const curiousPerk = this.isHoveringCat && this.purrLevel < 0.25 ? 0.07 : 0;
    const leftTwitch = this.earTwitchSide === 1 ? earTwitch : 0;
    const rightTwitch = this.earTwitchSide === -1 ? earTwitch : 0;

    this.rig.leftEarPivot.rotation.set(
      0.08 - this.earRelaxAmount * 0.12 + curiousPerk,
      0.18 - this.earRelaxAmount * 0.14,
      -0.42 - this.earRelaxAmount * 0.24 + leftTwitch,
    );
    this.rig.rightEarPivot.rotation.set(
      0.08 - this.earRelaxAmount * 0.12 + curiousPerk,
      -0.18 + this.earRelaxAmount * 0.14,
      0.42 + this.earRelaxAmount * 0.24 - rightTwitch,
    );

    // 7. Continuous Smooth Procedural Tricolor Calico Tail Wave
    this.rig.updateTail(t, this.purrLevel, this.tailPlayPulse);

    // 8. Soft Warm Contact Glow Tracking Hand on Fur
    const targetGlow = isActivelyTouching || this.activePetPulse > 0.2 ? 0.26 : 0;
    this.glowIntensity = damp(this.glowIntensity, targetGlow, 9.0, dt);
    this.touchGlowLight.intensity = this.glowIntensity;
    if (this.glowIntensity > 0.01) {
      this.scratchVec.copy(this.lastHitWorld).add(new THREE.Vector3(0, 0.14, 0.26));
      this.touchGlowLight.position.lerp(this.scratchVec, 1 - Math.exp(-14 * dt));
    }

    // 9. Update discrete HUD mood if state crossed threshold
    this.emitStatusIfChanged();
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.stopLoop();

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerUp);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();

    this.rig.dispose();
    this.feedback.dispose();
    this.envRenderTarget.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}

import * as THREE from 'three';
import { createHeartParticleTexture, createSparkleParticleTexture } from './calicoTextures';

interface FloatingParticle {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  active: boolean;
  age: number;
  lifetime: number;
  baseScale: number;
  velocity: THREE.Vector3;
  swayFreq: number;
  swayAmp: number;
  swayPhase: number;
  originX: number;
  originZ: number;
}

interface PurrRipple {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  lifetime: number;
}

/**
 * Pooled, zero-allocation particle & purr-ripple visual feedback system.
 * Emits delicate floating hearts/sparkles along petting strokes and soft
 * concentric purr rings around the cushion when the cat is contentedly purring.
 */
export class PetFeedbackSystem {
  readonly group = new THREE.Group();

  private readonly particles: FloatingParticle[] = [];
  private readonly ripples: PurrRipple[] = [];
  private readonly heartTex: THREE.CanvasTexture;
  private readonly sparkleTex: THREE.CanvasTexture;
  private readonly rippleGeom: THREE.RingGeometry;
  private rippleCooldown = 0;

  constructor(maxParticles = 24, maxRipples = 4) {
    this.heartTex = createHeartParticleTexture();
    this.sparkleTex = createSparkleParticleTexture();

    for (let i = 0; i < maxParticles; i++) {
      const isHeart = i % 3 !== 2;
      const material = new THREE.SpriteMaterial({
        map: isHeart ? this.heartTex : this.sparkleTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      this.group.add(sprite);

      this.particles.push({
        sprite,
        material,
        active: false,
        age: 0,
        lifetime: 1.4,
        baseScale: isHeart ? 0.14 : 0.11,
        velocity: new THREE.Vector3(),
        swayFreq: 2.2,
        swayAmp: 0.06,
        swayPhase: 0,
        originX: 0,
        originZ: 0,
      });
    }

    // Soft glowing purr ripples lying horizontally on the cushion plane
    this.rippleGeom = new THREE.RingGeometry(0.46, 0.51, 56);
    for (let i = 0; i < maxRipples; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? '#fda4af' : '#7dd3fc',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.rippleGeom, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -0.19;
      mesh.visible = false;
      this.group.add(mesh);

      this.ripples.push({
        mesh,
        material,
        active: false,
        age: 0,
        lifetime: 1.75,
      });
    }
  }

  /** Spawns a subtle floating heart or sparkle near the 3D petting hit point. */
  emitAt(worldPos: THREE.Vector3, preferHeart = true): void {
    const startIdx = preferHeart ? 0 : 2;
    let slot: FloatingParticle | undefined;

    for (let offset = 0; offset < this.particles.length; offset++) {
      const idx = (startIdx + offset) % this.particles.length;
      const candidate = this.particles[idx];
      if (!candidate.active) {
        slot = candidate;
        break;
      }
    }

    if (!slot) return;

    slot.active = true;
    slot.age = 0;
    slot.lifetime = 1.15 + Math.random() * 0.55;
    slot.baseScale = (preferHeart ? 0.125 : 0.095) + Math.random() * 0.055;
    slot.swayFreq = 2.0 + Math.random() * 1.6;
    slot.swayAmp = 0.035 + Math.random() * 0.04;
    slot.swayPhase = Math.random() * Math.PI * 2;

    const ox = worldPos.x + (Math.random() - 0.5) * 0.14;
    const oy = worldPos.y + 0.08 + Math.random() * 0.08;
    const oz = worldPos.z + (Math.random() - 0.5) * 0.12;
    slot.originX = ox;
    slot.originZ = oz;
    slot.sprite.position.set(ox, oy, oz);
    slot.velocity.set(
      (Math.random() - 0.5) * 0.08,
      0.32 + Math.random() * 0.16,
      (Math.random() - 0.5) * 0.08,
    );
    slot.sprite.scale.setScalar(0.01);
    slot.material.opacity = 0;
    slot.sprite.visible = true;
  }

  private emitRipple(): void {
    const slot = this.ripples.find((r) => !r.active);
    if (!slot) return;
    slot.active = true;
    slot.age = 0;
    slot.lifetime = 1.65;
    slot.mesh.scale.setScalar(1.0);
    slot.material.opacity = 0;
    slot.mesh.visible = true;
  }

  update(dt: number, purrLevel: number): void {
    // Emit calm periodic purr aura ripples while the cat is blissfully purring
    this.rippleCooldown = Math.max(0, this.rippleCooldown - dt);
    if (purrLevel > 0.42 && this.rippleCooldown <= 0) {
      this.emitRipple();
      this.rippleCooldown = 0.95 - purrLevel * 0.32;
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.lifetime) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      const t = p.age / p.lifetime;
      const easeIn = Math.min(1, t / 0.18);
      const easeOut = 1 - Math.pow(Math.max(0, (t - 0.35) / 0.65), 1.6);

      p.sprite.position.y += p.velocity.y * dt;
      p.originX += p.velocity.x * dt;
      p.originZ += p.velocity.z * dt;
      const sway = Math.sin(p.age * p.swayFreq + p.swayPhase) * p.swayAmp;
      p.sprite.position.x = p.originX + sway;
      p.sprite.position.z = p.originZ + sway * 0.45;

      const scale = p.baseScale * (0.45 + 0.65 * easeIn) * (1 - t * 0.18);
      p.sprite.scale.setScalar(scale);
      p.material.opacity = easeIn * easeOut * 0.82;
    }

    for (const r of this.ripples) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.lifetime) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }

      const t = r.age / r.lifetime;
      const eased = 1 - Math.pow(1 - t, 2.2);
      r.mesh.scale.setScalar(1.15 + eased * 1.45);
      r.material.opacity = Math.sin(t * Math.PI) * 0.24;
    }
  }

  dispose(): void {
    this.heartTex.dispose();
    this.sparkleTex.dispose();
    this.rippleGeom.dispose();
    for (const p of this.particles) p.material.dispose();
    for (const r of this.ripples) r.material.dispose();
  }
}

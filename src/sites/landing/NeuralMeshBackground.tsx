import React, { useEffect, useRef } from 'react';

interface NeuralMeshBackgroundProps {
  /** Whether the dynamic physics and pulse animation is active. When false, renders a static constellation. */
  isAnimated: boolean;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  glow: number;
  radius: number;
}

interface Pulse {
  a: Node;
  b: Node;
  t: number;
  dur: number;
  hops: number;
  rgb: string;
}

interface MeshState {
  w: number;
  h: number;
  dpr: number;
  nodes: Node[];
  pulses: Pulse[];
  timer: number;
  maxD: number;
  mouse: { x: number; y: number; active: boolean };
  lastTime: number;
  rafId: number | null;
}

const CYAN = '34,211,238';
const MAGENTA = '232,121,249';
const INDIGO = '99,102,241';
const WHITE = '248,250,252';

const R = (min: number, max: number) => min + Math.random() * (max - min);
const RI = (min: number, max: number) => Math.floor(R(min, max + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  alpha: number
): void {
  if (r <= 0 || alpha <= 0) return;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},${alpha})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function getNeighbors(s: MeshState, node: Node, exclude?: Node): Node[] {
  return s.nodes.filter(
    (m) => m !== node && m !== exclude && Math.hypot(m.x - node.x, m.y - node.y) < s.maxD
  );
}

function firePulse(s: MeshState, a: Node, b: Node, hops = 4, speedMultiplier = 1.6): void {
  s.pulses.push({
    a,
    b,
    t: 0,
    dur: R(0.35, 0.6) / speedMultiplier,
    hops,
    rgb: Math.random() < 0.2 ? MAGENTA : CYAN,
  });
}

function initSimulation(s: MeshState): void {
  const nodeCount = Math.max(50, Math.min(115, Math.round((s.w * s.h) / 2800)));
  s.nodes = Array.from({ length: nodeCount }, () => ({
    x: R(0, s.w),
    y: R(0, s.h),
    vx: R(-15, 15),
    vy: R(-15, 15),
    glow: 0,
    radius: R(1.6, 2.6),
  }));
  s.pulses = [];
  s.timer = 0;
}

function drawConnectionFibers(
  ctx: CanvasRenderingContext2D,
  s: MeshState,
  maxAlpha: number,
  includeMouseTethers: boolean
): void {
  ctx.lineWidth = 1;
  for (let i = 0; i < s.nodes.length; i++) {
    const a = s.nodes[i];
    for (let j = i + 1; j < s.nodes.length; j++) {
      const b = s.nodes[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < s.maxD) {
        const alpha = (1 - d / s.maxD) * maxAlpha;
        ctx.strokeStyle = `rgba(${INDIGO},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    if (includeMouseTethers && s.mouse.active) {
      const dm = Math.hypot(a.x - s.mouse.x, a.y - s.mouse.y);
      if (dm < 140) {
        const intensity = 1 - dm / 140;
        ctx.strokeStyle = `rgba(${CYAN},${intensity * 0.75})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(s.mouse.x, s.mouse.y);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
  }
}

function stepSimulation(ctx: CanvasRenderingContext2D, s: MeshState, dt: number): void {
  ctx.clearRect(0, 0, s.w, s.h);

  // Physics update: drift, dampening, elastic walls
  for (const p of s.nodes) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;

    if (p.x < 0) {
      p.x = 0;
      p.vx = Math.abs(p.vx) + 5;
    } else if (p.x > s.w) {
      p.x = s.w;
      p.vx = -Math.abs(p.vx) - 5;
    }
    if (p.y < 0) {
      p.y = 0;
      p.vy = Math.abs(p.vy) + 5;
    } else if (p.y > s.h) {
      p.y = s.h;
      p.vy = -Math.abs(p.vy) - 5;
    }

    // Mouse Gravitational Elasticity
    if (s.mouse.active) {
      const dx = s.mouse.x - p.x;
      const dy = s.mouse.y - p.y;
      const dm = Math.hypot(dx, dy);
      if (dm < 150 && dm > 10) {
        const force = (1 - dm / 150) * 45;
        p.vx += (dx / dm) * force * dt;
        p.vy += (dy / dm) * force * dt;
      }
    }
  }

  // Draw Synaptic Connection Fibers & Mouse Tethers
  drawConnectionFibers(ctx, s, 0.32, true);

  // Spontaneous Synaptic Transmission
  s.timer -= dt;
  if (s.timer <= 0 && s.pulses.length < 12 && s.nodes.length > 0) {
    s.timer = R(0.12, 0.35);
    const a = pick(s.nodes);
    const nb = getNeighbors(s, a);
    if (nb.length) firePulse(s, a, pick(nb), RI(2, 6));
  }

  // Animate Synaptic Action Potentials (Pulses)
  ctx.globalCompositeOperation = 'lighter';
  const nextPulses: Pulse[] = [];
  for (const p of s.pulses) {
    p.t += dt / p.dur;
    const t = Math.min(1, p.t);
    const curX = p.a.x + (p.b.x - p.a.x) * t;
    const curY = p.a.y + (p.b.y - p.a.y) * t;

    const trailT = Math.max(0, t - 0.28);
    const trX = p.a.x + (p.b.x - p.a.x) * trailT;
    const trY = p.a.y + (p.b.y - p.a.y) * trailT;

    ctx.strokeStyle = `rgba(${p.rgb},0.85)`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(trX, trY);
    ctx.lineTo(curX, curY);
    ctx.stroke();

    glowDot(ctx, curX, curY, 8, p.rgb, 0.7);

    if (p.t >= 1) {
      p.b.glow = 1;
      if (p.hops > 0) {
        const nbs = getNeighbors(s, p.b, p.a);
        if (nbs.length) {
          nextPulses.push({
            a: p.b,
            b: pick(nbs),
            t: 0,
            dur: p.dur,
            hops: p.hops - 1,
            rgb: p.rgb,
          });
        }
      }
    } else {
      nextPulses.push(p);
    }
  }
  s.pulses = nextPulses;

  // Render Nodes with Bioluminescent Glow
  for (const p of s.nodes) {
    if (p.glow > 0) {
      glowDot(ctx, p.x, p.y, 14, CYAN, p.glow * 0.7);
      p.glow = Math.max(0, p.glow - dt * 1.6);
    }
    ctx.fillStyle = `rgba(${WHITE},0.9)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}

function renderStaticConstellation(ctx: CanvasRenderingContext2D, s: MeshState): void {
  ctx.clearRect(0, 0, s.w, s.h);
  drawConnectionFibers(ctx, s, 0.28, false);

  for (let i = 0; i < s.nodes.length; i++) {
    const p = s.nodes[i];
    if (i % 7 === 0) {
      glowDot(ctx, p.x, p.y, 10, CYAN, 0.4);
    }
    ctx.fillStyle = `rgba(${WHITE},0.85)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function startAnimationLoop(
  canvas: HTMLCanvasElement,
  s: MeshState,
  isAnimatedRef: React.MutableRefObject<boolean>
): void {
  if (s.rafId !== null) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  s.lastTime = performance.now();
  const loop = (now: number) => {
    if (!isAnimatedRef.current) {
      s.rafId = null;
      return;
    }
    const dt = Math.min(0.05, (now - s.lastTime) / 1000);
    s.lastTime = now;
    stepSimulation(ctx, s, dt);
    s.rafId = requestAnimationFrame(loop);
  };
  s.rafId = requestAnimationFrame(loop);
}

export const NeuralMeshBackground: React.FC<NeuralMeshBackgroundProps> = ({ isAnimated }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isAnimatedRef = useRef(isAnimated);
  isAnimatedRef.current = isAnimated;

  const stateRef = useRef<MeshState>({
    w: 0,
    h: 0,
    dpr: 1,
    nodes: [],
    pulses: [],
    timer: 0,
    maxD: 120,
    mouse: { x: -9999, y: -9999, active: false },
    lastTime: 0,
    rafId: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.w = rect.width;
      s.h = rect.height;
      canvas.width = Math.round(s.w * s.dpr);
      canvas.height = Math.round(s.h * s.dpr);

      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      initSimulation(s);

      // Pre-warm so initial distribution is organic
      for (let i = 0; i < 40; i++) {
        for (const p of s.nodes) {
          p.x += p.vx * (1 / 30);
          p.y += p.vy * (1 / 30);
          if (p.x < 0 || p.x > s.w) p.vx *= -1;
          if (p.y < 0 || p.y > s.h) p.vy *= -1;
        }
      }

      if (isAnimatedRef.current) {
        stepSimulation(ctx, s, 1 / 60);
      } else {
        renderStaticConstellation(ctx, s);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.mouse.x = e.clientX - rect.left;
      s.mouse.y = e.clientY - rect.top;
      s.mouse.active = true;
    };

    const handleMouseLeave = () => {
      s.mouse.x = -9999;
      s.mouse.y = -9999;
      s.mouse.active = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Kinetic Synaptic EMP Shockwave
      for (const n of s.nodes) {
        const dx = n.x - cx;
        const dy = n.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 240) {
          const force = (1 - d / 240) * 180;
          n.vx += (dx / d) * force;
          n.vy += (dy / d) * force;
          n.glow = 1;
          const nbs = getNeighbors(s, n);
          if (nbs.length && Math.random() < 0.6) {
            firePulse(s, n, pick(nbs), 5, 2.2);
          }
        }
      }

      if (!isAnimatedRef.current) {
        renderStaticConstellation(ctx, s);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && s.rafId !== null) {
        cancelAnimationFrame(s.rafId);
        s.rafId = null;
      } else if (!document.hidden && isAnimatedRef.current) {
        startAnimationLoop(canvas, s, isAnimatedRef);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('click', handleClick);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('click', handleClick);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (s.rafId !== null) {
        cancelAnimationFrame(s.rafId);
        s.rafId = null;
      }
    };
  }, []);

  // Handle animation toggle changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;

    if (isAnimated) {
      startAnimationLoop(canvas, s, isAnimatedRef);
    } else {
      if (s.rafId !== null) {
        cancelAnimationFrame(s.rafId);
        s.rafId = null;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderStaticConstellation(ctx, s);
      }
    }
  }, [isAnimated]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ background: '#060913' }}
    />
  );
};

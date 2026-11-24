import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { HOME_CAT_CONFIG, type HomeCatConfig } from '../config/home.config';
import type {
  CalicoCatScene,
  CatMood,
  CatSceneStatus,
} from '../three/CalicoCatScene';

interface CalicoCatCardProps {
  config?: HomeCatConfig;
}

type SceneLoadState = 'loading' | 'ready' | 'unavailable';

const MOOD_META: Record<
  CatMood,
  { label: string; dotClass: string; badgeClass: string }
> = {
  relaxed: {
    label: 'Relaxed',
    dotClass: 'bg-sky-400/80',
    badgeClass: 'border-slate-700/80 bg-slate-950/75 text-slate-300',
  },
  curious: {
    label: 'Curious',
    dotClass: 'bg-amber-300',
    badgeClass: 'border-amber-400/35 bg-slate-950/80 text-amber-200',
  },
  purring: {
    label: 'Purring',
    dotClass: 'bg-rose-400 animate-pulse',
    badgeClass: 'border-rose-400/40 bg-rose-950/40 text-rose-200',
  },
  blissful: {
    label: 'Blissful',
    dotClass: 'bg-rose-300 animate-pulse',
    badgeClass: 'border-rose-300/50 bg-rose-950/50 text-rose-100',
  },
};

const INITIAL_STATUS: CatSceneStatus = {
  mood: 'relaxed',
  isPetting: false,
  isOrbited: false,
  hasInteracted: false,
};

/**
 * Interactive Three.js calico cat card aligned with the /home/ profile column.
 * Shows a clean loading screen while the 3D bundle and procedural textures initialize,
 * then fades in smoothly with stroke-to-pet, turntable orbit, and keyboard pat support.
 */
export const CalicoCatCard: React.FC<CalicoCatCardProps> = ({
  config = HOME_CAT_CONFIG,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<CalicoCatScene | null>(null);
  const [status, setStatus] = useState<CatSceneStatus>(INITIAL_STATUS);
  const [loadState, setLoadState] = useState<SceneLoadState>('loading');

  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    let cancelled = false;
    let initRafId: number | null = null;
    let readyRafId: number | null = null;
    let instance: CalicoCatScene | null = null;

    setLoadState('loading');

    import('../three/CalicoCatScene')
      .then(({ CalicoCatScene: SceneController }) => {
        if (cancelled) return;
        // Yield one animation frame so mobile browsers paint the loading overlay
        // before synchronous procedural fur texture baking & WebGL shader compile.
        initRafId = requestAnimationFrame(() => {
          if (cancelled) return;
          try {
            instance = new SceneController({
              container,
              palette: config.palette,
              onStatusChange: (next) => setStatus(next),
            });
            sceneRef.current = instance;
            readyRafId = requestAnimationFrame(() => {
              if (!cancelled) setLoadState('ready');
            });
          } catch {
            if (!cancelled) setLoadState('unavailable');
          }
        });
      })
      .catch(() => {
        if (!cancelled) setLoadState('unavailable');
      });

    return () => {
      cancelled = true;
      if (initRafId !== null) cancelAnimationFrame(initRafId);
      if (readyRafId !== null) cancelAnimationFrame(readyRafId);
      sceneRef.current = null;
      instance?.dispose();
    };
  }, [config.palette]);

  const moodMeta = MOOD_META[status.mood];
  const isLoading = loadState === 'loading';
  const isReady = loadState === 'ready';
  const isUnavailable = loadState === 'unavailable';

  const handleResetView = () => {
    sceneRef.current?.resetView();
  };

  const handleStageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      sceneRef.current?.triggerFriendlyPat();
    }
  };

  return (
    <section
      aria-label={`${config.name} — Interactive Calico Cat`}
      data-cat-mood={status.mood}
      data-cat-state={loadState}
      className="relative w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/75 backdrop-blur-md shadow-2xl shadow-black/40"
    >
      {/* Subtle studio atmosphere backdrop behind the transparent Three.js stage */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_46%,rgba(248,180,120,0.08),rgba(56,189,248,0.04)_44%,rgba(6,9,19,0.55)_82%)]"
        aria-hidden="true"
      />

      {/* Minimalist floating top bar inside the stage */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4 pt-3.5 sm:px-5 sm:pt-4">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-100">
            {config.name}
          </h2>
          <span
            aria-hidden="true"
            className="h-3 w-px bg-slate-800"
          />
          {isLoading ? (
            <span
              data-testid="cat-mood-badge"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/75 px-2.5 py-0.5 text-[11px] font-medium text-slate-400"
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-sky-400/70 animate-pulse"
                aria-hidden="true"
              />
              <span>Loading</span>
            </span>
          ) : (
            <span
              data-testid="cat-mood-badge"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-300 ${moodMeta.badgeClass}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${moodMeta.dotClass}`}
                aria-hidden="true"
              />
              <span>{moodMeta.label}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleResetView}
          aria-label="Reset camera view"
          title="Reset camera view"
          className={`pointer-events-auto inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all duration-200 hover:border-sky-400/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 ${
            isReady && status.isOrbited
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 pointer-events-none -translate-y-1'
          }`}
        >
          <RotateCcw className="h-3 w-3 text-sky-400" aria-hidden="true" />
          <span>Reset</span>
        </button>
      </div>

      {/* Interactive viewport wrapper */}
      <div className="relative h-[340px] sm:h-[395px] w-full">
        {/* Three.js WebGL interactive canvas mount target */}
        <div
          ref={stageRef}
          tabIndex={0}
          role="application"
          aria-busy={isLoading}
          aria-label={`Interactive 3D calico cat named ${config.name}. Stroke across ${config.name} to pet, or press Space to give a friendly pat.`}
          onKeyDown={handleStageKeyDown}
          className={`h-full w-full transition-opacity duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/60 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Minimalist glassmorphic loading screen while Three.js & fur textures prepare */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            data-testid="cat-loading-overlay"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-sky-400/10 blur-md animate-pulse"
              />
              <span
                aria-hidden="true"
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/80 shadow-lg backdrop-blur-sm"
              >
                <Loader2
                  className="h-5 w-5 animate-spin text-sky-400"
                  aria-hidden="true"
                />
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium tracking-tight text-slate-200">
                Waking up {config.name}…
              </p>
              <p className="font-mono text-[11px] text-slate-400">
                Preparing 3D scene
              </p>
            </div>
          </div>
        )}

        {/* Graceful fallback when WebGL is unavailable */}
        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex h-full w-full flex-col items-center justify-center gap-1.5 px-6 text-center">
            <p className="text-sm font-medium text-slate-200">
              3D preview unavailable in this browser
            </p>
            <p className="text-xs text-slate-400">
              Enable WebGL to meet and pet {config.name}.
            </p>
          </div>
        )}
      </div>

      {/* Unobtrusive bottom interaction hint (shown once 3D scene is ready) */}
      {isReady && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-3 sm:pb-3.5">
          <p
            className={`rounded-full border border-slate-800/80 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-400 backdrop-blur-sm transition-opacity duration-500 ${
              status.hasInteracted ? 'opacity-55' : 'opacity-95'
            }`}
          >
            <span className="hidden sm:inline">{config.desktopHint}</span>
            <span className="sm:hidden">{config.touchHint}</span>
          </p>
        </div>
      )}
    </section>
  );
};

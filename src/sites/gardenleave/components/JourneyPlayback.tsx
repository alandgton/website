import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  X,
} from 'lucide-react';
import {
  CityConfig,
  ItineraryLegConfig,
  TransitMode,
  TransitModeStyleConfig,
} from '../config/types';

interface JourneyPlaybackProps {
  isEnabled: boolean;
  isPlaying: boolean;
  currentIndex: number;
  itinerary: ItineraryLegConfig[];
  cities: Record<string, CityConfig>;
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  playbackSpeedMs: number;
  onToggleEnabled: (enabled: boolean) => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onScrub: (index: number) => void;
  onChangeSpeed: (ms: number) => void;
  onInspectCity: (cityId: string) => void;
}

export const JourneyPlayback: React.FC<JourneyPlaybackProps> = ({
  isEnabled,
  isPlaying,
  currentIndex,
  itinerary,
  cities,
  transitModes,
  playbackSpeedMs,
  onToggleEnabled,
  onTogglePlay,
  onPrev,
  onNext,
  onScrub,
  onChangeSpeed,
  onInspectCity,
}) => {
  const currentLeg = itinerary[currentIndex] ?? itinerary[0];
  const totalLegs = itinerary.length;
  const sourceCity = currentLeg ? cities[currentLeg.source] : undefined;
  const destCity = currentLeg ? cities[currentLeg.dest] : undefined;
  const modeStyle = currentLeg ? transitModes[currentLeg.transport] : undefined;

  // When playback is idle/disabled, render a compact floating pill button
  if (!isEnabled) {
    return (
      <button
        type="button"
        onClick={() => onToggleEnabled(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
        title="Start Interactive Journey Playback"
      >
        <Play className="h-3.5 w-3.5 fill-slate-950" aria-hidden="true" />
        <span>Play Journey</span>
      </button>
    );
  }

  // Expanded playback controls
  return (
    <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-slate-800/95 bg-slate-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all">
      {/* Top Row: Playback Title, Speed Selector & Close Button */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 font-semibold text-white">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          <span>Journey Playback</span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Speed Selector */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/60 p-0.5 font-mono text-[10px]">
            {[
              { label: '0.7x', ms: 2200 },
              { label: '1x', ms: 1400 },
              { label: '2x', ms: 750 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onChangeSpeed(opt.ms)}
                className={`rounded px-1.5 py-0.5 transition ${
                  playbackSpeedMs === opt.ms
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Close / Minimize Button */}
          <button
            type="button"
            onClick={() => onToggleEnabled(false)}
            title="Close Playback"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {currentLeg && (
        <div className="pt-2 flex flex-col gap-2">
          {/* Active Leg Metadata Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/75 border border-slate-800/90 px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {modeStyle && (
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: `${modeStyle.color}20`,
                    color: modeStyle.color,
                    border: `1px solid ${modeStyle.color}40`,
                  }}
                >
                  {currentLeg.transport}
                </span>
              )}

              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white">
                <button
                  type="button"
                  onClick={() => onInspectCity(currentLeg.source)}
                  className="hover:text-sky-400 underline decoration-slate-600 underline-offset-2 transition"
                >
                  {sourceCity?.name ?? currentLeg.source}
                </button>
                <span className="text-slate-500">→</span>
                <button
                  type="button"
                  onClick={() => onInspectCity(currentLeg.dest)}
                  className="text-sky-300 hover:text-sky-200 underline decoration-sky-500/50 underline-offset-2 transition"
                >
                  {destCity?.name ?? currentLeg.dest}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                {currentLeg.startDate} → {currentLeg.endDate}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-amber-300">
                {currentLeg.nights === 0
                  ? '0 nights (intraday)'
                  : `${currentLeg.nights} ${currentLeg.nights === 1 ? 'night' : 'nights'}`}
              </span>
            </div>
          </div>

          {/* Playback Buttons + Range Slider */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentIndex <= 0}
                title="Previous Leg"
                className="rounded-lg border border-slate-800 bg-slate-800/70 p-1.5 text-slate-200 hover:bg-slate-700 disabled:opacity-35 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                title={isPlaying ? 'Pause Journey' : 'Play Journey'}
                className="flex items-center gap-1 rounded-lg bg-sky-500 hover:bg-sky-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm shadow-sky-500/30 transition"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Play</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={currentIndex >= totalLegs - 1}
                title="Next Leg"
                className="rounded-lg border border-slate-800 bg-slate-800/70 p-1.5 text-slate-200 hover:bg-slate-700 disabled:opacity-35 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Scrubber Slider */}
            <div className="flex flex-1 items-center gap-2">
              <span className="font-mono text-[10px] text-slate-500">1</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, totalLegs - 1)}
                value={currentIndex}
                onChange={(e) => onScrub(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-sky-400"
              />
              <span className="font-mono text-[10px] text-slate-500">{totalLegs}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

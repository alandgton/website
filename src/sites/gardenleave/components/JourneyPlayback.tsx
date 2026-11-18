import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
} from 'lucide-react';
import {
  CityConfig,
  CityPhotoConfig,
  ItineraryLegConfig,
  TransitMode,
  TransitModeStyleConfig,
} from '../config/types';
import {
  CityPhotoCarousel,
  getDisplayPhotoCaption,
  PostcardStackImage,
} from './CityPhotoCarousel';

interface JourneyPlaybackProps {
  isEnabled: boolean;
  isPlaying: boolean;
  currentIndex: number;
  itinerary: ItineraryLegConfig[];
  cities: Record<string, CityConfig>;
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  playbackSpeedMs: number;
  destPhotos?: CityPhotoConfig[];
  activePhotoIndex?: number;
  onChangePhotoIndex?: (index: number) => void;
  onLayoutHeightChange?: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onScrub: (index: number) => void;
  onChangeSpeed: (ms: number) => void;
}

export const JourneyPlayback: React.FC<JourneyPlaybackProps> = ({
  isEnabled,
  isPlaying,
  currentIndex,
  itinerary,
  cities,
  transitModes,
  playbackSpeedMs,
  destPhotos = [],
  activePhotoIndex = 0,
  onChangePhotoIndex,
  onLayoutHeightChange,
  onToggleEnabled,
  onTogglePlay,
  onPrev,
  onNext,
  onScrub,
  onChangeSpeed,
}) => {
  const [isMobilePhotoExpanded, setIsMobilePhotoExpanded] = useState(false);

  const currentLeg = itinerary[currentIndex] ?? itinerary[0];
  const totalLegs = itinerary.length;
  const sourceCity = currentLeg ? cities[currentLeg.source] : undefined;
  const destCity = currentLeg ? cities[currentLeg.dest] : undefined;
  const modeStyle = currentLeg ? transitModes[currentLeg.transport] : undefined;

  const hasPhotos = destPhotos.length > 0;
  const safePhotoIndex = hasPhotos
    ? ((activePhotoIndex % destPhotos.length) + destPhotos.length) % destPhotos.length
    : 0;
  const activePhoto = hasPhotos ? destPhotos[safePhotoIndex] : undefined;

  const onLayoutHeightChangeRef = useRef(onLayoutHeightChange);
  useEffect(() => {
    onLayoutHeightChangeRef.current = onLayoutHeightChange;
  }, [onLayoutHeightChange]);

  // Notify parent when docked mobile photo strip appears/disappears or expands/collapses
  // so Follow Camera can re-center the map in the unobstructed viewport.
  useEffect(() => {
    if (!isEnabled) return;
    onLayoutHeightChangeRef.current?.();
  }, [hasPhotos, isEnabled, isMobilePhotoExpanded]);

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
    <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-slate-800/95 bg-slate-900/95 px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-2xl backdrop-blur-md transition-all">
      {/* Top Row: Playback Title, Speed Selector & Close Button */}
      <div className="flex items-center justify-between gap-3 pb-1.5 sm:pb-2 border-b border-slate-800/80 text-xs">
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
        <div className="pt-1.5 sm:pt-2 flex flex-col gap-1.5 sm:gap-2">
          {/* Docked Mobile Photo Strip (sm:hidden) — keeps the upper map canvas 100% unobstructed on iPhone */}
          {hasPhotos && activePhoto && (
            <div className="sm:hidden rounded-xl border border-slate-800/90 bg-slate-950/85 p-1.5">
              {isMobilePhotoExpanded ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1 text-[11px]">
                    <span className="flex items-center gap-1.5 font-semibold text-white">
                      <Camera className="h-3 w-3 text-sky-400" />
                      <span>{destCity?.name ?? currentLeg.dest}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMobilePhotoExpanded(false)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                    >
                      <Minimize2 className="h-3 w-3 text-sky-400" />
                      <span>Compact</span>
                    </button>
                  </div>
                  <CityPhotoCarousel
                    photos={destPhotos}
                    cityName={destCity?.name ?? currentLeg.dest}
                    activeIndex={safePhotoIndex}
                    onChangeIndex={(idx) => onChangePhotoIndex?.(idx)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  {/* Compact Thumbnail (Tap to expand in-place) */}
                  <button
                    type="button"
                    onClick={() => setIsMobilePhotoExpanded(true)}
                    className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900"
                    title="Tap to enlarge photo"
                  >
                    <PostcardStackImage
                      photo={activePhoto}
                      cityName={destCity?.name ?? currentLeg.dest}
                    />
                  </button>

                  {/* Caption & Multi-Photo Progress */}
                  <div
                    onClick={() => setIsMobilePhotoExpanded(true)}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                      <Camera className="h-3 w-3 shrink-0 text-sky-400" />
                      <span className="truncate">{destCity?.name ?? currentLeg.dest}</span>
                      {destPhotos.length > 1 && (
                        <span className="shrink-0 rounded bg-sky-500/15 border border-sky-400/30 px-1 py-px font-mono text-[9px] text-sky-300">
                          {safePhotoIndex + 1}/{destPhotos.length}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-slate-400">
                      {getDisplayPhotoCaption(activePhoto.caption) || 'Tap to expand photo'}
                    </p>
                    {destPhotos.length > 1 && (
                      <div className="mt-1 flex items-center gap-1">
                        {destPhotos.map((p, idx) => (
                          <span
                            key={p.id}
                            className={`h-1 rounded-full transition-all ${
                              idx === safePhotoIndex ? 'w-3 bg-sky-400' : 'w-1 bg-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Prev / Next & Expand Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {destPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangePhotoIndex?.(
                              (safePhotoIndex - 1 + destPhotos.length) % destPhotos.length
                            );
                          }}
                          aria-label="Previous photo"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-1 text-slate-300 active:bg-slate-800"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangePhotoIndex?.((safePhotoIndex + 1) % destPhotos.length);
                          }}
                          aria-label="Next photo"
                          className="rounded-lg border border-slate-800 bg-slate-900 p-1 text-slate-300 active:bg-slate-800"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsMobilePhotoExpanded(true)}
                      aria-label="Expand photo"
                      title="Expand photo"
                      className="rounded-lg border border-slate-800 bg-slate-900 p-1 text-sky-400 active:bg-slate-800"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
                <span>{sourceCity?.name ?? currentLeg.source}</span>
                <span className="text-slate-500">→</span>
                <span className="text-sky-300">{destCity?.name ?? currentLeg.dest}</span>
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

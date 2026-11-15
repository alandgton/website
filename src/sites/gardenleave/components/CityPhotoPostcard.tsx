import React from 'react';
import { ExternalLink, MapPin, Pause, X } from 'lucide-react';
import { CityConfig, CityPhotoConfig } from '../config/types';
import { CityPhotoCarousel } from './CityPhotoCarousel';

interface CityPhotoPostcardProps {
  containerRef?: React.RefObject<HTMLElement>;
  city: CityConfig | undefined;
  photos: CityPhotoConfig[];
  activePhotoIndex: number;
  onChangePhotoIndex: (index: number) => void;
  subtitle?: string;
  isTimelineEnabled?: boolean;
  isPlayingTimeline?: boolean;
  isPausedByHover?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  onOpenCityDetails?: (cityId: string) => void;
  onDismiss?: () => void;
}

export const CityPhotoPostcard: React.FC<CityPhotoPostcardProps> = ({
  containerRef,
  city,
  photos,
  activePhotoIndex,
  onChangePhotoIndex,
  subtitle,
  isTimelineEnabled = false,
  isPlayingTimeline = false,
  isPausedByHover = false,
  onHoverChange,
  onOpenCityDetails,
  onDismiss,
}) => {
  if (!city || photos.length === 0) return null;

  return (
    <aside
      ref={containerRef}
      aria-label={`Photos from ${city.name}`}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={`${
        isTimelineEnabled
          ? 'hidden sm:block sm:top-16 sm:left-4 sm:w-64'
          : 'bottom-16 inset-x-3 sm:bottom-auto sm:inset-x-auto sm:top-16 sm:left-4 sm:w-64'
      } pointer-events-auto absolute z-20 rounded-2xl border border-slate-800/95 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-md transition-all duration-200`}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-1.5 px-1 pb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 text-sky-400" />
            <h3 className="truncate text-xs font-bold text-white">{city.name}</h3>
            <span className="truncate text-[10px] text-slate-400">{city.country}</span>
          </div>
          {subtitle && (
            <p className="truncate font-mono text-[10px] text-slate-400 pl-4">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isPlayingTimeline && isPausedByHover && (
            <span
              title="Playback paused while inspecting photo"
              className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300"
            >
              <Pause className="h-2.5 w-2.5 fill-current" />
              <span>Hold</span>
            </span>
          )}

          {onOpenCityDetails && (
            <button
              type="button"
              onClick={() => onOpenCityDetails(city.id)}
              title={`Open ${city.name} in Itinerary Drawer`}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              title="Close Photo Postcard"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Carousel Body */}
      <CityPhotoCarousel
        photos={photos}
        cityName={city.name}
        activeIndex={activePhotoIndex}
        onChangeIndex={onChangePhotoIndex}
        compact
      />
    </aside>
  );
};

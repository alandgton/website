import React from 'react';
import { Calendar, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { CityPhotoConfig } from '../config/types';

interface CityPhotoCarouselProps {
  photos: CityPhotoConfig[];
  cityName: string;
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  /** Optional compact sizing for floating postcard HUD */
  compact?: boolean;
}

export const CityPhotoCarousel: React.FC<CityPhotoCarouselProps> = ({
  photos,
  cityName,
  activeIndex,
  onChangeIndex,
  compact = false,
}) => {
  if (photos.length === 0) return null;

  const safeIndex = ((activeIndex % photos.length) + photos.length) % photos.length;
  const activePhoto = photos[safeIndex];
  const hasMultiple = photos.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeIndex((safeIndex - 1 + photos.length) % photos.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeIndex((safeIndex + 1) % photos.length);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950 select-none group">
      {/* 4:3 Aspect Ratio Image Container (prevents layout shift) */}
      <div className={`relative w-full ${compact ? 'aspect-[16/10]' : 'aspect-[4/3]'} bg-slate-950`}>
        <img
          key={activePhoto.id}
          src={activePhoto.src}
          alt={activePhoto.caption ? `${cityName} — ${activePhoto.caption}` : cityName}
          width={activePhoto.width}
          height={activePhoto.height}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-opacity duration-200"
        />

        {/* Top-Right Counter Badge */}
        {hasMultiple && (
          <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-200 shadow backdrop-blur-md">
            <Camera className="h-2.5 w-2.5 text-sky-400" />
            <span>
              {safeIndex + 1} / {photos.length}
            </span>
          </div>
        )}

        {/* Prev / Next Navigation Buttons */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              title="Previous Photo"
              aria-label="Previous Photo"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-950/80 p-1 text-slate-200 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-slate-900 hover:text-white shadow-md backdrop-blur-sm transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Next Photo"
              aria-label="Next Photo"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-950/80 p-1 text-slate-200 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-slate-900 hover:text-white shadow-md backdrop-blur-sm transition"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {/* Bottom Caption / Date / Dots Overlay */}
        {(activePhoto.caption || activePhoto.date || hasMultiple) && (
          <div className=" inset-x-0 bottom-0 absolute bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-transparent px-2.5 pt-5 pb-2 flex flex-col gap-1">
            {(activePhoto.caption || activePhoto.date) && (
              <div className="flex items-end justify-between gap-2 text-[11px]">
                {activePhoto.caption ? (
                  <p className="text-slate-100 font-medium leading-snug line-clamp-2">
                    {activePhoto.caption}
                  </p>
                ) : (
                  <span />
                )}
                {activePhoto.date && (
                  <span className="shrink-0 flex items-center gap-1 font-mono text-[10px] text-slate-300">
                    <Calendar className="h-2.5 w-2.5 text-sky-400" />
                    {activePhoto.date}
                  </span>
                )}
              </div>
            )}

            {/* Dot Scrubber for Multi-Photo Cities */}
            {hasMultiple && (
              <div className="flex items-center justify-center gap-1 pt-0.5">
                {photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeIndex(idx);
                    }}
                    aria-label={`Show photo ${idx + 1} of ${photos.length}`}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === safeIndex
                        ? 'w-4 bg-sky-400'
                        : 'w-1.5 bg-slate-500/70 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

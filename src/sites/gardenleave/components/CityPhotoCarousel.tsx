import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CityPhotoConfig } from '../config/types';

/**
 * Suppresses auto-generated placeholder captions (e.g. "Tokyo Placeholder")
 * so photos are only overlaid by a caption band when a real user caption exists.
 */
export function getDisplayPhotoCaption(caption?: string): string | undefined {
  if (!caption) return undefined;
  const trimmed = caption.trim();
  if (!trimmed || /placeholder$/i.test(trimmed)) return undefined;
  return trimmed;
}

interface StackTransitionState {
  current: CityPhotoConfig;
  outgoing: CityPhotoConfig | null;
  generation: number;
}

interface PostcardStackImageProps {
  photo: CityPhotoConfig;
  cityName: string;
}

/**
 * Renders a two-layer GPU-composited "Postcard Stack Deal" transition whenever `photo.id` changes:
 * - The outgoing photo gently recedes downward (`scale(1 -> 0.91)`, `translateY(7%)`, `opacity(1 -> 0)`).
 * - The incoming photo deals onto the stack with a subtle lift, tilt, and scale-up (`scale(0.94 -> 1)`).
 */
export const PostcardStackImage: React.FC<PostcardStackImageProps> = ({ photo, cityName }) => {
  const [stack, setStack] = useState<StackTransitionState>(() => ({
    current: photo,
    outgoing: null,
    generation: 0,
  }));

  if (photo.id !== stack.current.id) {
    setStack({
      current: photo,
      outgoing: stack.current,
      generation: stack.generation + 1,
    });
  }

  useEffect(() => {
    if (!stack.outgoing) return;
    const timer = window.setTimeout(() => {
      setStack((prev) => (prev.outgoing ? { ...prev, outgoing: null } : prev));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [stack.generation, stack.outgoing]);

  const dealClass =
    stack.generation === 0
      ? ''
      : stack.generation % 2 === 0
        ? 'animate-postcard-deal-even'
        : 'animate-postcard-deal-odd';

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Outgoing Card Receding Underneath */}
      {stack.outgoing && (
        <img
          key={`out-${stack.outgoing.id}-${stack.generation}`}
          src={stack.outgoing.src}
          alt=""
          aria-hidden="true"
          width={stack.outgoing.width}
          height={stack.outgoing.height}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full rounded-lg object-cover animate-postcard-recede"
        />
      )}

      {/* Incoming Card Dealing onto Top of Stack */}
      <img
        key={`in-${stack.current.id}-${stack.generation}`}
        src={stack.current.src}
        alt={stack.current.caption ? `${cityName} — ${stack.current.caption}` : cityName}
        width={stack.current.width}
        height={stack.current.height}
        loading="lazy"
        decoding="async"
        className={`relative z-10 h-full w-full object-cover shadow-xl ${dealClass}`}
      />
    </div>
  );
};

interface CityPhotoCarouselProps {
  photos: CityPhotoConfig[];
  cityName: string;
  activeIndex: number;
  onChangeIndex: (index: number) => void;
}

export const CityPhotoCarousel: React.FC<CityPhotoCarouselProps> = ({
  photos,
  cityName,
  activeIndex,
  onChangeIndex,
}) => {
  if (photos.length === 0) return null;

  const safeIndex = ((activeIndex % photos.length) + photos.length) % photos.length;
  const activePhoto = photos[safeIndex];
  const hasMultiple = photos.length > 1;
  const displayCaption = getDisplayPhotoCaption(activePhoto.caption);

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
      {/* 16:10 Aspect Ratio Image Container (prevents layout shift) */}
      <div className="relative w-full aspect-[16/10] bg-slate-950">
        <PostcardStackImage photo={activePhoto} cityName={cityName} />

        {/* Top-Right Counter Badge (only when multiple photos exist) */}
        {hasMultiple && (
          <div className="pointer-events-none absolute top-2 right-2 z-20 rounded-md border border-slate-700/70 bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-200 shadow backdrop-blur-md">
            {safeIndex + 1} / {photos.length}
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
              className="absolute left-1.5 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-950/80 p-1 text-slate-200 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-slate-900 hover:text-white shadow-md backdrop-blur-sm transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Next Photo"
              aria-label="Next Photo"
              className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-700/70 bg-slate-950/80 p-1 text-slate-200 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-slate-900 hover:text-white shadow-md backdrop-blur-sm transition"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {/* Bottom Caption / Dots Overlay */}
        {(displayCaption || hasMultiple) && (
          <div className="inset-x-0 bottom-0 absolute z-20 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-transparent px-2.5 pt-4 pb-2 flex flex-col gap-1">
            {displayCaption && (
              <p className="text-[11px] text-slate-100 font-medium leading-snug line-clamp-2">
                {displayCaption}
              </p>
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

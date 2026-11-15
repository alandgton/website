import { useCallback, useEffect } from 'react';
import { CityPhotoConfig, getPhotosForCity, ItineraryLegConfig } from '../config';

const preloadedUrls = new Set<string>();

function preloadImageUrl(src: string): void {
  if (!src || preloadedUrls.has(src) || typeof window === 'undefined') return;
  preloadedUrls.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}

/**
 * Lookahead & hover-intent image preloader.
 * - Downloads 0 bytes on initial page load.
 * - Preloads upcoming `N`, `N+1`, and `N+2` destination city photos when Journey Playback is active.
 * - Exposes `preloadCity(cityId)` for hover-intent preloading on map pins.
 */
export function usePhotoPreloader(
  cityPhotosMap: Record<string, CityPhotoConfig[]> | undefined,
  itinerary: ItineraryLegConfig[],
  isTimelineEnabled: boolean,
  currentTimelineIndex: number,
  selectedCityId: string | null
) {
  const preloadCity = useCallback(
    (cityId: string | null | undefined) => {
      if (!cityId || !cityPhotosMap) return;
      const photos = getPhotosForCity(cityId, cityPhotosMap);
      for (const photo of photos) {
        preloadImageUrl(photo.src);
      }
    },
    [cityPhotosMap]
  );

  // Preload selected city's photos when a city is selected
  useEffect(() => {
    if (selectedCityId) {
      preloadCity(selectedCityId);
    }
  }, [preloadCity, selectedCityId]);

  // Lookahead preloading during Journey Playback (current leg dest + next 2 legs)
  useEffect(() => {
    if (!isTimelineEnabled || !cityPhotosMap) return;

    const indicesToPreload = [
      currentTimelineIndex,
      currentTimelineIndex + 1,
      currentTimelineIndex + 2,
    ];

    for (const idx of indicesToPreload) {
      const leg = itinerary[idx];
      if (leg) {
        preloadCity(leg.dest);
      }
    }
  }, [cityPhotosMap, currentTimelineIndex, isTimelineEnabled, itinerary, preloadCity]);

  return { preloadCity };
}

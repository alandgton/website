import { useEffect, useMemo, useRef, useState } from 'react';
import { CityConfig, ItineraryLegConfig } from '../config/types';
import { geocodeCityAsync, resolveCitySync } from '../utils/cityGeocoder';

export interface UseResolvedCitiesReturn {
  cities: Record<string, CityConfig>;
  isGeocoding: boolean;
  unresolvedCities: string[];
}

/**
 * Automatically extracts all unique source & destination city names from the itinerary
 * and resolves their [longitude, latitude] coordinates without requiring city coordinates
 * in the user configuration.
 */
export function useResolvedCities(itinerary: ItineraryLegConfig[]): UseResolvedCitiesReturn {
  const uniqueCityIds = useMemo(() => {
    const set = new Set<string>();
    for (const leg of itinerary) {
      if (leg.source) set.add(leg.source);
      if (leg.dest) set.add(leg.dest);
    }
    return Array.from(set);
  }, [itinerary]);

  // 1. Synchronous pass for built-in gazetteer and localStorage cache hits
  const syncResult = useMemo(() => {
    const resolved: Record<string, CityConfig> = {};
    const pending: string[] = [];

    for (const cityId of uniqueCityIds) {
      const hit = resolveCitySync(cityId);
      if (hit) {
        resolved[cityId] = hit;
      } else {
        pending.push(cityId);
      }
    }

    return { resolved, pending };
  }, [uniqueCityIds]);

  const [asyncResolved, setAsyncResolved] = useState<Record<string, CityConfig>>({});
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [failedCities, setFailedCities] = useState<string[]>([]);
  const attemptedCityIdsRef = useRef<Set<string>>(new Set());

  // 2. Asynchronous geocoding pass for any newly added city names not in the cache
  useEffect(() => {
    const toFetch = syncResult.pending.filter(
      (id) => !attemptedCityIdsRef.current.has(id)
    );
    if (toFetch.length === 0) {
      setIsGeocoding(false);
      return;
    }

    let cancelled = false;
    setIsGeocoding(true);

    Promise.all(
      toFetch.map(async (cityId) => {
        const result = await geocodeCityAsync(cityId);
        return { cityId, result };
      })
    ).then((outcomes) => {
      if (cancelled) return;
      const newlyFound: Record<string, CityConfig> = {};
      const notFound: string[] = [];

      for (const { cityId, result } of outcomes) {
        attemptedCityIdsRef.current.add(cityId);
        if (result) {
          newlyFound[cityId] = result;
        } else {
          notFound.push(cityId);
        }
      }

      if (Object.keys(newlyFound).length > 0) {
        setAsyncResolved((prev) => ({ ...prev, ...newlyFound }));
      }
      setFailedCities((prev) => {
        const pendingSet = new Set(syncResult.pending);
        const retained = prev.filter((id) => pendingSet.has(id) && !newlyFound[id]);
        return Array.from(new Set([...retained, ...notFound]));
      });
      setIsGeocoding(false);
    });

    return () => {
      cancelled = true;
    };
  }, [syncResult.pending]);

  const unresolvedCities = useMemo(
    () => failedCities.filter((id) => syncResult.pending.includes(id)),
    [failedCities, syncResult.pending]
  );

  const cities = useMemo(() => {
    const merged: Record<string, CityConfig> = { ...syncResult.resolved };
    for (const cityId of uniqueCityIds) {
      if (!merged[cityId] && asyncResolved[cityId]) {
        merged[cityId] = asyncResolved[cityId];
      }
    }
    return merged;
  }, [asyncResolved, syncResult.resolved, uniqueCityIds]);

  return {
    cities,
    isGeocoding,
    unresolvedCities,
  };
}

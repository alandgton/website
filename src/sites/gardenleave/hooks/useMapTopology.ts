import { useEffect, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import {
  decodeTopoJSON,
  normalizeGeoJsonWinding,
  TopoJSONTopology,
} from '../utils/topojsonDecoder';

interface MapTopologyState {
  countriesGeoJson: FeatureCollection<Geometry> | null;
  admin1GeoJson: FeatureCollection<Geometry> | null;
  isLoadingCountries: boolean;
  isLoadingAdmin1: boolean;
  error: string | null;
}

const topologyCache = new Map<string, FeatureCollection<Geometry>>();

export function useMapTopology(
  countriesTopoJsonUrl: string,
  admin1GeoJsonUrl: string,
  enableAdmin1: boolean,
  useHighResCountries: boolean = false
): MapTopologyState {
  const fallback50mUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

  const [countries50m, setCountries50m] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(fallback50mUrl) ?? null
  );
  const [countriesPrimary, setCountriesPrimary] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(countriesTopoJsonUrl) ?? null
  );
  const [admin1GeoJson, setAdmin1GeoJson] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(admin1GeoJsonUrl) ?? null
  );
  const [isLoadingCountries, setIsLoadingCountries] = useState<boolean>(
    !topologyCache.has(fallback50mUrl) && !topologyCache.has(countriesTopoJsonUrl)
  );
  const [admin1Failed, setAdmin1Failed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Always load lightweight 50m polygons immediately (< 80ms) for smooth 60fps mobile panning below 6x zoom
  useEffect(() => {
    let cancelled = false;
    if (topologyCache.has(fallback50mUrl)) {
      setCountries50m(topologyCache.get(fallback50mUrl)!);
      setIsLoadingCountries(false);
      return;
    }

    setIsLoadingCountries(true);
    fetch(fallback50mUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch 50m world topology (${res.status})`);
        return res.json();
      })
      .then((topo50m: TopoJSONTopology) => {
        if (cancelled) return;
        const decoded50m = decodeTopoJSON(topo50m, 'countries');
        topologyCache.set(fallback50mUrl, decoded50m);
        setCountries50m(decoded50m);
        setIsLoadingCountries(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (!topologyCache.has(countriesTopoJsonUrl)) {
          setError(err instanceof Error ? err.message : 'Failed to load world map topology');
        }
        setIsLoadingCountries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countriesTopoJsonUrl]);

  // 2. Load high-resolution 10m polygons when zoomed in (>= 6x) or if primary URL is different
  useEffect(() => {
    if (!useHighResCountries && countriesTopoJsonUrl.includes('countries-10m.json')) {
      return;
    }

    let cancelled = false;
    if (topologyCache.has(countriesTopoJsonUrl)) {
      setCountriesPrimary(topologyCache.get(countriesTopoJsonUrl)!);
      setIsLoadingCountries(false);
      return;
    }

    fetch(countriesTopoJsonUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch high-res world topology (${res.status})`);
        }
        return res.json();
      })
      .then((topology: TopoJSONTopology) => {
        if (cancelled) return;
        const decoded = decodeTopoJSON(topology, 'countries');
        topologyCache.set(countriesTopoJsonUrl, decoded);
        setCountriesPrimary(decoded);
        setIsLoadingCountries(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoadingCountries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countriesTopoJsonUrl, useHighResCountries]);

  useEffect(() => {
    if (!enableAdmin1) return;

    let cancelled = false;
    if (topologyCache.has(admin1GeoJsonUrl)) {
      setAdmin1GeoJson(topologyCache.get(admin1GeoJsonUrl)!);
      setAdmin1Failed(false);
      return;
    }

    setAdmin1Failed(false);
    fetch(admin1GeoJsonUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch Admin-1 boundaries (${res.status})`);
        }
        return res.json();
      })
      .then((data: TopoJSONTopology | FeatureCollection<Geometry>) => {
        if (cancelled) return;
        const normalized =
          data && data.type === 'Topology'
            ? decodeTopoJSON(data, 'admin1')
            : normalizeGeoJsonWinding(data);
        topologyCache.set(admin1GeoJsonUrl, normalized);
        setAdmin1GeoJson(normalized);
      })
      .catch(() => {
        if (cancelled) return;
        setAdmin1Failed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [admin1GeoJsonUrl, enableAdmin1]);

  const isLoadingAdmin1 = enableAdmin1 && !admin1GeoJson && !admin1Failed;

  const countriesGeoJson =
    useHighResCountries && countriesPrimary ? countriesPrimary : (countries50m ?? countriesPrimary);

  return {
    countriesGeoJson,
    admin1GeoJson,
    isLoadingCountries,
    isLoadingAdmin1,
    error,
  };
}

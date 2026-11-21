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
  enableAdmin1: boolean
): MapTopologyState {
  const [countriesGeoJson, setCountriesGeoJson] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(countriesTopoJsonUrl) ?? null
  );
  const [admin1GeoJson, setAdmin1GeoJson] = useState<FeatureCollection<Geometry> | null>(
    () => topologyCache.get(admin1GeoJsonUrl) ?? null
  );
  const [isLoadingCountries, setIsLoadingCountries] = useState<boolean>(
    () => !topologyCache.has(countriesTopoJsonUrl)
  );
  const [admin1Failed, setAdmin1Failed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load self-hosted 50m world + 10m Japan countries topology once (zero runtime LOD swaps)
  useEffect(() => {
    let cancelled = false;
    if (topologyCache.has(countriesTopoJsonUrl)) {
      setCountriesGeoJson(topologyCache.get(countriesTopoJsonUrl)!);
      setIsLoadingCountries(false);
      return;
    }

    setIsLoadingCountries(true);
    fetch(countriesTopoJsonUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch world topology (${res.status})`);
        return res.json();
      })
      .then((topology: TopoJSONTopology) => {
        if (cancelled) return;
        const decoded = decodeTopoJSON(topology, 'countries');
        topologyCache.set(countriesTopoJsonUrl, decoded);
        setCountriesGeoJson(decoded);
        setIsLoadingCountries(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load world map topology');
        setIsLoadingCountries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countriesTopoJsonUrl]);

  // 2. Load self-hosted US/Canada/China Admin-1 boundaries when Subregion granularity is active
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

  return {
    countriesGeoJson,
    admin1GeoJson,
    isLoadingCountries,
    isLoadingAdmin1,
    error,
  };
}

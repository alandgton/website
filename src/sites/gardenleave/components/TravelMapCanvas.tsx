import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoGraticule, geoPath, GeoProjection } from 'd3-geo';
import { ZoomTransform } from 'd3-zoom';
import type { FeatureCollection, Geometry } from 'geojson';
import {
  CityComputedStats,
  CityConfig,
  CityPhotoConfig,
  ItineraryLegConfig,
  MapGranularity,
  MapRenderConfig,
  TransitMode,
  TransitModeStyleConfig,
} from '../config/types';
import { SETO_INLAND_ISLANDS } from '../config/setoInlandIslands.config';
import { computeDirectionalTransitLine } from '../utils/arcMath';
import {
  indexGeoJsonFeatures,
  mapCitiesToAdmin1Features,
  mapCitiesToCountryFeatures,
} from '../utils/regionHitTesting';
import { computeSmartLabelLayout, LabelInputNode } from '../utils/labelLayout';
import { CitiesLayer } from './map/CitiesLayer';
import { CityLabelsLayer } from './map/CityLabelsLayer';
import { GeographyLayer } from './map/GeographyLayer';
import { MapHoverTooltip } from './map/MapHoverTooltip';
import { TransitArrowsLayer } from './map/TransitArrowsLayer';
import { TransitLinesLayer } from './map/TransitLinesLayer';
import { getCityPinRadius, hasJapanFeature } from './map/utils';
import type {
  CityViewMeta,
  ComputedLineEntry,
  MapHoverTooltipHandle,
  ProjectedCityNode,
} from './map/types';

interface TravelMapCanvasProps {
  svgRef: React.RefObject<SVGSVGElement>;
  cameraGroupRef: React.RefObject<SVGGElement>;
  projection: GeoProjection;
  transform: ZoomTransform;
  zoomK: number;
  invScale: number;
  labelScaleBoost: number;
  mapConfig: MapRenderConfig;
  cities: Record<string, CityConfig>;
  cityStats: Record<string, CityComputedStats>;
  cityPhotos?: Record<string, CityPhotoConfig[]>;
  itinerary: ItineraryLegConfig[];
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  visibleModes: Record<TransitMode, boolean>;
  countriesGeoJson: FeatureCollection<Geometry> | null;
  admin1GeoJson: FeatureCollection<Geometry> | null;
  isLoadingAdmin1?: boolean;
  granularity: MapGranularity;
  showGraticule: boolean;
  selectedCityId: string | null;
  selectedLegId: number | null;
  isTimelineEnabled: boolean;
  currentTimelineLegIndex: number; // 0-based index into itinerary
  onSelectCity: (cityId: string) => void;
  onSelectLeg: (leg: ItineraryLegConfig) => void;
  onClearSelection: () => void;
  onHoverCity?: (cityId: string | null) => void;
}

const EMPTY_NEIGHBORS = new Set<string>();

export const TravelMapCanvas: React.FC<TravelMapCanvasProps> = React.memo(({
  svgRef,
  cameraGroupRef,
  projection,
  transform,
  zoomK,
  invScale,
  labelScaleBoost,
  mapConfig,
  cities,
  cityStats,
  cityPhotos,
  itinerary,
  transitModes,
  visibleModes,
  countriesGeoJson,
  admin1GeoJson,
  isLoadingAdmin1 = false,
  granularity,
  showGraticule,
  selectedCityId,
  selectedLegId,
  isTimelineEnabled,
  currentTimelineLegIndex,
  onSelectCity,
  onSelectLeg,
  onClearSelection,
  onHoverCity,
}) => {
  const isSubregion = granularity === 'subregion';
  const isNone = granularity === 'none';

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<MapHoverTooltipHandle>(null);

  // Only updated on leg mouseenter/mouseleave (never on mousemove or city hover)
  // so focused directional arrows highlight without re-rendering on pointer movement.
  const [hoveredLegId, setHoveredLegId] = useState<number | null>(null);

  useEffect(() => {
    if (isTimelineEnabled) {
      setHoveredLegId(null);
    }
  }, [isTimelineEnabled]);

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const spherePath = useMemo(() => {
    return pathGenerator({ type: 'Sphere' }) || '';
  }, [pathGenerator]);

  const graticulePath = useMemo(() => {
    const graticule = geoGraticule().step([15, 15]);
    return pathGenerator(graticule()) || '';
  }, [pathGenerator]);

  const indexedCountries = useMemo(
    () => indexGeoJsonFeatures(countriesGeoJson),
    [countriesGeoJson]
  );

  const indexedAdmin1 = useMemo(
    () => (isSubregion ? indexGeoJsonFeatures(admin1GeoJson) : []),
    [admin1GeoJson, isSubregion]
  );

  const cityToCountryFeatureIds = useMemo(
    () => mapCitiesToCountryFeatures(indexedCountries, cities),
    [indexedCountries, cities]
  );

  const { cityToAdmin1Ids, subdividedCountryNames } = useMemo(
    () => mapCitiesToAdmin1Features(indexedAdmin1, cities),
    [indexedAdmin1, cities]
  );

  const countryPaths = useMemo(() => {
    return indexedCountries
      .map((item) => ({
        id: item.id,
        normName: item.normName,
        d: pathGenerator(item.feature) || '',
      }))
      .filter((item) => Boolean(item.d));
  }, [indexedCountries, pathGenerator]);

  const admin1Paths = useMemo(() => {
    if (!isSubregion || indexedAdmin1.length === 0) return [];
    return indexedAdmin1
      .map((item) => ({
        id: item.id,
        normName: item.normName,
        d: pathGenerator(item.feature) || '',
      }))
      .filter((item) => Boolean(item.d));
  }, [indexedAdmin1, pathGenerator, isSubregion]);

  const setoIslandPaths = useMemo(() => {
    return SETO_INLAND_ISLANDS.features
      .map((item) => ({
        id: item.id as string,
        name: (item.properties?.name as string) || 'Island',
        d: pathGenerator(item) || '',
      }))
      .filter((item) => Boolean(item.d));
  }, [pathGenerator]);

  // Precompute projected coordinates for all cities
  const projectedCities = useMemo(() => {
    const map: Record<string, ProjectedCityNode> = {};
    for (const [id, city] of Object.entries(cities)) {
      const pt = projection(city.coordinates);
      if (pt) {
        map[id] = { city, x: pt[0], y: pt[1] };
      }
    }
    return map;
  }, [cities, projection]);

  const homeCityId = itinerary[0]?.source ?? 'NYC';

  // Precompute city view metadata (base radius, home flag, and neighbor adjacency) once
  const cityViewMeta = useMemo(() => {
    const neighborsByCity: Record<string, Set<string>> = {};
    for (const leg of itinerary) {
      if (!neighborsByCity[leg.source]) neighborsByCity[leg.source] = new Set();
      if (!neighborsByCity[leg.dest]) neighborsByCity[leg.dest] = new Set();
      neighborsByCity[leg.source].add(leg.dest);
      neighborsByCity[leg.dest].add(leg.source);
    }

    const meta: Record<string, CityViewMeta> = {};
    for (const cityId of Object.keys(cities)) {
      const stats = cityStats[cityId];
      const totalNights = stats?.totalNights ?? 0;
      const connectionCount =
        (stats?.arrivals.length ?? 0) + (stats?.departures.length ?? 0);
      const isHomeCity = cityId === homeCityId;
      const nightBonus =
        totalNights === 0 ? -0.4 : Math.min(2.0, Math.sqrt(totalNights) * 0.38);
      // Home city uses a fixed base size equal to the largest regular pin (2.8 + max nightBonus 2.0)
      const baseRadiusUnscaled = isHomeCity ? 4.8 : 2.8 + nightBonus;

      meta[cityId] = {
        totalNights,
        connectionCount,
        isHomeCity,
        baseRadiusUnscaled,
        neighbors: neighborsByCity[cityId] ?? EMPTY_NEIGHBORS,
      };
    }

    return meta;
  }, [cities, cityStats, homeCityId, itinerary]);

  // Precompute all directional straight transit lines (with parallel offset for bidirectional pairs)
  const computedLines = useMemo(() => {
    const directedPairs = new Set<string>();
    for (const leg of itinerary) {
      directedPairs.add(`${leg.source}__${leg.dest}`);
    }

    const list: ComputedLineEntry[] = [];

    itinerary.forEach((leg, index) => {
      const sourceCity = cities[leg.source];
      const destCity = cities[leg.dest];
      if (!sourceCity || !destCity) return;

      const isBidirectional = directedPairs.has(`${leg.dest}__${leg.source}`);
      const parallelOffsetPx = isBidirectional
        ? mapConfig.bidirectionalParallelOffset * invScale
        : 0;

      const sourceBaseR = cityViewMeta[leg.source]?.baseRadiusUnscaled ?? 2.4;
      const destBaseR = cityViewMeta[leg.dest]?.baseRadiusUnscaled ?? 2.4;
      const sourcePinR = (sourceBaseR + 0.75) * invScale;
      const destPinR = (destBaseR + 0.75) * invScale;

      const line = computeDirectionalTransitLine(
        sourceCity.coordinates,
        destCity.coordinates,
        projection,
        mapConfig.width,
        parallelOffsetPx,
        mapConfig.antimeridianThresholdRatio,
        sourcePinR,
        destPinR
      );
      if (line) {
        list.push({ leg, index, line });
      }
    });

    return list;
  }, [
    cities,
    cityViewMeta,
    invScale,
    itinerary,
    mapConfig.antimeridianThresholdRatio,
    mapConfig.bidirectionalParallelOffset,
    mapConfig.width,
    projection,
  ]);

  const activeTimelineLeg = isTimelineEnabled ? itinerary[currentTimelineLegIndex] : null;
  const activeTimelineSource = activeTimelineLeg?.source;
  const activeTimelineDest = activeTimelineLeg?.dest;

  // Determine which cities are visited up to the current timeline step
  const visitedCitiesInTimeline = useMemo(() => {
    if (!isTimelineEnabled) return null;
    const set = new Set<string>();
    for (let i = 0; i <= currentTimelineLegIndex && i < itinerary.length; i++) {
      set.add(itinerary[i].source);
      set.add(itinerary[i].dest);
    }
    return set;
  }, [currentTimelineLegIndex, isTimelineEnabled, itinerary]);

  const labelFontSize = 8.6 * invScale * labelScaleBoost;

  // Compute collision-free multi-direction label placements for all projected cities
  const smartLabelPlacements = useMemo(() => {
    const nodes: LabelInputNode[] = Object.values(projectedCities).map(({ city, x, y }) => {
      const meta = cityViewMeta[city.id];
      const totalNights = meta?.totalNights ?? 0;
      const connectionCount = meta?.connectionCount ?? 0;
      const isHomeCity = meta?.isHomeCity ?? false;

      const isSelected = selectedCityId === city.id;
      const isTimelineActiveDest = activeTimelineDest === city.id;
      const isTimelineActiveSource = activeTimelineSource === city.id;
      const isConnectedToSelectedCity = Boolean(
        selectedCityId !== null && meta?.neighbors.has(selectedCityId)
      );

      const radius = getCityPinRadius(meta?.baseRadiusUnscaled ?? 2.8, invScale, {
        isSelected,
        isTimelineActiveDest,
        isTimelineActiveSource,
        isConnectedToSelectedCity,
      });

      let priority = totalNights * 100 + connectionCount * 15;
      if (isSelected) priority += 100000;
      if (isTimelineActiveDest) priority += 90000;
      if (isTimelineActiveSource) priority += 80000;
      if (isHomeCity) priority += 75000;
      if (isConnectedToSelectedCity) priority += 50000;

      return {
        id: city.id,
        name: city.name,
        x,
        y,
        radius,
        priority,
        forceShow: isSelected || isTimelineActiveDest || isTimelineActiveSource || isHomeCity,
      };
    });

    return computeSmartLabelLayout(nodes, invScale, labelFontSize, zoomK);
  }, [
    activeTimelineDest,
    activeTimelineSource,
    cityViewMeta,
    invScale,
    labelFontSize,
    projectedCities,
    selectedCityId,
    zoomK,
  ]);

  // Compute highlighted country feature IDs and Admin-1 province/state feature IDs
  const {
    visitedCountryFeatureIds,
    activeCountryFeatureIds,
    visitedAdmin1FeatureIds,
    activeAdmin1FeatureIds,
  } = useMemo(() => {
    const visitedCountries = new Set<string>();
    const activeCountries = new Set<string>();
    const visitedAdmin1 = new Set<string>();
    const activeAdmin1 = new Set<string>();

    const activeCityIds = visitedCitiesInTimeline
      ? Array.from(visitedCitiesInTimeline)
      : Object.keys(cities);

    for (const cityId of activeCityIds) {
      for (const cId of cityToCountryFeatureIds[cityId] ?? []) {
        visitedCountries.add(cId);
      }
      for (const aId of cityToAdmin1Ids[cityId] ?? []) {
        visitedAdmin1.add(aId);
      }
    }

    const focusCityId = selectedCityId ?? activeTimelineDest ?? null;
    if (focusCityId) {
      for (const cId of cityToCountryFeatureIds[focusCityId] ?? []) {
        activeCountries.add(cId);
      }
      for (const aId of cityToAdmin1Ids[focusCityId] ?? []) {
        activeAdmin1.add(aId);
      }
    }

    return {
      visitedCountryFeatureIds: visitedCountries,
      activeCountryFeatureIds: activeCountries,
      visitedAdmin1FeatureIds: visitedAdmin1,
      activeAdmin1FeatureIds: activeAdmin1,
    };
  }, [
    activeTimelineDest,
    cities,
    cityToAdmin1Ids,
    cityToCountryFeatureIds,
    selectedCityId,
    visitedCitiesInTimeline,
  ]);

  const isJapanVisited = useMemo(
    () => hasJapanFeature(visitedCountryFeatureIds),
    [visitedCountryFeatureIds]
  );

  const isJapanActive = useMemo(
    () => hasJapanFeature(activeCountryFeatureIds),
    [activeCountryFeatureIds]
  );

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.target === e.currentTarget || (e.target as SVGElement).dataset.bg === 'true') {
        onClearSelection();
      }
    },
    [onClearSelection]
  );

  const showCityTooltip = useCallback(
    (cityId: string, clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        tooltipRef.current?.show({
          type: 'city',
          x: clientX - rect.left,
          y: clientY - rect.top,
          cityId,
        });
      }
    },
    []
  );

  const handleEnterCity = useCallback(
    (cityId: string, clientX: number, clientY: number) => {
      onHoverCity?.(cityId);
      showCityTooltip(cityId, clientX, clientY);
    },
    [onHoverCity, showCityTooltip]
  );

  const handleLeaveCity = useCallback(() => {
    onHoverCity?.(null);
    tooltipRef.current?.hide();
  }, [onHoverCity]);

  const showLegTooltip = useCallback(
    (leg: ItineraryLegConfig, clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        tooltipRef.current?.show({
          type: 'leg',
          x: clientX - rect.left,
          y: clientY - rect.top,
          leg,
        });
      }
    },
    []
  );

  const handleEnterLeg = useCallback(
    (leg: ItineraryLegConfig, clientX: number, clientY: number) => {
      setHoveredLegId(leg.id);
      showLegTooltip(leg, clientX, clientY);
    },
    [showLegTooltip]
  );

  const handleLeaveLeg = useCallback((legId: number) => {
    setHoveredLegId((prev) => (prev === legId ? null : prev));
    tooltipRef.current?.hide();
  }, []);

  const handleSvgMouseLeave = useCallback(() => {
    setHoveredLegId(null);
    onHoverCity?.(null);
    tooltipRef.current?.hide();
  }, [onHoverCity]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-950 overflow-hidden select-none"
    >
      {/* Subtle radial atmospheric glow behind the globe */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(14, 165, 233, 0.08) 0%, rgba(15, 23, 42, 0.4) 55%, rgba(6, 9, 19, 0.95) 100%)',
        }}
      />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${mapConfig.width} ${mapConfig.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
        onClick={handleBackgroundClick}
        onMouseLeave={handleSvgMouseLeave}
      >
        <defs>
          <radialGradient id="oceanGradient" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#0b1528" />
            <stop offset="70%" stopColor="#070d19" />
            <stop offset="100%" stopColor="#040811" />
          </radialGradient>
        </defs>

        <rect
          width={mapConfig.width}
          height={mapConfig.height}
          fill="transparent"
          data-bg="true"
        />

        {/* D3 Zoom/Pan Transform Container (updated directly via DOM ref during gestures for 60-120fps) */}
        <g ref={cameraGroupRef} transform={transform.toString()}>
          <GeographyLayer
            spherePath={spherePath}
            countryPaths={countryPaths}
            admin1Paths={admin1Paths}
            setoIslandPaths={setoIslandPaths}
            graticulePath={graticulePath}
            subdividedCountryNames={subdividedCountryNames}
            visitedCountryFeatureIds={visitedCountryFeatureIds}
            activeCountryFeatureIds={activeCountryFeatureIds}
            visitedAdmin1FeatureIds={visitedAdmin1FeatureIds}
            activeAdmin1FeatureIds={activeAdmin1FeatureIds}
            isSubregion={isSubregion}
            isLoadingAdmin1={isLoadingAdmin1}
            isNone={isNone}
            showGraticule={showGraticule}
            isJapanVisited={isJapanVisited}
            isJapanActive={isJapanActive}
          />

          <TransitLinesLayer
            computedLines={computedLines}
            visibleModes={visibleModes}
            transitModes={transitModes}
            isTimelineEnabled={isTimelineEnabled}
            currentTimelineLegIndex={currentTimelineLegIndex}
            selectedLegId={selectedLegId}
            selectedCityId={selectedCityId}
            invScale={invScale}
            onSelectLeg={onSelectLeg}
            onEnterLeg={handleEnterLeg}
            onMoveLeg={showLegTooltip}
            onLeaveLeg={handleLeaveLeg}
          />

          <CitiesLayer
            projectedCities={projectedCities}
            cityViewMeta={cityViewMeta}
            selectedCityId={selectedCityId}
            activeTimelineSource={activeTimelineSource}
            activeTimelineDest={activeTimelineDest}
            visitedCitiesInTimeline={visitedCitiesInTimeline}
            isTimelineEnabled={isTimelineEnabled}
            invScale={invScale}
            onSelectCity={onSelectCity}
            onEnterCity={handleEnterCity}
            onMoveCity={showCityTooltip}
            onLeaveCity={handleLeaveCity}
          />

          <TransitArrowsLayer
            computedLines={computedLines}
            visibleModes={visibleModes}
            transitModes={transitModes}
            isTimelineEnabled={isTimelineEnabled}
            selectedLegId={selectedLegId}
            selectedCityId={selectedCityId}
            hoveredLegId={hoveredLegId}
            invScale={invScale}
          />

          <CityLabelsLayer
            projectedCities={projectedCities}
            cityViewMeta={cityViewMeta}
            smartLabelPlacements={smartLabelPlacements}
            selectedCityId={selectedCityId}
            activeTimelineDest={activeTimelineDest}
            visitedCitiesInTimeline={visitedCitiesInTimeline}
            isTimelineEnabled={isTimelineEnabled}
            labelFontSize={labelFontSize}
            invScale={invScale}
            labelScaleBoost={labelScaleBoost}
          />
        </g>
      </svg>

      {/* Isolated Imperative Hover Tooltip (0 canvas re-renders on mousemove/city hover) */}
      <MapHoverTooltip
        ref={tooltipRef}
        containerRef={containerRef}
        cities={cities}
        cityStats={cityStats}
        cityPhotos={cityPhotos}
        transitModes={transitModes}
        homeCityId={homeCityId}
      />
    </div>
  );
});

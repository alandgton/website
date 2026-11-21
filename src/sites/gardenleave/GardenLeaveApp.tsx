import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoProjection } from 'd3-geo';
import { Loader2 } from 'lucide-react';
import {
  DEFAULT_TRAVEL_MAP_CONFIG,
  getPhotosForCity,
  ItineraryLegConfig,
  MapGranularity,
  RegionCameraConfig,
  TransitMode,
} from './config';
import { useMapCamera } from './hooks/useMapCamera';
import { useMapTopology } from './hooks/useMapTopology';
import { usePhotoPreloader } from './hooks/usePhotoPreloader';
import { useResolvedCities } from './hooks/useResolvedCities';
import { computeAllCityStats, computeLegsByMode, formatNights } from './utils/itineraryStats';
import { CityPhotoPostcard } from './components/CityPhotoPostcard';
import { ItineraryModal } from './components/ItineraryModal';
import { RegionSelectorBar } from './components/RegionSelectorBar';
import { JourneyPlayback } from './components/JourneyPlayback';
import { TransitLegendBar } from './components/TransitLegendBar';
import { TravelMapCanvas } from './components/TravelMapCanvas';

// Minimum and maximum on-screen leg span thresholds (in zoomed 1200x675 SVG viewBox units)
// within which Follow Camera holds its current zoom level and performs a pure pan.
const MIN_ZOOM_SPAN_THRESHOLD = 10;
const MAX_ZOOM_SPAN_THRESHOLD = 380;

// Default steady high-zoom level for Shimanami Kaido micro-cluster island hops
// and the intermediate approach zoom when arriving at the cluster origin (Onomichi).
const DEFAULT_MICRO_CLUSTER_ZOOM = 185;
const MICRO_CLUSTER_APPROACH_ZOOM = 32;

function isMicroClusterLeg(
  sourceCoords: [number, number] | undefined,
  destCoords: [number, number] | undefined,
  transport: TransitMode
): boolean {
  if (transport === 'Bike') return true;
  if (!sourceCoords || !destCoords) return false;
  const rawDLon = Math.abs(sourceCoords[0] - destCoords[0]);
  const dLon = Math.min(rawDLon, 360 - rawDLon);
  const dLat = Math.abs(sourceCoords[1] - destCoords[1]);
  return Math.hypot(dLon, dLat) < 0.35;
}

/**
 * Computes an adaptive camera zoom level for a leg with a screen-space min/max distance
 * deadband so consecutive regional stops (e.g. across Europe or Mainland China) or
 * micro-cluster island hops (Shimanami Kaido) pan smoothly at a constant zoom level
 * without unnecessary zooming in and out.
 */
function getContextualZoomForLeg(
  sourceCoords: [number, number] | undefined,
  destCoords: [number, number],
  transport: TransitMode,
  currentZoomK: number,
  projection: GeoProjection,
  microClusterZoom: number = DEFAULT_MICRO_CLUSTER_ZOOM,
  isApproachingMicroCluster: boolean = false
): number {
  if (isMicroClusterLeg(sourceCoords, destCoords, transport)) {
    return microClusterZoom;
  }
  if (isApproachingMicroCluster) {
    return MICRO_CLUSTER_APPROACH_ZOOM;
  }
  if (!sourceCoords) {
    return 5.8;
  }

  const rawDLon = Math.abs(sourceCoords[0] - destCoords[0]);
  const dLon = Math.min(rawDLon, 360 - rawDLon);
  const dLat = Math.abs(sourceCoords[1] - destCoords[1]);
  const span = Math.hypot(dLon, dLat);

  // Base zoom tiers:
  // - < 0.35°: Micro-cluster hops (Shimanami Kaido island chain) -> steady microClusterZoom
  // - 0.35°..18°: Regional travel (intra-Europe, Egypt, Mainland China, Korea & Japan) -> 5.8x
  // - 18°..42°: Cross-regional medium-haul flights (e.g. Munich->Cairo, Singapore->Chengdu) -> 3.6x
  // - >= 42°: Long-haul / intercontinental flights (e.g. NYC->SF, NYC->Stockholm, Tokyo->LA) -> 2.6x
  let idealZoom: number;
  if (span < 0.35) {
    idealZoom = microClusterZoom;
  } else if (span < 18) {
    idealZoom = 5.8;
  } else if (span < 42) {
    idealZoom = 3.6;
  } else {
    idealZoom = 2.6;
  }

  // Min/Max projected distance deadband:
  // When the leg's on-screen distance at currentZoomK is already within [MIN, MAX] and
  // currentZoomK is within the same regional tier band, hold currentZoomK for a pure pan.
  const pSource = projection(sourceCoords);
  const pDest = projection(destCoords);
  if (pSource && pDest && rawDLon < 180) {
    const projectedDist = Math.hypot(pDest[0] - pSource[0], pDest[1] - pSource[1]);
    const zoomedSpan = projectedDist * currentZoomK;
    const isWithinDistanceDeadband =
      zoomedSpan >= MIN_ZOOM_SPAN_THRESHOLD && zoomedSpan <= MAX_ZOOM_SPAN_THRESHOLD;
    const isWithinTierHysteresis =
      currentZoomK >= idealZoom * 0.78 && currentZoomK <= idealZoom * 1.35;

    if (isWithinDistanceDeadband && isWithinTierHysteresis) {
      return currentZoomK;
    }
  }

  return idealZoom;
}

const {
  title: MAP_TITLE,
  subtitle: MAP_SUBTITLE,
  regions: BASE_REGIONS,
  itinerary: ITINERARY_LEGS,
  transitModes: TRANSIT_MODES,
  mapConfig: MAP_RENDER_CONFIG,
  cityPhotos: CITY_PHOTOS,
} = DEFAULT_TRAVEL_MAP_CONFIG;

export const App: React.FC = () => {
  // Layer visibility & granularity controls
  const [granularity, setGranularity] = useState<MapGranularity>('subregion');
  const [showGraticule, setShowGraticule] = useState<boolean>(true);

  const [visibleModes, setVisibleModes] = useState<Record<TransitMode, boolean>>({
    Flight: true,
    Train: true,
    Drive: true,
    Bike: true,
  });

  // Selection State
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<number | null>(null);
  const [isItineraryModalOpen, setIsItineraryModalOpen] = useState<boolean>(false);

  // HUD overlay refs for dynamic unobstructed-viewport centering during Journey Playback
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const postcardRef = useRef<HTMLElement>(null);

  // Opt-In Journey Playback State
  const [isTimelineEnabled, setIsTimelineEnabled] = useState<boolean>(false);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState<number>(0);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(1400);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [isPostcardHovered, setIsPostcardHovered] = useState<boolean>(false);

  // Lookahead & hover-intent photo preloader (0 bytes on initial load)
  const { preloadCity } = usePhotoPreloader(
    CITY_PHOTOS,
    ITINERARY_LEGS,
    isTimelineEnabled,
    currentTimelineIndex,
    selectedCityId
  );

  const {
    svgRef,
    cameraGroupRef,
    projection,
    transform,
    zoomK,
    invScale,
    labelScaleBoost,
    isMobileViewport,
    activeRegionId,
    computeBoundsFit,
    flyToCoordinates,
    flyToRegion,
  } = useMapCamera(MAP_RENDER_CONFIG);

  // Map Topology Hook (self-hosted 50m world + 10m Japan for Shimanami Kaido, plus US/CA/CN Admin-1)
  const {
    countriesGeoJson,
    admin1GeoJson,
    isLoadingCountries,
    isLoadingAdmin1,
    error: topologyError,
  } = useMapTopology(
    MAP_RENDER_CONFIG.countriesTopoJsonUrl,
    MAP_RENDER_CONFIG.admin1GeoJsonUrl,
    granularity === 'subregion'
  );

  // Automatically resolve city coordinates from the itinerary's source & dest city names
  const {
    cities: resolvedCities,
    isGeocoding,
    unresolvedCities,
  } = useResolvedCities(ITINERARY_LEGS);

  // Compute responsive region presets (e.g. dynamic viewport fit for Shimanami Kaido island stops)
  const effectiveRegions = useMemo(() => {
    const map: Record<string, RegionCameraConfig> = {};
    for (const [id, region] of Object.entries(BASE_REGIONS)) {
      if (region.fitCities && region.fitCities.length >= 2) {
        const coordsList = region.fitCities
          .map((cid) => resolvedCities[cid]?.coordinates)
          .filter((c): c is [number, number] => Boolean(c));
        const fit = computeBoundsFit(coordsList, {
          minZoom: region.zoom * 0.75,
        });
        if (fit) {
          map[id] = {
            ...region,
            center: fit.center,
            zoom: fit.zoom,
          };
          continue;
        }
      }
      map[id] = region;
    }
    return map;
  }, [computeBoundsFit, resolvedCities]);

  // Steady high-zoom level shared across the Shimanami Kaido stretch
  const shimanamiClusterZoom =
    effectiveRegions.shimanami?.zoom ?? DEFAULT_MICRO_CLUSTER_ZOOM;

  // Derived Statistics
  const cityStats = useMemo(
    () => computeAllCityStats(resolvedCities, ITINERARY_LEGS),
    [resolvedCities]
  );

  const legsByMode = useMemo(() => computeLegsByMode(ITINERARY_LEGS), []);

  // Track active camera zoom and playback speed in refs so Follow Camera calculations read
  // latest values without re-triggering the timeline follow effect when zoom settles or speed changes.
  const currentZoomKRef = useRef<number>(zoomK);
  useEffect(() => {
    currentZoomKRef.current = zoomK;
  }, [zoomK]);

  const playbackSpeedMsRef = useRef<number>(playbackSpeedMs);
  useEffect(() => {
    playbackSpeedMsRef.current = playbackSpeedMs;
  }, [playbackSpeedMs]);

  const followRafIdRef = useRef<number | null>(null);

  // Computes the SVG viewBox center and usable dimensions of the remaining unobstructed map area
  // after excluding the top floating bar, bottom playback/legend footer, and top-left photo postcard.
  const getPlaybackViewportMetrics = useCallback((): {
    center: [number, number];
    availSvgW: number;
    availSvgH: number;
  } | null => {
    const svgEl = svgRef.current;
    if (!svgEl) return null;

    const svgRect = svgEl.getBoundingClientRect();
    if (svgRect.width <= 0 || svgRect.height <= 0) return null;

    const { width: mapW, height: mapH } = MAP_RENDER_CONFIG;
    const svgScale = Math.min(svgRect.width / mapW, svgRect.height / mapH);
    if (svgScale <= 0) return null;

    let topInset = 0;
    let bottomInset = 0;
    let leftInset = 0;

    if (headerRef.current) {
      const headerRect = headerRef.current.getBoundingClientRect();
      topInset = Math.max(0, headerRect.bottom - svgRect.top);
    }

    if (footerRef.current) {
      const footerRect = footerRef.current.getBoundingClientRect();
      bottomInset = Math.max(0, svgRect.bottom - footerRect.top);
    }

    if (postcardRef.current) {
      const postcardRect = postcardRef.current.getBoundingClientRect();
      if (postcardRect.width > 0 && postcardRect.height > 0) {
        leftInset = Math.max(0, postcardRect.right - svgRect.left);
      }
    }

    const availLeft = svgRect.left + leftInset;
    const availRight = svgRect.right;
    const availTop = svgRect.top + topInset;
    const availBottom = svgRect.bottom - bottomInset;

    if (availRight - availLeft < 40 || availBottom - availTop < 40) {
      return null;
    }

    const availCenterX = (availLeft + availRight) / 2;
    const availCenterY = (availTop + availBottom) / 2;
    const svgCenterX = svgRect.left + svgRect.width / 2;
    const svgCenterY = svgRect.top + svgRect.height / 2;

    return {
      center: [
        mapW / 2 + (availCenterX - svgCenterX) / svgScale,
        mapH / 2 + (availCenterY - svgCenterY) / svgScale,
      ],
      availSvgW: (availRight - availLeft) / svgScale,
      availSvgH: (availBottom - availTop) / svgScale,
    };
  }, [svgRef]);

  // Follow camera effect when timeline index advances (always enabled)
  const followLegDestination = useCallback(
    (legIndex: number) => {
      const leg = ITINERARY_LEGS[legIndex];
      if (!leg) return;
      const destCity = resolvedCities[leg.dest];
      const sourceCity = resolvedCities[leg.source];
      if (!destCity) return;

      // Detect whether the upcoming leg enters a micro-cluster (e.g. Kyoto -> Onomichi before Onomichi -> Setoda)
      // so the camera steps into an intermediate approach zoom on arrival before zooming to cluster scale.
      const nextLeg = ITINERARY_LEGS[legIndex + 1];
      const nextSourceCoords = nextLeg ? resolvedCities[nextLeg.source]?.coordinates : undefined;
      const nextDestCoords = nextLeg ? resolvedCities[nextLeg.dest]?.coordinates : undefined;
      const isCurrMicro = isMicroClusterLeg(
        sourceCity?.coordinates,
        destCity.coordinates,
        leg.transport
      );
      const isNextMicro = nextLeg
        ? isMicroClusterLeg(nextSourceCoords, nextDestCoords, nextLeg.transport)
        : false;
      const isApproachingMicroCluster = !isCurrMicro && isNextMicro;

      let targetZoom = getContextualZoomForLeg(
        sourceCity?.coordinates,
        destCity.coordinates,
        leg.transport,
        currentZoomKRef.current,
        projection,
        shimanamiClusterZoom,
        isApproachingMicroCluster
      );

      const metrics = getPlaybackViewportMetrics();

      // Frame both source and destination pins within the unobstructed safe zone for every leg
      // (including transpacific legs and long vertical/horizontal legs) by capping targetZoom
      // to fit |pDest - pSource| inside (availSvgW, availSvgH) and centering on their midpoint.
      let focusCoords: [number, number] = destCity.coordinates;
      if (sourceCity && metrics && projection.invert) {
        const pSource = projection(sourceCity.coordinates);
        const pDest = projection(destCity.coordinates);
        if (pSource && pDest) {
          const spanX = Math.abs(pDest[0] - pSource[0]);
          const spanY = Math.abs(pDest[1] - pSource[1]);
          const maxFitZoom = Math.max(
            MAP_RENDER_CONFIG.scaleExtent[0],
            Math.min(
              (metrics.availSvgW * 0.72) / Math.max(spanX, 1),
              (metrics.availSvgH * 0.68) / Math.max(spanY, 1)
            )
          );
          targetZoom = Math.min(targetZoom, maxFitZoom);

          const midX = (pSource[0] + pDest[0]) * 0.5;
          const midY = (pSource[1] + pDest[1]) * 0.5;
          const inverted = projection.invert([midX, midY]);
          if (inverted) {
            focusCoords = inverted;
          }
        }
      }

      currentZoomKRef.current = targetZoom;

      flyToCoordinates(
        focusCoords,
        targetZoom,
        Math.min(850, playbackSpeedMsRef.current * 0.75),
        null,
        metrics?.center ?? null
      );
    },
    [
      resolvedCities,
      flyToCoordinates,
      getPlaybackViewportMetrics,
      projection,
      shimanamiClusterZoom,
    ]
  );

  const scheduleFollowLeg = useCallback(
    (legIndex: number) => {
      if (followRafIdRef.current !== null) {
        window.cancelAnimationFrame(followRafIdRef.current);
      }
      followRafIdRef.current = window.requestAnimationFrame(() => {
        followRafIdRef.current = null;
        followLegDestination(legIndex);
      });
    },
    [followLegDestination]
  );

  useEffect(() => {
    return () => {
      if (followRafIdRef.current !== null) {
        window.cancelAnimationFrame(followRafIdRef.current);
        followRafIdRef.current = null;
      }
    };
  }, []);

  // Reset active photo index whenever the timeline leg or selected city changes
  useEffect(() => {
    setActivePhotoIndex(0);
  }, [currentTimelineIndex, selectedCityId]);

  // Auto-advance timer when timeline playback is active (shows the city's primary cover photo
  // without auto-cycling multiple photos; pauses while hovered/touched for manual browsing)
  useEffect(() => {
    if (!isTimelineEnabled || !isPlayingTimeline || isPostcardHovered) return;

    const timer = window.setTimeout(() => {
      if (currentTimelineIndex + 1 >= ITINERARY_LEGS.length) {
        setIsPlayingTimeline(false);
      } else {
        setCurrentTimelineIndex(currentTimelineIndex + 1);
      }
    }, playbackSpeedMs);

    return () => window.clearTimeout(timer);
  }, [
    currentTimelineIndex,
    isPlayingTimeline,
    isPostcardHovered,
    isTimelineEnabled,
    playbackSpeedMs,
  ]);

  // Derive effective selected leg ID so advancing currentTimelineIndex does not require a second cascading state update
  const effectiveSelectedLegId = isTimelineEnabled
    ? (ITINERARY_LEGS[currentTimelineIndex]?.id ?? selectedLegId)
    : selectedLegId;

  // Trigger camera follow whenever currentTimelineIndex changes while timeline is enabled
  useEffect(() => {
    if (!isTimelineEnabled) {
      if (followRafIdRef.current !== null) {
        window.cancelAnimationFrame(followRafIdRef.current);
        followRafIdRef.current = null;
      }
      return;
    }
    scheduleFollowLeg(currentTimelineIndex);
  }, [currentTimelineIndex, isTimelineEnabled, scheduleFollowLeg]);

  // Handlers
  const handleSelectRegion = useCallback(
    (region: RegionCameraConfig) => {
      flyToRegion(region, 850);
    },
    [flyToRegion]
  );

  const handleToggleMode = useCallback((mode: TransitMode) => {
    setVisibleModes((prev) => ({
      ...prev,
      [mode]: !prev[mode],
    }));
  }, []);

  const handleSelectCity = useCallback((cityId: string) => {
    if (!cityId) {
      setSelectedCityId(null);
      setSelectedLegId(null);
      return;
    }
    setSelectedCityId(cityId);
    setSelectedLegId(null);
  }, []);

  const handleSelectLeg = useCallback((leg: ItineraryLegConfig) => {
    setSelectedLegId(leg.id);
    setSelectedCityId(leg.dest);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedCityId(null);
    setSelectedLegId(null);
  }, []);

  const handleToggleTimelineEnabled = useCallback((enabled: boolean) => {
    setIsTimelineEnabled(enabled);
    setActivePhotoIndex(0);
    if (!enabled) {
      setIsPlayingTimeline(false);
      setIsPostcardHovered(false);
      setSelectedLegId(null);
    }
  }, []);

  const handlePlaybackLayoutHeightChange = useCallback(() => {
    if (!isTimelineEnabled) return;
    scheduleFollowLeg(currentTimelineIndex);
  }, [currentTimelineIndex, isTimelineEnabled, scheduleFollowLeg]);

  // Determine active city and photo gallery for the floating postcard HUD
  const activeTimelineLeg = isTimelineEnabled
    ? ITINERARY_LEGS[currentTimelineIndex]
    : null;
  const postcardCityId = isTimelineEnabled
    ? (activeTimelineLeg?.dest ?? null)
    : selectedCityId;
  const postcardPhotos = useMemo(
    () => getPhotosForCity(postcardCityId, CITY_PHOTOS),
    [postcardCityId]
  );
  const shouldMountPostcard =
    Boolean(postcardCityId) &&
    postcardPhotos.length > 0 &&
    (!isTimelineEnabled || !isMobileViewport);

  // Ensure desktop postcard hover state never stays stuck when the postcard is hidden, unmounted, or on mobile
  useEffect(() => {
    if (!isTimelineEnabled || isMobileViewport || !postcardCityId || postcardPhotos.length === 0) {
      setIsPostcardHovered(false);
    }
  }, [isMobileViewport, isTimelineEnabled, postcardCityId, postcardPhotos.length]);
  const postcardSubtitle = activeTimelineLeg
    ? `${activeTimelineLeg.startDate} → ${activeTimelineLeg.endDate}`
    : postcardCityId && cityStats[postcardCityId]
      ? `${formatNights(cityStats[postcardCityId].totalNights, '0 nights')} stayed`
      : undefined;

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Top HUD: Title, Region Dropdown, Granularity, Itinerary & Grid Toggle (Centered Island) */}
      <RegionSelectorBar
        containerRef={headerRef}
        title={MAP_TITLE}
        subtitle={MAP_SUBTITLE}
        regions={effectiveRegions}
        activeRegionId={activeRegionId}
        granularity={granularity}
        isLoadingAdmin1={isLoadingAdmin1}
        showGraticule={showGraticule}
        isItineraryOpen={isItineraryModalOpen}
        onSelectRegion={handleSelectRegion}
        onChangeGranularity={setGranularity}
        onToggleGraticule={() => setShowGraticule((v) => !v)}
        onOpenItinerary={() => setIsItineraryModalOpen((v) => !v)}
      />

      {/* Main Declarative SVG Map Canvas */}
      <main className="relative flex-1 w-full h-full">
        <TravelMapCanvas
          svgRef={svgRef}
          cameraGroupRef={cameraGroupRef}
          projection={projection}
          transform={transform}
          zoomK={zoomK}
          invScale={invScale}
          labelScaleBoost={labelScaleBoost}
          mapConfig={MAP_RENDER_CONFIG}
          cities={resolvedCities}
          cityStats={cityStats}
          cityPhotos={CITY_PHOTOS}
          itinerary={ITINERARY_LEGS}
          transitModes={TRANSIT_MODES}
          visibleModes={visibleModes}
          countriesGeoJson={countriesGeoJson}
          admin1GeoJson={admin1GeoJson}
          isLoadingAdmin1={isLoadingAdmin1}
          granularity={granularity}
          showGraticule={showGraticule}
          selectedCityId={selectedCityId}
          selectedLegId={effectiveSelectedLegId}
          isTimelineEnabled={isTimelineEnabled}
          currentTimelineLegIndex={currentTimelineIndex}
          onSelectCity={handleSelectCity}
          onSelectLeg={handleSelectLeg}
          onClearSelection={handleClearSelection}
          onHoverCity={preloadCity}
        />

        {/* Floating Photo Postcard HUD (Desktop >= 640px during playback; mobile uses docked strip in JourneyPlayback) */}
        {shouldMountPostcard && postcardCityId && (
          <CityPhotoPostcard
            containerRef={postcardRef}
            city={resolvedCities[postcardCityId]}
            photos={postcardPhotos}
            activePhotoIndex={activePhotoIndex}
            onChangePhotoIndex={setActivePhotoIndex}
            subtitle={postcardSubtitle}
            isTimelineEnabled={isTimelineEnabled}
            isPlayingTimeline={isPlayingTimeline}
            isPausedByHover={isPostcardHovered}
            onHoverChange={setIsPostcardHovered}
            onDismiss={!isTimelineEnabled ? () => setSelectedCityId(null) : undefined}
          />
        )}

        {/* Read-Only Centered Itinerary Modal (Calendar & Monthly List) */}
        <ItineraryModal
          isOpen={isItineraryModalOpen}
          itinerary={ITINERARY_LEGS}
          cities={resolvedCities}
          onClose={() => setIsItineraryModalOpen(false)}
        />

        {/* Loading / Geocoding Status Banners */}
        {(isLoadingCountries || isGeocoding) && (
          <div className="pointer-events-none absolute top-28 right-4 z-20 flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/95 px-4 py-2.5 text-xs font-medium text-slate-200 shadow-xl backdrop-blur-md">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            <span>
              {isLoadingCountries
                ? 'Decoding World Vector Topology…'
                : 'Auto-geocoding new itinerary cities…'}
            </span>
          </div>
        )}

        {((unresolvedCities.length > 0 && !isGeocoding) || topologyError) && (
          <div className="pointer-events-auto absolute top-28 left-4 z-20 flex flex-col gap-2">
            {unresolvedCities.length > 0 && !isGeocoding && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/90 px-3.5 py-2 text-xs text-amber-200 shadow-lg">
                Could not auto-geocode: {unresolvedCities.join(', ')}
              </div>
            )}
            {topologyError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/90 px-3.5 py-2 text-xs text-rose-200 shadow-lg">
                {topologyError}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom HUD: Transit Legend + Opt-In Journey Playback */}
      <footer
        ref={footerRef}
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-2 p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
          {!isTimelineEnabled && (
            <TransitLegendBar
              transitModes={TRANSIT_MODES}
              visibleModes={visibleModes}
              legsByMode={legsByMode}
              onToggleMode={handleToggleMode}
            />
          )}

          <JourneyPlayback
            isEnabled={isTimelineEnabled}
            isPlaying={isPlayingTimeline}
            currentIndex={currentTimelineIndex}
            itinerary={ITINERARY_LEGS}
            cities={resolvedCities}
            transitModes={TRANSIT_MODES}
            visibleModes={visibleModes}
            legsByMode={legsByMode}
            onToggleMode={handleToggleMode}
            playbackSpeedMs={playbackSpeedMs}
            destPhotos={postcardPhotos}
            activePhotoIndex={activePhotoIndex}
            onChangePhotoIndex={setActivePhotoIndex}
            onLayoutHeightChange={handlePlaybackLayoutHeightChange}
            onToggleEnabled={handleToggleTimelineEnabled}
            onTogglePlay={() => {
              if (!isPlayingTimeline && currentTimelineIndex >= ITINERARY_LEGS.length - 1) {
                setCurrentTimelineIndex(0);
              }
              setIsPlayingTimeline((p) => !p);
            }}
            onPrev={() => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex((i) => Math.max(0, i - 1));
            }}
            onNext={() => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex((i) => Math.min(ITINERARY_LEGS.length - 1, i + 1));
            }}
            onScrub={(idx) => {
              setIsPlayingTimeline(false);
              setCurrentTimelineIndex(idx);
            }}
            onChangeSpeed={setPlaybackSpeedMs}
          />
        </div>
      </footer>
    </div>
  );
};

export default App;

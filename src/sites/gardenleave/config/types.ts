export type TransitMode = 'Flight' | 'Train' | 'Drive' | 'Bike';

export type LegStatus = 'done' | 'booked' | 'tbd';

export type MapGranularity = 'subregion' | 'country' | 'none';

export interface TransitModeStyleConfig {
  mode: TransitMode;
  label: string;
  color: string;
  baseStrokeWidth: number;
  description: string;
}

export interface CityConfig {
  id: string;
  name: string;
  country: string;
  fullName: string;
  /** [longitude, latitude] in decimal degrees */
  coordinates: [number, number];
}

export interface CityPhotoConfig {
  /** Stable identifier for the photo (e.g. 'Kyoto-01_fushimi-inari') */
  id: string;
  /** Public URL path to the optimized WebP image */
  src: string;
  /** Optional human-readable caption */
  caption?: string;
  /** Optional display or ISO date string (e.g. '2026-12-04') */
  date?: string;
  /** Intrinsic image width in pixels (prevents layout shift) */
  width?: number;
  /** Intrinsic image height in pixels (prevents layout shift) */
  height?: number;
}

export interface ItineraryOriginStopInput {
  city: string;
  startDate?: string;
  endDate?: string;
  transport?: TransitMode;
  booked?: boolean;
}

export interface ItineraryTransitStopInput {
  startDate: string;
  endDate: string;
  city: string;
  transport: TransitMode;
  /** Whether this upcoming leg/stop is confirmed & booked (defaults to false -> TBD) */
  booked?: boolean;
}

export type ItineraryStopInput = ItineraryOriginStopInput | ItineraryTransitStopInput;

export interface ItineraryLegConfig {
  /** Monotonically increasing 1-based leg number (1..N) */
  id: number;
  startDate: string;
  endDate: string;
  /** Automatically computed from (endDate - startDate) in days; 0 indicates an intraday stop */
  nights: number;
  /** Derived from stops[i - 1].city */
  source: string;
  /** Derived from stops[i].city */
  dest: string;
  transport: TransitMode;
  /** Whether this leg/stop is booked (defaults to false; past/current legs auto-resolve to 'done') */
  booked: boolean;
}

export interface RegionCameraConfig {
  id: string;
  label: string;
  shortLabel?: string;
  /** [longitude, latitude] center coordinate */
  center: [number, number];
  zoom: number;
  /** Optional list of city IDs to dynamically fit in the unobstructed viewport */
  fitCities?: string[];
  description?: string;
}

export interface MapRenderConfig {
  /** Logical SVG coordinate space width */
  width: number;
  /** Logical SVG coordinate space height */
  height: number;
  /** d3.geoNaturalEarth1().scale(projectionScale) */
  projectionScale: number;
  /** d3.geoNaturalEarth1().translate([width / 2, height / translateYDivisor]) */
  translateYDivisor: number;
  /** d3.geoNaturalEarth1().rotate(rotation) */
  rotation: [number, number];
  /** d3.zoom().scaleExtent(scaleExtent) */
  scaleExtent: [number, number];
  /** Exponent for zoom-invariant scaling: 1 / Math.pow(zoomK, zoomInvariantExponent) */
  zoomInvariantExponent: number;
  /** Perpendicular parallel offset (in base px) for bidirectional straight line pairs */
  bidirectionalParallelOffset: number;
  /** Fraction of map width above which a transit line splits across the Pacific seam */
  antimeridianThresholdRatio: number;
  /** TopoJSON URL for countries / landmass (self-hosted 50m world + 10m Japan for Shimanami Kaido) */
  countriesTopoJsonUrl: string;
  /** TopoJSON or GeoJSON URL for Admin-1 state/province boundary polygons (US, Canada, China) */
  admin1GeoJsonUrl: string;
}

export interface TravelMapConfig {
  title: string;
  subtitle: string;
  regions: Record<string, RegionCameraConfig>;
  itinerary: ItineraryLegConfig[];
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  mapConfig: MapRenderConfig;
  /** Optional per-city photo gallery map (keyed by cityId) */
  cityPhotos?: Record<string, CityPhotoConfig[]>;
}

export interface CityComputedStats {
  city: CityConfig;
  totalNights: number;
  arrivals: ItineraryLegConfig[];
  departures: ItineraryLegConfig[];
}

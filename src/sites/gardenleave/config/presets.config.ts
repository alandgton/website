import { ITINERARY } from './itinerary.config';
import { MAP_CONFIG } from './map.config';
import { CITY_PHOTOS_CONFIG } from './photos.config';
import { REGIONS_CONFIG } from './regions.config';
import { TRANSIT_MODES_CONFIG } from './transit.config';
import { TravelMapConfig } from './types';

export const DEFAULT_TRAVEL_MAP_CONFIG: TravelMapConfig = {
  title: 'Alan Ton @ Garden Leave',
  subtitle: 'August 2026 – April 2027',
  regions: REGIONS_CONFIG,
  itinerary: ITINERARY,
  transitModes: TRANSIT_MODES_CONFIG,
  mapConfig: MAP_CONFIG,
  cityPhotos: CITY_PHOTOS_CONFIG,
};

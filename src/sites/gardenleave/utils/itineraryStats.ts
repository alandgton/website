import {
  CityComputedStats,
  CityConfig,
  ItineraryLegConfig,
  TransitMode,
} from '../config/types';

/**
 * Computes arrival, departure, and stay statistics for every city in the configuration.
 */
export function computeAllCityStats(
  cities: Record<string, CityConfig>,
  itinerary: ItineraryLegConfig[]
): Record<string, CityComputedStats> {
  const statsMap: Record<string, CityComputedStats> = {};

  for (const [cityId, city] of Object.entries(cities)) {
    const arrivals = itinerary.filter((leg) => leg.dest === cityId);
    const departures = itinerary.filter((leg) => leg.source === cityId);
    const totalNights = arrivals.reduce((sum, leg) => sum + (leg.nights || 0), 0);

    statsMap[cityId] = {
      city,
      totalNights,
      arrivals,
      departures,
    };
  }

  return statsMap;
}

/**
 * Counts the number of transit legs per mode across the itinerary.
 */
export function computeLegsByMode(
  itinerary: ItineraryLegConfig[]
): Record<TransitMode, number> {
  const legsByMode: Record<TransitMode, number> = {
    Flight: 0,
    Train: 0,
    Drive: 0,
    Bike: 0,
  };

  for (const leg of itinerary) {
    legsByMode[leg.transport] = (legsByMode[leg.transport] || 0) + 1;
  }

  return legsByMode;
}

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
    statsMap[cityId] = {
      city,
      totalNights: 0,
      arrivals: [],
      departures: [],
    };
  }

  for (const leg of itinerary) {
    const destStats = statsMap[leg.dest];
    if (destStats) {
      destStats.arrivals.push(leg);
      destStats.totalNights += leg.nights || 0;
    }
    const sourceStats = statsMap[leg.source];
    if (sourceStats) {
      sourceStats.departures.push(leg);
    }
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

/**
 * Formats a night count with proper singular/plural wording and customizable intraday label.
 */
export function formatNights(
  nights: number,
  intradayLabel: string = '0 nights (intraday)'
): string {
  if (nights === 0) return intradayLabel;
  return `${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

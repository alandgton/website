interface CityPinRadiusFlags {
  isSelected: boolean;
  isTimelineActiveDest: boolean;
  isTimelineActiveSource: boolean;
  isConnectedToSelectedCity: boolean;
}

/**
 * Computes the rendered SVG radius of a city pin so `CitiesLayer` and
 * collision-free label placement (`TravelMapCanvas`) stay strictly in sync.
 */
export function getCityPinRadius(
  baseRadiusUnscaled: number,
  invScale: number,
  {
    isSelected,
    isTimelineActiveDest,
    isTimelineActiveSource,
    isConnectedToSelectedCity,
  }: CityPinRadiusFlags
): number {
  const baseRadius = baseRadiusUnscaled * invScale;
  if (isSelected || isTimelineActiveDest) return baseRadius * 1.35;
  if (isTimelineActiveSource || isConnectedToSelectedCity) return baseRadius * 1.15;
  return baseRadius;
}

interface CityNodeOpacityFlags {
  isTimelineEnabled: boolean;
  isVisitedInTimeline: boolean;
  selectedCityId: string | null;
  isSelected: boolean;
  isConnectedToSelectedCity: boolean;
  isTimelineActiveDest: boolean;
}

/**
 * Computes consistent opacity dimming across city pins and city labels.
 */
export function getCityNodeOpacity({
  isTimelineEnabled,
  isVisitedInTimeline,
  selectedCityId,
  isSelected,
  isConnectedToSelectedCity,
  isTimelineActiveDest,
}: CityNodeOpacityFlags): number {
  if (isTimelineEnabled && !isVisitedInTimeline) return 0.22;
  if (selectedCityId && !isSelected && !isConnectedToSelectedCity && !isTimelineActiveDest) {
    return 0.45;
  }
  return 1;
}

/**
 * Returns true if the feature ID set contains Japan (ISO numeric 392 or name match),
 * used to keep the Seto Inland Sea overlay synchronized with Japan's visited/active state.
 */
export function hasJapanFeature(featureIds: Set<string>): boolean {
  if (featureIds.has('392')) return true;
  for (const id of featureIds) {
    if (id.toLowerCase().includes('japan')) return true;
  }
  return false;
}

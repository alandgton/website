import { GENERATED_CITY_PHOTOS } from './photos.manifest';
import { CityPhotoConfig } from './types';

/**
 * Optional manual overrides or external photo URLs per city.
 * Most photos should be added by dropping raw files into `photos/raw/<CityId>/`
 * and running `npm run photos:sync`, which populates `GENERATED_CITY_PHOTOS`.
 */
export const MANUAL_CITY_PHOTOS: Record<string, CityPhotoConfig[]> = {};

const CITY_ALIAS_MAP: Record<string, string> = {
  'new york': 'NYC',
  'new york city': 'NYC',
  nyc: 'NYC',
  'san francisco': 'SF',
  sf: 'SF',
  'los angeles': 'LA',
  la: 'LA',
  'hong kong': 'HK',
  hk: 'HK',
};

function normalizeCityKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  const lower = trimmed.toLowerCase().replace(/[_-]+/g, ' ');
  return CITY_ALIAS_MAP[lower] ?? trimmed;
}

/**
 * Merges auto-generated manifest photos with any manual entries, normalizing city keys.
 */
function buildMergedCityPhotos(): Record<string, CityPhotoConfig[]> {
  const merged: Record<string, CityPhotoConfig[]> = {};

  for (const sourceMap of [GENERATED_CITY_PHOTOS, MANUAL_CITY_PHOTOS]) {
    for (const [rawCityKey, list] of Object.entries(sourceMap)) {
      if (!list || list.length === 0) continue;
      const key = normalizeCityKey(rawCityKey);
      const existing = merged[key] ?? [];
      const seenIds = new Set(existing.map((p) => p.id));
      for (const item of list) {
        if (!seenIds.has(item.id)) {
          existing.push(item);
          seenIds.add(item.id);
        }
      }
      merged[key] = existing;
    }
  }

  return merged;
}

export const CITY_PHOTOS_CONFIG: Record<string, CityPhotoConfig[]> = buildMergedCityPhotos();

/**
 * Case-insensitive & alias-aware lookup for a city's photo gallery.
 */
export function getPhotosForCity(
  cityId: string | null | undefined,
  photosMap: Record<string, CityPhotoConfig[]> = CITY_PHOTOS_CONFIG
): CityPhotoConfig[] {
  if (!cityId) return [];
  if (photosMap[cityId]) return photosMap[cityId];

  const normalized = normalizeCityKey(cityId).toLowerCase();
  for (const [key, list] of Object.entries(photosMap)) {
    if (key.toLowerCase() === normalized || normalizeCityKey(key).toLowerCase() === normalized) {
      return list;
    }
  }
  return [];
}

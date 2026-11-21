import { RegionCameraConfig } from './types';

export const REGIONS_CONFIG: Record<string, RegionCameraConfig> = {
  world: {
    id: 'world',
    label: 'World Overview',
    shortLabel: 'World',
    center: [11, 20],
    zoom: 1,
    description: 'Full global garden-leave trajectory across North America, Europe, MENA, and Asia',
  },
  us: {
    id: 'us',
    label: 'North America',
    center: [-98, 38],
    zoom: 3.2,
    description: 'North America flights & drives across the US & Canada (NYC, SF, LA, Vail, Vancouver, Whistler)',
  },
  europe: {
    id: 'europe',
    label: 'Europe',
    center: [13.5, 50.5],
    zoom: 5.5,
    description: 'Scandinavia, Swiss Alps, Central Europe & German rail corridor',
  },
  mena: {
    id: 'mena',
    label: 'Egypt & Gulf',
    center: [42, 27],
    zoom: 4.5,
    description: 'Nile Valley (Cairo & Luxor) and Arabian Gulf (Dubai)',
  },
  china: {
    id: 'china',
    label: 'China',
    center: [111.5, 27.5],
    zoom: 4.8,
    description: 'Sichuan, Chongqing, Hunan, Hainan, Pearl River Delta, Chaoshan & Jiangnan',
  },
  east_asia: {
    id: 'east_asia',
    label: 'Japan & Korea',
    center: [134.5, 36.8],
    zoom: 5.8,
    description: 'South Korea (Seoul, Busan) and Japan (Kyushu, Honshu, Shikoku, Hokkaido)',
  },
  shimanami: {
    id: 'shimanami',
    label: 'Shimanami Kaido',
    center: [133.06, 34.238],
    zoom: 185,
    fitCities: ['Onomichi', 'Setoda', 'Omishima', 'Imabari'],
    description:
      'High-zoom Seto Inland Sea island-hopping bike route (Onomichi → Setoda → Omishima → Imabari)',
  },
};

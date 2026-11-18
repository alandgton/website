import type { CityConfig, ItineraryLegConfig } from '../../config/types';
import type { ComputedTransitLine } from '../../utils/arcMath';

export interface CityViewMeta {
  totalNights: number;
  connectionCount: number;
  isHomeCity: boolean;
  baseRadiusUnscaled: number;
  neighbors: Set<string>;
}

export interface ProjectedCityNode {
  city: CityConfig;
  x: number;
  y: number;
}

export interface ComputedLineEntry {
  leg: ItineraryLegConfig;
  index: number;
  line: ComputedTransitLine;
}

export interface GeographyPathItem {
  id: string;
  normName: string;
  d: string;
}

export interface SetoIslandPathItem {
  id: string;
  name: string;
  d: string;
}

export interface HoverTooltipState {
  type: 'city' | 'leg';
  x: number;
  y: number;
  cityId?: string;
  leg?: ItineraryLegConfig;
}

export interface MapHoverTooltipHandle {
  show: (state: HoverTooltipState) => void;
  hide: () => void;
}

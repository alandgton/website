import { TransitMode, TransitModeStyleConfig } from './types';

export const TRANSIT_MODES_CONFIG: Record<TransitMode, TransitModeStyleConfig> = {
  Flight: {
    mode: 'Flight',
    label: 'Flight',
    color: '#38bdf8', // sky blue
    baseStrokeWidth: 1.85,
    description: 'Commercial aviation (solid sky-blue line)',
  },
  Train: {
    mode: 'Train',
    label: 'Train',
    color: '#10b981', // emerald
    baseStrokeWidth: 2.0,
    description: 'High-speed & regional rail (solid emerald line)',
  },
  Drive: {
    mode: 'Drive',
    label: 'Drive',
    color: '#f59e0b', // amber
    baseStrokeWidth: 1.95,
    description: 'Overland driving transit (solid amber line)',
  },
  Bike: {
    mode: 'Bike',
    label: 'Bike',
    color: '#f43f5e', // rose
    baseStrokeWidth: 2.1,
    description: 'Shimanami Kaido island cycling (solid rose line)',
  },
};

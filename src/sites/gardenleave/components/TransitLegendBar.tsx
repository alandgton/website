import React from 'react';
import { Bike, Car, Plane, TrainTrack, type LucideIcon } from 'lucide-react';
import { TransitMode, TransitModeStyleConfig } from '../config/types';

const TRANSIT_MODE_ICONS: Record<TransitMode, LucideIcon> = {
  Flight: Plane,
  Train: TrainTrack,
  Drive: Car,
  Bike: Bike,
};

export interface TransitModeLegendItemsProps {
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  legsByMode?: Record<TransitMode, number>;
  variant?: 'bar' | 'embedded';
}

export const TransitModeLegendItems: React.FC<TransitModeLegendItemsProps> = ({
  transitModes,
  legsByMode,
  variant = 'bar',
}) => {
  const modes = Object.values(transitModes);
  const isEmbedded = variant === 'embedded';

  return (
    <>
      {modes.map((style) => {
        const count = legsByMode?.[style.mode];
        const ModeIcon = TRANSIT_MODE_ICONS[style.mode];
        const countLabel =
          typeof count === 'number'
            ? ` (${count} ${count === 1 ? 'leg' : 'legs'})`
            : '';

        return (
          <span
            key={style.mode}
            title={`${style.label}${countLabel}: ${style.description}`}
            className={`flex items-center rounded-lg border border-slate-700/90 bg-slate-800/70 text-xs text-slate-100 ${
              isEmbedded ? 'gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1' : 'gap-1.5 px-2.5 py-1'
            }`}
          >
            <span className="sr-only">{style.label}</span>
            {/* Solid directional transit line preview */}
            <svg width="26" height="10" viewBox="0 0 26 10" className="shrink-0">
              <line
                x1="1"
                y1="5"
                x2="21"
                y2="5"
                stroke={style.color}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <polygon points="25,5 19,2 20.5,5 19,8" fill={style.color} />
            </svg>
            <ModeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!isEmbedded && typeof count === 'number' && (
              <span className="hidden xl:inline rounded bg-slate-950/70 px-1.5 py-px font-mono text-[10px] text-slate-400">
                {count}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
};

interface TransitLegendBarProps {
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  legsByMode: Record<TransitMode, number>;
}

export const TransitLegendBar: React.FC<TransitLegendBarProps> = ({
  transitModes,
  legsByMode,
}) => {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3 py-1.5 shadow-lg backdrop-blur-md">
      <span className="text-[11px] font-medium text-slate-400 mr-1 hidden xl:inline">
        Transit Modes:
      </span>
      <TransitModeLegendItems
        transitModes={transitModes}
        legsByMode={legsByMode}
      />
    </div>
  );
};

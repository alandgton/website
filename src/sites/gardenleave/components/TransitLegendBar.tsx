import React from 'react';
import { Bike, Car, Plane, TrainTrack, type LucideIcon } from 'lucide-react';
import { TransitMode, TransitModeStyleConfig } from '../config/types';

const TRANSIT_MODE_ICONS: Record<TransitMode, LucideIcon> = {
  Flight: Plane,
  Train: TrainTrack,
  Drive: Car,
  Bike: Bike,
};

export interface TransitModeButtonsProps {
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  visibleModes: Record<TransitMode, boolean>;
  legsByMode?: Record<TransitMode, number>;
  onToggleMode: (mode: TransitMode) => void;
  variant?: 'bar' | 'embedded';
}

export const TransitModeButtons: React.FC<TransitModeButtonsProps> = ({
  transitModes,
  visibleModes,
  legsByMode,
  onToggleMode,
  variant = 'bar',
}) => {
  const modes = Object.values(transitModes);
  const isEmbedded = variant === 'embedded';

  return (
    <>
      {modes.map((style) => {
        const isVisible = visibleModes[style.mode];
        const count = legsByMode?.[style.mode];
        const ModeIcon = TRANSIT_MODE_ICONS[style.mode];
        const countLabel =
          typeof count === 'number'
            ? ` (${count} ${count === 1 ? 'leg' : 'legs'})`
            : '';

        return (
          <button
            key={style.mode}
            type="button"
            onClick={() => onToggleMode(style.mode)}
            aria-label={`Toggle ${style.label} visibility`}
            aria-pressed={isVisible}
            title={`${style.label}${countLabel}: ${style.description} — Click to toggle visibility`}
            className={`flex items-center rounded-lg border text-xs transition ${
              isEmbedded
                ? 'gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1'
                : 'gap-1.5 px-2.5 py-1'
            } ${
              isVisible
                ? 'border-slate-700/90 bg-slate-800/70 text-slate-100 hover:bg-slate-800'
                : 'border-slate-800/50 bg-slate-900/40 text-slate-500 opacity-55 hover:opacity-80'
            }`}
          >
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
          </button>
        );
      })}
    </>
  );
};

interface TransitLegendBarProps {
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  visibleModes: Record<TransitMode, boolean>;
  legsByMode: Record<TransitMode, number>;
  onToggleMode: (mode: TransitMode) => void;
}

export const TransitLegendBar: React.FC<TransitLegendBarProps> = ({
  transitModes,
  visibleModes,
  legsByMode,
  onToggleMode,
}) => {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3 py-1.5 shadow-lg backdrop-blur-md">
      <span className="text-[11px] font-medium text-slate-400 mr-1 hidden xl:inline">
        Transit Modes:
      </span>
      <TransitModeButtons
        transitModes={transitModes}
        visibleModes={visibleModes}
        legsByMode={legsByMode}
        onToggleMode={onToggleMode}
      />
    </div>
  );
};

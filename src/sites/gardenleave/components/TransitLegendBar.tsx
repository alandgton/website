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

export const StatusLegendItems: React.FC = () => {
  return (
    <div
      data-testid="status-legend"
      aria-label="Leg and city status key"
      className="flex items-center justify-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs text-slate-200 select-none cursor-default"
    >
      <span
        className="inline-flex items-center gap-1"
        title="Done: already traveled"
      >
        <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0" aria-hidden="true">
          <line x1="1" y1="6" x2="14" y2="6" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="17" cy="6" r="3.4" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.9" />
        </svg>
        <span>Done</span>
      </span>

      <span className="text-slate-700" aria-hidden="true">·</span>

      <span
        className="inline-flex items-center gap-1"
        title="Booked: upcoming and confirmed"
      >
        <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0" aria-hidden="true">
          <line
            x1="1"
            y1="6"
            x2="14"
            y2="6"
            stroke="#38bdf8"
            strokeWidth="1.8"
            strokeOpacity="0.72"
            strokeLinecap="round"
          />
          <circle cx="17" cy="6" r="3.2" fill="#060913" stroke="#f8fafc" strokeWidth="1.5" />
        </svg>
        <span>Booked</span>
      </span>

      <span className="text-slate-700" aria-hidden="true">·</span>

      <span
        className="inline-flex items-center gap-1 text-slate-300"
        title="TBD: planned, not yet booked"
      >
        <svg width="22" height="12" viewBox="0 0 22 12" className="shrink-0" aria-hidden="true">
          <line
            x1="1"
            y1="6"
            x2="14"
            y2="6"
            stroke="#86a6c7"
            strokeWidth="1.6"
            strokeDasharray="3.2 3.2"
            strokeOpacity="0.68"
            strokeLinecap="round"
          />
          <circle
            cx="17"
            cy="6"
            r="3"
            fill="#060913"
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeDasharray="1.8 1.5"
          />
        </svg>
        <span>TBD</span>
      </span>
    </div>
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
    <div className="pointer-events-auto flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-800/90 bg-slate-900/85 px-2.5 sm:px-3 py-1.5 shadow-lg backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="text-[11px] font-medium text-slate-400 mr-1 hidden xl:inline">
          Transit Modes:
        </span>
        <TransitModeLegendItems
          transitModes={transitModes}
          legsByMode={legsByMode}
        />
      </div>

      {/* Hairline divider: horizontal on mobile stacked card, vertical on sm+ desktop */}
      <div className="sm:hidden h-px w-full bg-slate-800/80" aria-hidden="true" />
      <div className="hidden sm:block h-4 w-px bg-slate-700/80 shrink-0" aria-hidden="true" />

      {/* Static Read-Only Status Key (Done · Booked · TBD) */}
      <StatusLegendItems />
    </div>
  );
};

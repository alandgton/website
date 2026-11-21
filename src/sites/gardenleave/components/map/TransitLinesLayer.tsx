import React from 'react';
import type {
  ItineraryLegConfig,
  LegStatus,
  TransitMode,
  TransitModeStyleConfig,
} from '../../config/types';
import type { ComputedLineEntry } from './types';

const TBD_MODE_COLORS: Record<TransitMode, string> = {
  Flight: '#86a6c7',
  Train: '#59a68b',
  Drive: '#c49d56',
  Bike: '#c06d80',
};

interface TransitLinesLayerProps {
  computedLines: ComputedLineEntry[];
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  legStatuses: Record<number, LegStatus>;
  isTimelineEnabled: boolean;
  currentTimelineLegIndex: number;
  selectedLegId: number | null;
  selectedCityId: string | null;
  invScale: number;
  onSelectLeg: (leg: ItineraryLegConfig) => void;
  onEnterLeg: (leg: ItineraryLegConfig, clientX: number, clientY: number) => void;
  onMoveLeg: (leg: ItineraryLegConfig, clientX: number, clientY: number) => void;
  onLeaveLeg: (legId: number) => void;
}

export const TransitLinesLayer: React.FC<TransitLinesLayerProps> = React.memo(({
  computedLines,
  transitModes,
  legStatuses,
  isTimelineEnabled,
  currentTimelineLegIndex,
  selectedLegId,
  selectedCityId,
  invScale,
  onSelectLeg,
  onEnterLeg,
  onMoveLeg,
  onLeaveLeg,
}) => {
  const hasSelectionFocus = selectedLegId !== null || selectedCityId !== null;

  return (
    <g className="transit-lines-layer">
      {computedLines.map(({ leg, index, line }) => {
        const isCurrentTimeline = isTimelineEnabled && index === currentTimelineLegIndex;
        const isFutureTimeline = isTimelineEnabled && index > currentTimelineLegIndex;

        if (isFutureTimeline) {
          return null;
        }

        const modeStyle = transitModes[leg.transport];
        const status: LegStatus = legStatuses[leg.id] ?? 'tbd';
        const isSelectedLeg = selectedLegId === leg.id || isCurrentTimeline;
        const isConnectedToSelectedCity =
          selectedCityId !== null &&
          (leg.source === selectedCityId || leg.dest === selectedCityId);

        const strokeColor =
          status === 'tbd' && !isSelectedLeg
            ? TBD_MODE_COLORS[leg.transport]
            : modeStyle.color;

        const baseStatusOpacity =
          status === 'done' ? 0.94 : status === 'booked' ? 0.72 : 0.56;
        const statusWidthFactor =
          status === 'done' ? 1.05 : status === 'booked' ? 0.88 : 0.84;

        // Compute opacity based on status + selection / timeline state
        let strokeOpacity = baseStatusOpacity;
        if (isTimelineEnabled) {
          strokeOpacity = isCurrentTimeline ? 1 : Math.min(baseStatusOpacity, 0.68);
        } else if (selectedLegId !== null) {
          strokeOpacity = isSelectedLeg ? 1 : 0.22;
        } else if (selectedCityId !== null) {
          strokeOpacity = isConnectedToSelectedCity
            ? Math.min(1, baseStatusOpacity + 0.14)
            : 0.22;
        }

        const focusMultiplier = isSelectedLeg
          ? 1.5
          : isConnectedToSelectedCity
            ? 1.22
            : 1.0;

        const strokeWidth =
          modeStyle.baseStrokeWidth * statusWidthFactor * focusMultiplier * invScale;
        const strokeDasharray =
          status === 'tbd' ? `${4.4 * invScale} ${4.2 * invScale}` : undefined;

        const showFocusGlow = isSelectedLeg || isConnectedToSelectedCity;
        const showDoneAmbientGlow =
          status === 'done' && !isTimelineEnabled && !hasSelectionFocus;

        return (
          <g
            key={leg.id}
            data-leg-status={status}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectLeg(leg);
            }}
            onMouseEnter={(e) => onEnterLeg(leg, e.clientX, e.clientY)}
            onMouseMove={(e) => onMoveLeg(leg, e.clientX, e.clientY)}
            onMouseLeave={() => onLeaveLeg(leg.id)}
          >
            {/* Invisible wider hit-target path for easy clicking */}
            <path
              d={line.pathData}
              fill="none"
              stroke="transparent"
              strokeWidth={10 * invScale}
            />

            {/* Subtle outer glow for focused legs or idle Done legs */}
            {(showFocusGlow || showDoneAmbientGlow) && (
              <path
                d={line.pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth * (showFocusGlow ? 2.4 : 2.15)}
                strokeOpacity={showFocusGlow ? 0.22 : 0.13}
                strokeLinecap="round"
              />
            )}

            {/* Primary Directional Straight Line Path */}
            <path
              d={line.pathData}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
            />
          </g>
        );
      })}
    </g>
  );
});

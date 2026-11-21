import React from 'react';
import type {
  ItineraryLegConfig,
  TransitMode,
  TransitModeStyleConfig,
} from '../../config/types';
import type { ComputedLineEntry } from './types';

interface TransitLinesLayerProps {
  computedLines: ComputedLineEntry[];
  visibleModes: Record<TransitMode, boolean>;
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
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
  visibleModes,
  transitModes,
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
  return (
    <g className="transit-lines-layer">
      {computedLines.map(({ leg, index, line }) => {
        if (!visibleModes[leg.transport]) return null;

        const isCurrentTimeline = isTimelineEnabled && index === currentTimelineLegIndex;
        const isFutureTimeline = isTimelineEnabled && index > currentTimelineLegIndex;

        if (isFutureTimeline) {
          return null;
        }

        const modeStyle = transitModes[leg.transport];
        const isSelectedLeg = selectedLegId === leg.id || isCurrentTimeline;
        const isConnectedToSelectedCity =
          selectedCityId !== null &&
          (leg.source === selectedCityId || leg.dest === selectedCityId);

        // Compute opacity based on selection / timeline state
        let strokeOpacity = 0.84;
        if (isTimelineEnabled) {
          strokeOpacity = isCurrentTimeline ? 1 : 0.72;
        } else if (selectedLegId !== null) {
          strokeOpacity = isSelectedLeg ? 1 : 0.25;
        } else if (selectedCityId !== null) {
          strokeOpacity = isConnectedToSelectedCity ? 0.96 : 0.22;
        }

        const strokeMultiplier = isSelectedLeg
          ? 1.55
          : isConnectedToSelectedCity
            ? 1.25
            : 1.0;

        const strokeWidth = modeStyle.baseStrokeWidth * strokeMultiplier * invScale;

        return (
          <g
            key={leg.id}
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

            {/* Subtle outer glow for active or selected leg */}
            {(isSelectedLeg || isConnectedToSelectedCity) && (
              <path
                d={line.pathData}
                fill="none"
                stroke={modeStyle.color}
                strokeWidth={strokeWidth * 2.4}
                strokeOpacity={0.22}
                strokeLinecap="round"
              />
            )}

            {/* Primary Directional Straight Line Path */}
            <path
              d={line.pathData}
              fill="none"
              stroke={modeStyle.color}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
});

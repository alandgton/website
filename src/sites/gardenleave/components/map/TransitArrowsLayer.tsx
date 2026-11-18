import React from 'react';
import type { TransitMode, TransitModeStyleConfig } from '../../config/types';
import { buildArrowheadPath } from '../../utils/arcMath';
import type { ComputedLineEntry } from './types';

interface TransitArrowsLayerProps {
  computedLines: ComputedLineEntry[];
  visibleModes: Record<TransitMode, boolean>;
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  isTimelineEnabled: boolean;
  selectedLegId: number | null;
  selectedCityId: string | null;
  hoveredLegId: number | null;
  invScale: number;
}

export const TransitArrowsLayer: React.FC<TransitArrowsLayerProps> = React.memo(({
  computedLines,
  visibleModes,
  transitModes,
  isTimelineEnabled,
  selectedLegId,
  selectedCityId,
  hoveredLegId,
  invScale,
}) => {
  if (isTimelineEnabled) return null;

  return (
    <g className="transit-arrows-layer pointer-events-none">
      {computedLines.map(({ leg, line }) => {
        if (!visibleModes[leg.transport]) return null;

        const modeStyle = transitModes[leg.transport];
        const isSelectedLeg = selectedLegId === leg.id;
        const isConnectedToSelectedCity =
          selectedCityId !== null &&
          (leg.source === selectedCityId || leg.dest === selectedCityId);
        const isHoveredLeg = hoveredLegId === leg.id;

        // Arrows are hidden by default to reduce visual clutter; only show them on
        // legs the user is focusing on (selected, hovered, or connected to selected city)
        if (!isSelectedLeg && !isHoveredLeg && !isConnectedToSelectedCity) {
          return null;
        }

        let strokeOpacity = 0.88;
        if (selectedLegId !== null) {
          strokeOpacity = isSelectedLeg ? 1 : 0.28;
        } else if (selectedCityId !== null) {
          strokeOpacity = isConnectedToSelectedCity ? 0.98 : 0.25;
        }

        if (isHoveredLeg) strokeOpacity = Math.max(strokeOpacity, 0.95);

        const arrowSizeMultiplier = isSelectedLeg
          ? 1.3
          : isConnectedToSelectedCity || isHoveredLeg
            ? 1.12
            : 0.92;

        return (
          <g key={`arrow-${leg.id}`}>
            {line.segments.map((seg, segIdx) => {
              // Never shrink arrowheads below 72% of invScale so short-hop arrows remain clearly visible
              const arrowScale = Math.max(
                invScale * 0.72,
                Math.min(invScale, seg.length / (7.5 * arrowSizeMultiplier))
              );
              const segArrowPath = buildArrowheadPath(arrowScale, arrowSizeMultiplier);
              return (
                <path
                  key={segIdx}
                  d={segArrowPath}
                  fill={modeStyle.color}
                  fillOpacity={Math.min(1, strokeOpacity + 0.12)}
                  stroke="#060913"
                  strokeWidth={0.85 * arrowScale}
                  paintOrder="stroke"
                  transform={`translate(${seg.arrowX}, ${seg.arrowY}) rotate(${seg.arrowAngleDeg})`}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
});

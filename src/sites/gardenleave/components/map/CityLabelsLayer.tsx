import React from 'react';
import type { LabelPlacement } from '../../utils/labelLayout';
import type { CityViewMeta, ProjectedCityNode } from './types';
import { getCityNodeOpacity } from './utils';

interface CityLabelsLayerProps {
  projectedCities: Record<string, ProjectedCityNode>;
  cityViewMeta: Record<string, CityViewMeta>;
  smartLabelPlacements: Record<string, LabelPlacement>;
  selectedCityId: string | null;
  activeTimelineDest: string | undefined;
  visitedCitiesInTimeline: Set<string> | null;
  isTimelineEnabled: boolean;
  labelFontSize: number;
  invScale: number;
  labelScaleBoost: number;
}

export const CityLabelsLayer: React.FC<CityLabelsLayerProps> = React.memo(({
  projectedCities,
  cityViewMeta,
  smartLabelPlacements,
  selectedCityId,
  activeTimelineDest,
  visitedCitiesInTimeline,
  isTimelineEnabled,
  labelFontSize,
  invScale,
  labelScaleBoost,
}) => {
  return (
    <g className="city-labels-layer pointer-events-none">
      {Object.values(projectedCities).map(({ city, x, y }) => {
        const meta = cityViewMeta[city.id];
        const isSelected = selectedCityId === city.id;
        const isHomeCity = meta?.isHomeCity ?? false;
        const isTimelineActiveDest = activeTimelineDest === city.id;
        const isVisitedInTimeline = visitedCitiesInTimeline
          ? visitedCitiesInTimeline.has(city.id)
          : true;
        const isConnectedToSelectedCity = Boolean(
          selectedCityId !== null && meta?.neighbors.has(selectedCityId)
        );

        const labelPlacement = smartLabelPlacements[city.id];
        if (!labelPlacement?.visible) return null;

        const labelOpacity = getCityNodeOpacity({
          isTimelineEnabled,
          isVisitedInTimeline,
          selectedCityId,
          isSelected,
          isConnectedToSelectedCity,
          isTimelineActiveDest,
        });

        return (
          <g
            key={`label-${city.id}`}
            transform={`translate(${x}, ${y})`}
            style={{ opacity: labelOpacity }}
          >
            <text
              x={labelPlacement.dx}
              y={labelPlacement.dy}
              textAnchor={labelPlacement.textAnchor}
              fontSize={labelFontSize * (isHomeCity ? 1.06 : 1)}
              fontWeight={isSelected || isTimelineActiveDest || isHomeCity ? 700 : 500}
              fill={
                isHomeCity
                  ? '#fde68a'
                  : isSelected || isTimelineActiveDest
                    ? '#f8fafc'
                    : '#cbd5e1'
              }
              stroke="#060913"
              strokeWidth={2.4 * invScale * Math.sqrt(labelScaleBoost)}
              paintOrder="stroke"
              className="font-sans tracking-tight"
            >
              {city.name}
            </text>
          </g>
        );
      })}
    </g>
  );
});

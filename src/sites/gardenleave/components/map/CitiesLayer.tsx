import React from 'react';
import type { CityViewMeta, ProjectedCityNode } from './types';
import { getCityNodeOpacity, getCityPinRadius } from './utils';

interface CitiesLayerProps {
  projectedCities: Record<string, ProjectedCityNode>;
  cityViewMeta: Record<string, CityViewMeta>;
  selectedCityId: string | null;
  activeTimelineSource: string | undefined;
  activeTimelineDest: string | undefined;
  visitedCitiesInTimeline: Set<string> | null;
  isTimelineEnabled: boolean;
  invScale: number;
  onSelectCity: (cityId: string) => void;
  onEnterCity: (cityId: string, clientX: number, clientY: number) => void;
  onMoveCity: (cityId: string, clientX: number, clientY: number) => void;
  onLeaveCity: () => void;
}

export const CitiesLayer: React.FC<CitiesLayerProps> = React.memo(({
  projectedCities,
  cityViewMeta,
  selectedCityId,
  activeTimelineSource,
  activeTimelineDest,
  visitedCitiesInTimeline,
  isTimelineEnabled,
  invScale,
  onSelectCity,
  onEnterCity,
  onMoveCity,
  onLeaveCity,
}) => {
  return (
    <g className="cities-layer">
      {Object.values(projectedCities).map(({ city, x, y }) => {
        const meta = cityViewMeta[city.id];
        const isSelected = selectedCityId === city.id;
        const isTimelineActiveDest = activeTimelineDest === city.id;
        const isTimelineActiveSource = activeTimelineSource === city.id;
        const isVisitedInTimeline = visitedCitiesInTimeline
          ? visitedCitiesInTimeline.has(city.id)
          : true;

        const isConnectedToSelectedCity = Boolean(
          selectedCityId !== null && meta?.neighbors.has(selectedCityId)
        );
        const isHomeCity = meta?.isHomeCity ?? false;

        const radius = getCityPinRadius(meta?.baseRadiusUnscaled ?? 2.8, invScale, {
          isSelected,
          isTimelineActiveDest,
          isTimelineActiveSource,
          isConnectedToSelectedCity,
        });

        const pinOpacity = getCityNodeOpacity({
          isTimelineEnabled,
          isVisitedInTimeline,
          selectedCityId,
          isSelected,
          isConnectedToSelectedCity,
          isTimelineActiveDest,
        });

        return (
          <g
            key={city.id}
            transform={`translate(${x}, ${y})`}
            className="cursor-pointer"
            style={{ opacity: pinOpacity }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCity(city.id);
            }}
            onMouseEnter={(e) => onEnterCity(city.id, e.clientX, e.clientY)}
            onMouseMove={(e) => onMoveCity(city.id, e.clientX, e.clientY)}
            onMouseLeave={onLeaveCity}
          >
            {/* Invisible hit circle for easy clicking */}
            <circle r={Math.max(8 * invScale, radius * 2.2)} fill="transparent" />

            {/* Outer dark halo for contrast against transit lines */}
            <circle
              r={radius + 0.75 * invScale}
              fill="#060913"
              fillOpacity={0.88}
            />

            {isHomeCity ? (
              <>
                {/* Home City Pin: amber circle with a house glyph */}
                <circle
                  r={radius}
                  fill="#f59e0b"
                  stroke="#0f172a"
                  strokeWidth={0.75 * invScale}
                />
                {/* House glyph drawn in unit space [-1, 1] and scaled to the pin radius */}
                <path
                  transform={`scale(${radius})`}
                  d="M 0 -0.62 L 0.6 -0.08 L 0.42 -0.08 L 0.42 0.52 L 0.12 0.52 L 0.12 0.18 L -0.12 0.18 L -0.12 0.52 L -0.42 0.52 L -0.42 -0.08 L -0.6 -0.08 Z"
                  fill="#0f172a"
                />
              </>
            ) : (
              /* Main City Pin Circle (uniform color & style for every non-home city) */
              <circle
                r={radius}
                fill="#f8fafc"
                stroke="#0f172a"
                strokeWidth={0.75 * invScale}
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

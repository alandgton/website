import React, { useMemo } from 'react';
import type { GeographyPathItem, SetoIslandPathItem } from './types';

interface GeographyLayerProps {
  spherePath: string;
  countryPaths: GeographyPathItem[];
  admin1Paths: GeographyPathItem[];
  setoIslandPaths: SetoIslandPathItem[];
  graticulePath: string;
  subdividedCountryNames: Set<string>;
  visitedCountryFeatureIds: Set<string>;
  activeCountryFeatureIds: Set<string>;
  visitedAdmin1FeatureIds: Set<string>;
  activeAdmin1FeatureIds: Set<string>;
  isSubregion: boolean;
  isNone: boolean;
  showGraticule: boolean;
  isJapanVisited: boolean;
  isJapanActive: boolean;
}

export const GeographyLayer: React.FC<GeographyLayerProps> = React.memo(({
  spherePath,
  countryPaths,
  admin1Paths,
  setoIslandPaths,
  graticulePath,
  subdividedCountryNames,
  visitedCountryFeatureIds,
  activeCountryFeatureIds,
  visitedAdmin1FeatureIds,
  activeAdmin1FeatureIds,
  isSubregion,
  isNone,
  showGraticule,
  isJapanVisited,
  isJapanActive,
}) => {
  const countriesElement = useMemo(
    () => (
      <g className="countries-layer">
        {countryPaths.map((country, idx) => {
          const isSubdividedInAdmin1 =
            isSubregion &&
            admin1Paths.length > 0 &&
            Boolean(country.normName && subdividedCountryNames.has(country.normName));

          const isVisitedCountry =
            !isNone && !isSubdividedInAdmin1 && visitedCountryFeatureIds.has(country.id);
          const isActiveCountry =
            !isNone && !isSubdividedInAdmin1 && activeCountryFeatureIds.has(country.id);

          return (
            <path
              key={`${country.id}-${idx}`}
              d={country.d}
              fill={
                isActiveCountry
                  ? '#203e66'
                  : isVisitedCountry
                    ? '#183052'
                    : '#111b2e'
              }
              stroke={
                isActiveCountry
                  ? '#38bdf8'
                  : isVisitedCountry
                    ? '#2b5485'
                    : '#26354d'
              }
              strokeWidth={isActiveCountry ? 1.25 : isVisitedCountry ? 0.95 : 0.7}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              data-bg="true"
            />
          );
        })}
      </g>
    ),
    [
      activeCountryFeatureIds,
      admin1Paths.length,
      countryPaths,
      isNone,
      isSubregion,
      subdividedCountryNames,
      visitedCountryFeatureIds,
    ]
  );

  const admin1Element = useMemo(
    () =>
      isSubregion && admin1Paths.length > 0 ? (
        <g className="admin1-layer pointer-events-none">
          {admin1Paths.map((prov, idx) => {
            const isVisitedProv = visitedAdmin1FeatureIds.has(prov.id);
            const isActiveProv = activeAdmin1FeatureIds.has(prov.id);

            return (
              <path
                key={`${prov.id}-${idx}`}
                d={prov.d}
                fill={
                  isActiveProv
                    ? '#203e66'
                    : isVisitedProv
                      ? '#183052'
                      : 'none'
                }
                stroke={
                  isActiveProv
                    ? '#38bdf8'
                    : isVisitedProv
                      ? '#38bdf8'
                      : '#334155'
                }
                strokeOpacity={isActiveProv ? 0.85 : isVisitedProv ? 0.55 : 0.5}
                strokeWidth={isActiveProv ? 1.1 : isVisitedProv ? 0.85 : 0.5}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            );
          })}
        </g>
      ) : null,
    [activeAdmin1FeatureIds, admin1Paths, isSubregion, visitedAdmin1FeatureIds]
  );

  const setoIslandsElement = useMemo(
    () => (
      <g className="seto-islands-layer">
        {setoIslandPaths.map((island) => {
          const isActiveIsland = !isNone && isJapanActive;
          const isVisitedIsland = !isNone && isJapanVisited;

          return (
            <path
              key={island.id}
              d={island.d}
              fill={
                isActiveIsland
                  ? '#203e66'
                  : isVisitedIsland
                    ? '#183052'
                    : '#111b2e'
              }
              stroke={
                isActiveIsland
                  ? '#38bdf8'
                  : isVisitedIsland
                    ? '#2b5485'
                    : '#26354d'
              }
              strokeWidth={isActiveIsland ? 1.25 : isVisitedIsland ? 0.95 : 0.7}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              data-bg="true"
            >
              <title>{island.name}</title>
            </path>
          );
        })}
      </g>
    ),
    [isJapanActive, isJapanVisited, isNone, setoIslandPaths]
  );

  return (
    <>
      {/* Globe Sphere / Ocean Outline */}
      {spherePath && (
        <path
          d={spherePath}
          fill="url(#oceanGradient)"
          stroke="#1e293b"
          strokeWidth={1.1}
          vectorEffect="non-scaling-stroke"
          data-bg="true"
        />
      )}

      {/* Country Polygons (Memoized with non-scaling-stroke so 0 paths re-render during zoom/pan) */}
      {countriesElement}

      {/* Optional Admin-1 State/Province Polygons & Boundary Lines */}
      {admin1Element}

      {/* Seto Inland Sea Islands Layer (Onomichi -> Setoda -> Omishima -> Imabari -> Matsuyama corridor) */}
      {setoIslandsElement}

      {/* Graticule Grid (Rendered above land/admin1 polygons so lat/lon lines remain visible across continents) */}
      {showGraticule && graticulePath && (
        <path
          d={graticulePath}
          fill="none"
          stroke="#38bdf8"
          strokeOpacity={0.28}
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
          className="graticule-layer pointer-events-none"
        />
      )}
    </>
  );
});

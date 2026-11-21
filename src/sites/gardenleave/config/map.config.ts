import { MapRenderConfig } from './types';

export const MAP_CONFIG: MapRenderConfig = {
  width: 1200,
  height: 675,
  projectionScale: 225,
  translateYDivisor: 1.85,
  rotation: [-11, 0],
  scaleExtent: [1, 250],
  zoomInvariantExponent: 0.82,
  bidirectionalParallelOffset: 2.6,
  antimeridianThresholdRatio: 0.5,
  countriesTopoJsonUrl: '/gardenleave/countries-50m-jp10m.topo.json',
  admin1GeoJsonUrl: '/gardenleave/admin1-50m.topo.json',
};

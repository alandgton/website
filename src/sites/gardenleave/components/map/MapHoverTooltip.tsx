import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { getPhotosForCity } from '../../config/photos.config';
import type {
  CityComputedStats,
  CityConfig,
  CityPhotoConfig,
  TransitMode,
  TransitModeStyleConfig,
} from '../../config/types';
import type { HoverTooltipState, MapHoverTooltipHandle } from './types';

interface MapHoverTooltipProps {
  containerRef: React.RefObject<HTMLDivElement>;
  cities: Record<string, CityConfig>;
  cityStats: Record<string, CityComputedStats>;
  cityPhotos?: Record<string, CityPhotoConfig[]>;
  transitModes: Record<TransitMode, TransitModeStyleConfig>;
  homeCityId: string;
}

const EDGE_PADDING = 12;

const MapHoverTooltipInner = forwardRef<MapHoverTooltipHandle, MapHoverTooltipProps>(
  ({ containerRef, cities, cityStats, cityPhotos, transitModes, homeCityId }, ref) => {
    const [hoverInfo, setHoverInfo] = useState<HoverTooltipState | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        show: (nextState: HoverTooltipState) => {
          setHoverInfo(nextState);
        },
        hide: () => {
          setHoverInfo(null);
        },
      }),
      []
    );

    useLayoutEffect(() => {
      const container = containerRef.current;
      const tooltip = tooltipRef.current;
      if (!container || !tooltip || !hoverInfo) return;

      const maxLeft = Math.max(
        EDGE_PADDING,
        container.clientWidth - tooltip.offsetWidth - EDGE_PADDING
      );
      const maxTop = Math.max(
        EDGE_PADDING,
        container.clientHeight - tooltip.offsetHeight - EDGE_PADDING
      );

      const clampedLeft = Math.min(Math.max(hoverInfo.x + 14, EDGE_PADDING), maxLeft);
      const clampedTop = Math.min(Math.max(hoverInfo.y - 12, EDGE_PADDING), maxTop);

      tooltip.style.left = `${clampedLeft}px`;
      tooltip.style.top = `${clampedTop}px`;
    }, [containerRef, hoverInfo]);

    if (!hoverInfo) return null;

    return (
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-30 w-max max-w-[min(20rem,calc(100%-24px))] rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl backdrop-blur-md"
      >
        {hoverInfo.type === 'city' && hoverInfo.cityId && cityStats[hoverInfo.cityId] && (
          <div>
            <div className="font-semibold text-white flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span>{cityStats[hoverInfo.cityId].city.fullName}</span>
                {hoverInfo.cityId === homeCityId && (
                  <span className="rounded bg-amber-500/25 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                    Home Base
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                {getPhotosForCity(hoverInfo.cityId, cityPhotos).length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 border border-sky-400/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                    <Camera className="h-2.5 w-2.5" />
                    <span>{getPhotosForCity(hoverInfo.cityId, cityPhotos).length}</span>
                  </span>
                )}
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                  {cityStats[hoverInfo.cityId].totalNights === 0
                    ? '0 nights (intraday)'
                    : `${cityStats[hoverInfo.cityId].totalNights} nights`}
                </span>
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-3">
              <span>{cityStats[hoverInfo.cityId].arrivals.length} arrival(s)</span>
              <span>·</span>
              <span>{cityStats[hoverInfo.cityId].departures.length} departure(s)</span>
            </div>
          </div>
        )}

        {hoverInfo.type === 'leg' && hoverInfo.leg && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-slate-400">
                Leg #{hoverInfo.leg.id}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${transitModes[hoverInfo.leg.transport].color}22`,
                  color: transitModes[hoverInfo.leg.transport].color,
                }}
              >
                {hoverInfo.leg.transport}
              </span>
            </div>
            <div className="mt-1 font-semibold text-white">
              {cities[hoverInfo.leg.source]?.name ?? hoverInfo.leg.source} →{' '}
              {cities[hoverInfo.leg.dest]?.name ?? hoverInfo.leg.dest}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-300">
              {hoverInfo.leg.startDate} → {hoverInfo.leg.endDate} (
              {hoverInfo.leg.nights === 0
                ? '0 nights · intraday stop'
                : `${hoverInfo.leg.nights} ${hoverInfo.leg.nights === 1 ? 'night' : 'nights'}`}
              )
            </div>
          </div>
        )}
      </div>
    );
  }
);

MapHoverTooltipInner.displayName = 'MapHoverTooltip';

export const MapHoverTooltip = React.memo(MapHoverTooltipInner);

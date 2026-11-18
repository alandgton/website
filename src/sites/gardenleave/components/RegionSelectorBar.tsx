import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Compass,
  Grid,
  Layers,
  Palmtree,
} from 'lucide-react';
import { MapGranularity, RegionCameraConfig } from '../config/types';

interface RegionSelectorBarProps {
  title: string;
  subtitle: string;
  regions: Record<string, RegionCameraConfig>;
  activeRegionId: string | null;
  granularity: MapGranularity;
  isLoadingAdmin1: boolean;
  showGraticule: boolean;
  isItineraryOpen?: boolean;
  onSelectRegion: (region: RegionCameraConfig) => void;
  onChangeGranularity: (granularity: MapGranularity) => void;
  onToggleGraticule: () => void;
  onOpenItinerary: () => void;
  containerRef?: React.RefObject<HTMLElement>;
}

function useDropdownAlign(
  isOpen: boolean,
  menuRef: React.RefObject<HTMLDivElement>,
  menuWidth: number = 160
): 'left' | 'right' {
  const [align, setAlign] = useState<'left' | 'right'>('left');

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const updateAlign = () => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      setAlign(rect.left + menuWidth > window.innerWidth - 12 ? 'right' : 'left');
    };
    updateAlign();
    window.addEventListener('resize', updateAlign);
    return () => window.removeEventListener('resize', updateAlign);
  }, [isOpen, menuRef, menuWidth]);

  return align;
}

export const RegionSelectorBar: React.FC<RegionSelectorBarProps> = ({
  title,
  subtitle,
  regions,
  activeRegionId,
  granularity,
  isLoadingAdmin1,
  showGraticule,
  isItineraryOpen = false,
  onSelectRegion,
  onChangeGranularity,
  onToggleGraticule,
  onOpenItinerary,
  containerRef,
}) => {
  const regionList = Object.values(regions);
  const activeRegion = activeRegionId
    ? regions[activeRegionId]
    : regions['world'] ?? regionList[0];
  const activeRegionLabel = activeRegion?.shortLabel || activeRegion?.label || 'World';

  const [isGranularityOpen, setIsGranularityOpen] = useState<boolean>(false);
  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState<boolean>(false);

  const granularityMenuRef = useRef<HTMLDivElement>(null);
  const regionMenuRef = useRef<HTMLDivElement>(null);

  const regionMenuAlign = useDropdownAlign(isRegionMenuOpen, regionMenuRef);
  const granularityAlign = useDropdownAlign(isGranularityOpen, granularityMenuRef);

  useEffect(() => {
    if (!isGranularityOpen && !isRegionMenuOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        granularityMenuRef.current &&
        !granularityMenuRef.current.contains(target)
      ) {
        setIsGranularityOpen(false);
      }
      if (
        regionMenuRef.current &&
        !regionMenuRef.current.contains(target)
      ) {
        setIsRegionMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGranularityOpen(false);
        setIsRegionMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGranularityOpen, isRegionMenuOpen]);

  return (
    <header
      ref={containerRef}
      className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex justify-center p-3 sm:p-4"
    >
      {/* Centered Floating Island */}
      <div className="relative z-20 pointer-events-auto w-full max-w-[366px] sm:w-auto sm:max-w-none flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl border border-slate-800/90 bg-slate-900/85 px-3.5 py-1.5 shadow-2xl backdrop-blur-md text-xs">
        {/* Navigation & Identity (Mobile Row 1 / Desktop Left) */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 min-w-0">
          {/* Main Return Link */}
          <a
            href="/"
            title="Main"
            className="shrink-0 flex items-center gap-1.5 text-slate-300 hover:text-sky-300 font-semibold transition"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Main</span>
          </a>

          <span className="hidden sm:inline-block h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

          {/* Title Badge */}
          <div
            className="flex min-w-0 items-center gap-1.5 font-bold text-white select-none"
            title={`${title} — ${subtitle}`}
          >
            <Palmtree className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span className="truncate">{title}</span>
          </div>
        </div>

        {/* Vertical divider on desktop, subtle horizontal hairline on mobile */}
        <span className="hidden sm:inline-block h-3.5 w-px bg-slate-800" aria-hidden="true" />
        <div className="sm:hidden w-full h-px bg-slate-800/60" aria-hidden="true" />

        {/* Map Controls & Itinerary (Mobile Row 2 / Desktop Right) */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-1 sm:gap-2 min-w-0">
          {/* Region Dropdown Menu */}
          <div ref={regionMenuRef} className="relative z-50 min-w-0">
            <button
              type="button"
              onClick={() => {
                setIsRegionMenuOpen((v) => !v);
                setIsGranularityOpen(false);
              }}
              title={`Quick-Zoom to Region: ${activeRegionLabel}`}
              className="flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-medium bg-slate-800/60 text-slate-200 hover:bg-slate-800 transition max-w-full"
              aria-expanded={isRegionMenuOpen}
              aria-haspopup="listbox"
            >
              <Compass className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[108px] sm:max-w-none">{activeRegionLabel}</span>
              <ChevronDown
                className={`h-3 w-3 text-slate-400 shrink-0 transition-transform ${
                  isRegionMenuOpen ? 'rotate-180 text-sky-300' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {isRegionMenuOpen && (
              <div
                role="listbox"
                className={`absolute ${
                  regionMenuAlign === 'right' ? 'right-0' : 'left-0'
                } mt-1.5 w-40 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-800 bg-slate-900/95 p-1 shadow-2xl backdrop-blur-md z-50 space-y-0.5 text-xs`}
              >
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Camera Presets
                </div>
                {regionList.map((region) => {
                  const isSelected = activeRegionId === region.id;
                  return (
                    <button
                      key={region.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelectRegion(region);
                        setIsRegionMenuOpen(false);
                      }}
                      title={
                        region.description ||
                        `${region.label} (Center [${region.center[0]}, ${region.center[1]}])`
                      }
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>{region.shortLabel || region.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Granularity Dropdown */}
          <div ref={granularityMenuRef} className="relative z-50 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsGranularityOpen((open) => !open);
                setIsRegionMenuOpen(false);
              }}
              title={`Highlighting Granularity: ${
                granularity === 'subregion'
                  ? 'Subregion'
                  : granularity === 'country'
                    ? 'Country'
                    : 'None'
              } (Click to change)`}
              className={`flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-medium transition ${
                granularity !== 'none'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              aria-expanded={isGranularityOpen}
              aria-haspopup="listbox"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Granularity</span>
              <ChevronDown
                className={`h-3 w-3 text-slate-400 transition-transform ${
                  isGranularityOpen ? 'rotate-180 text-sky-300' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {isGranularityOpen && (
              <div
                role="listbox"
                className={`absolute ${
                  granularityAlign === 'right' ? 'right-0' : 'left-0'
                } mt-1.5 w-40 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-800 bg-slate-900/95 p-1 shadow-2xl backdrop-blur-md z-50 space-y-0.5`}
              >
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Granularity
                </div>
                {(
                  [
                    {
                      id: 'subregion',
                      label: isLoadingAdmin1 ? 'Subregion (Loading…)' : 'Subregion',
                    },
                    { id: 'country', label: 'Country' },
                    { id: 'none', label: 'None' },
                  ] as const
                ).map((opt) => {
                  const isSelected = granularity === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChangeGranularity(opt.id);
                        setIsGranularityOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Itinerary Modal Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsRegionMenuOpen(false);
              setIsGranularityOpen(false);
              onOpenItinerary();
            }}
            title="View Full Itinerary"
            aria-expanded={isItineraryOpen}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-medium transition ${
              isItineraryOpen
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>Itinerary</span>
          </button>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={onToggleGraticule}
            title="Toggle Graticule Grid"
            className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
              showGraticule
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Grid className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Grid</span>
          </button>
        </div>
      </div>
    </header>
  );
};

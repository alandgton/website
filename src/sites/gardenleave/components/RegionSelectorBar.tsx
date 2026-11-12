import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Compass,
  Globe,
  Grid,
  Layers,
  ListFilter,
  RotateCcw,
  Tag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MapGranularity, RegionCameraConfig } from '../config/types';

interface RegionSelectorBarProps {
  title: string;
  subtitle: string;
  regions: Record<string, RegionCameraConfig>;
  activeRegionId: string | null;
  zoomK: number;
  granularity: MapGranularity;
  isLoadingAdmin1: boolean;
  showGraticule: boolean;
  showLabels: boolean;
  onSelectRegion: (region: RegionCameraConfig) => void;
  onChangeGranularity: (granularity: MapGranularity) => void;
  onToggleGraticule: () => void;
  onToggleLabels: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCamera: () => void;
  onOpenDirectoryDrawer: () => void;
}

export const RegionSelectorBar: React.FC<RegionSelectorBarProps> = ({
  title,
  subtitle,
  regions,
  activeRegionId,
  zoomK,
  granularity,
  isLoadingAdmin1,
  showGraticule,
  showLabels,
  onSelectRegion,
  onChangeGranularity,
  onToggleGraticule,
  onToggleLabels,
  onZoomIn,
  onZoomOut,
  onResetCamera,
  onOpenDirectoryDrawer,
}) => {
  const regionList = Object.values(regions);
  const [isGranularityOpen, setIsGranularityOpen] = useState<boolean>(false);
  const granularityMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isGranularityOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (
        granularityMenuRef.current &&
        !granularityMenuRef.current.contains(e.target as Node)
      ) {
        setIsGranularityOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGranularityOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGranularityOpen]);

  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex flex-col gap-2 p-3 sm:p-4">
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2">
        {/* Left Controls: Main + Title Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/"
            title="Main"
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-300 shadow-lg backdrop-blur-md transition-all hover:border-sky-500/60 hover:bg-slate-900 hover:text-sky-300 group"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400 transition-colors group-hover:text-sky-400 shrink-0" aria-hidden="true" />
            <span>Main</span>
          </a>

          {/* Title & Trip Summary Pill */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3.5 py-2 shadow-lg backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white sm:text-base leading-tight">
                {title}
              </h1>
              <p className="text-[11px] text-slate-400 font-mono leading-tight">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Right Controls: Map Layer Toggles, Directory, Config Switcher, Zoom */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/85 p-1.5 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={onToggleLabels}
            title="Toggle City Name Labels"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              showLabels
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Labels</span>
          </button>

          {/* Granularity Dropdown (Option 2: Fixed Button Title "Granularity") */}
          <div ref={granularityMenuRef} className="relative z-50">
            <button
              type="button"
              onClick={() => setIsGranularityOpen((open) => !open)}
              title={`Highlighting Granularity: ${
                granularity === 'subregion'
                  ? 'Subregion'
                  : granularity === 'country'
                    ? 'Country'
                    : 'None'
              } (Click to change)`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
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
                className="absolute right-0 mt-1.5 w-40 rounded-xl border border-slate-800 bg-slate-900/95 p-1 shadow-2xl backdrop-blur-md z-50 space-y-0.5"
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

          <button
            type="button"
            onClick={onToggleGraticule}
            title="Toggle Graticule Grid"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              showGraticule
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Grid</span>
          </button>

          <div className="mx-0.5 h-4 w-px bg-slate-800" />

          <button
            type="button"
            onClick={onOpenDirectoryDrawer}
            title="Browse All Cities & Legs"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <ListFilter className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Itinerary</span>
          </button>

          <div className="mx-0.5 h-4 w-px bg-slate-800" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onZoomOut}
              title="Zoom Out"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[3.2rem] text-center font-mono text-[11px] text-slate-300">
              {zoomK.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={onZoomIn}
              title="Zoom In"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onResetCamera}
              title="Reset Camera to World View"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Config-Driven Regional Quick-Zoom Camera Selector Bar (REGIONS_CONFIG) */}
      <div className="relative z-10 pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-800/90 bg-slate-900/85 px-2.5 py-1.5 shadow-lg backdrop-blur-md no-scrollbar w-fit max-w-full">
        <div className="flex items-center gap-1 pr-1 text-[11px] font-medium text-slate-400 shrink-0">
          <Compass className="h-3.5 w-3.5 text-sky-400" />
          <span className="hidden sm:inline">Regions:</span>
        </div>
        {regionList.map((region) => {
          const isActive = activeRegionId === region.id;
          return (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelectRegion(region)}
              title={
                region.description ||
                `${region.label} (Center [${region.center[0]}, ${region.center[1]}], Zoom ${region.zoom}x)`
              }
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm shadow-sky-500/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{region.shortLabel || region.label}</span>
              <span
                className={`ml-1.5 font-mono text-[10px] ${
                  isActive ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {region.zoom}x
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
};

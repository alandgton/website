import React from 'react';
import { ArrowLeft, Briefcase, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface WorkHeaderProps {
  allExpanded: boolean;
  onToggleExpandAll: () => void;
}

/**
 * Centered floating glassmorphic navigation & control island matching the
 * site-wide header style across alanton.at and /gardenleave/.
 */
export const WorkHeader: React.FC<WorkHeaderProps> = ({
  allExpanded,
  onToggleExpandAll,
}) => {
  return (
    <header className="pointer-events-none sticky top-0 z-20 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="pointer-events-auto w-full max-w-[390px] sm:w-auto sm:max-w-none flex items-center justify-between sm:justify-center gap-1.5 sm:gap-2 rounded-2xl border border-slate-800/90 bg-slate-900/85 px-3 py-1.5 sm:px-3.5 shadow-2xl backdrop-blur-md text-xs">
        <a
          href="/"
          title="Main"
          className="shrink-0 flex items-center gap-1 sm:gap-1.5 text-slate-300 hover:text-sky-300 font-semibold transition-colors group"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-sky-400"
            aria-hidden="true"
          />
          <span>Main</span>
        </a>

        <span className="hidden sm:inline-block h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <h1 className="flex min-w-0 items-center gap-1.5 font-bold tracking-tight text-white whitespace-nowrap">
          <Briefcase className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="truncate">Alan Ton @ Work</span>
        </h1>

        <span className="hidden sm:inline-block h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={onToggleExpandAll}
          aria-pressed={allExpanded}
          className={`shrink-0 inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border px-2 sm:px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
            allExpanded
              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
              : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          {allExpanded ? (
            <>
              <ChevronsDownUp className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              <span>Collapse all</span>
            </>
          ) : (
            <>
              <ChevronsUpDown className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              <span>Expand all</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

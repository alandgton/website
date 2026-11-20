import React from 'react';
import { ArrowLeft, Briefcase } from 'lucide-react';

/**
 * Centered floating glassmorphic navigation island matching the site-wide
 * header style across alanton.at and /gardenleave/.
 */
export const WorkHeader: React.FC = () => {
  return (
    <header className="pointer-events-none sticky top-0 z-20 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="pointer-events-auto w-full max-w-[390px] sm:w-auto sm:max-w-none grid grid-cols-[1fr_auto_1fr] sm:flex items-center justify-center gap-2 sm:gap-3 rounded-2xl border border-slate-800/90 bg-slate-900/85 px-3.5 py-2 shadow-2xl backdrop-blur-md text-xs">
        <a
          href="/"
          title="Main"
          className="justify-self-start shrink-0 flex items-center gap-1.5 text-slate-300 hover:text-sky-300 font-semibold transition-colors group"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-sky-400"
            aria-hidden="true"
          />
          <span>Main</span>
        </a>

        <span className="hidden sm:inline-block h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <h1 className="justify-self-center flex items-center gap-1.5 font-bold tracking-tight text-white whitespace-nowrap">
          <Briefcase className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span>Alan Ton @ Work</span>
        </h1>

        <span className="hidden sm:inline-block h-3.5 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <span className="justify-self-end font-mono text-[11px] tabular-nums text-slate-400 whitespace-nowrap">
          2017–Now
        </span>
      </div>
    </header>
  );
};

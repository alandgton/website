import { ArrowLeft, Construction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  /** Section name shown after "Alan Ton @", e.g. "Home" or "Work". */
  section: string;
  /** Optional monospace subtext shown below the title in the header pill. */
  subtitle?: string;
  /** Icon rendered inside the header pill badge. */
  icon: LucideIcon;
}

/** Temporary "Work in Progress" page for sections that are not built yet. */
export function PlaceholderPage({ section, subtitle, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="relative min-h-screen bg-[#060913] text-slate-100">
      <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex flex-col gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left Controls: Main + Title Pill */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              title="Main"
              className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3 py-2 text-xs font-medium text-slate-300 shadow-lg backdrop-blur-md transition-all hover:border-sky-500/60 hover:bg-slate-900 hover:text-sky-300 group"
            >
              <ArrowLeft
                className="h-4 w-4 text-slate-400 transition-colors group-hover:text-sky-400 shrink-0"
                aria-hidden="true"
              />
              <span>Main</span>
            </a>

            {/* Title & Subtitle Pill */}
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-800/90 bg-slate-900/85 px-3.5 py-2 shadow-lg backdrop-blur-md">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white sm:text-base leading-tight">
                  Alan Ton @ {section}
                </h1>
                {subtitle && (
                  <p className="text-[11px] text-slate-400 font-mono leading-tight">{subtitle}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="flex items-center gap-3 text-sky-400">
          <Construction className="h-8 w-8" aria-hidden="true" />
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-100">Work in Progress</h2>
        </div>
        <p className="mt-4 max-w-md text-slate-400">
          This page is still under construction. Check back soon.
        </p>
      </main>
    </div>
  );
}

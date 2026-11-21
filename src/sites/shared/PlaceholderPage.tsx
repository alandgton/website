import { Construction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  FLOATING_ISLAND_BASE_CLASS,
  HeaderDivider,
  MainBackLink,
} from './FloatingHeader';

interface PlaceholderPageProps {
  /** Section name shown after "Alan Ton @", e.g. "Home" or "Work". */
  section: string;
  /** Optional monospace subtext shown as title tooltip. */
  subtitle?: string;
  /** Icon rendered inside the header title badge. */
  icon: LucideIcon;
}

/** Temporary "Work in Progress" page for sections that are not built yet. */
export function PlaceholderPage({ section, subtitle, icon: Icon }: PlaceholderPageProps) {
  const heading = `Alan Ton @ ${section}`;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden">
      <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
        <div
          className={`${FLOATING_ISLAND_BASE_CLASS} w-full max-w-[390px] sm:w-auto sm:max-w-none grid grid-cols-[1fr_auto_1fr] sm:flex items-center justify-center gap-2 sm:gap-2.5 px-3.5 py-2 sm:px-4`}
        >
          <MainBackLink className="justify-self-start" />
          <HeaderDivider />
          <h1
            className="justify-self-center flex items-center gap-1.5 font-bold tracking-tight text-white whitespace-nowrap"
            title={subtitle ? `${heading} — ${subtitle}` : heading}
          >
            <Icon className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span>{heading}</span>
          </h1>
          <span className="sm:hidden" aria-hidden="true" />
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

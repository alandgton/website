import { Construction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CenteredSubsiteHeader } from './FloatingHeader';

interface PlaceholderPageProps {
  /** Section name shown after "Alan Ton @", e.g. "Home" or "Work". */
  section: string;
  /** Optional monospace subtext shown as title tooltip. */
  subtitle?: string;
  /** Icon rendered inside the header title badge. */
  icon: LucideIcon;
}

/** Temporary "Work in Progress" page for sections that are not built yet. */
export function PlaceholderPage({ section, subtitle, icon }: PlaceholderPageProps) {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden">
      <CenteredSubsiteHeader section={section} subtitle={subtitle} icon={icon} />

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

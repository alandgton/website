import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Shared glassmorphic pill chrome for top floating headers across sub-sites
 * (/gardenleave/, /work/, /home/).
 */
export const FLOATING_ISLAND_BASE_CLASS =
  'pointer-events-auto rounded-2xl border border-slate-800/90 bg-slate-900/85 shadow-2xl backdrop-blur-md text-xs';

interface MainBackLinkProps {
  className?: string;
  gapClassName?: string;
}

/** Consistent return-to-landing ("← Main") link shared across sub-site headers. */
export const MainBackLink: React.FC<MainBackLinkProps> = ({
  className = '',
  gapClassName = 'gap-1.5',
}) => (
  <a
    href="/"
    title="Main"
    className={`shrink-0 flex items-center ${gapClassName} text-slate-300 hover:text-sky-300 font-semibold transition-colors group ${className}`.trim()}
  >
    <ArrowLeft
      className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-sky-400"
      aria-hidden="true"
    />
    <span>Main</span>
  </a>
);

interface HeaderDividerProps {
  className?: string;
}

/** Subtle vertical hairline separator displayed between header sections on sm+ viewports. */
export const HeaderDivider: React.FC<HeaderDividerProps> = ({ className = '' }) => (
  <span
    className={`hidden sm:inline-block h-3.5 w-px bg-slate-800 shrink-0 ${className}`.trim()}
    aria-hidden="true"
  />
);

interface CenteredSubsiteHeaderProps {
  /** Section name shown after "Alan Ton @", e.g. "Home". */
  section: string;
  /** Optional monospace subtext shown as title tooltip. */
  subtitle?: string;
  /** Icon rendered inside the header title badge. */
  icon: LucideIcon;
}

/**
 * Centered floating sub-site navigation header with dead-center title alignment
 * on narrow mobile viewports (`← Main` left, title center).
 */
export const CenteredSubsiteHeader: React.FC<CenteredSubsiteHeaderProps> = ({
  section,
  subtitle,
  icon: Icon,
}) => {
  const heading = `Alan Ton @ ${section}`;

  return (
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
  );
};

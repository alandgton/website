import React from 'react';
import { ArrowLeft } from 'lucide-react';

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

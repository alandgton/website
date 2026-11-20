import React, { useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { EXPERIENCE_ENTRIES } from './config/experience.config';
import { ExperienceCard } from './components/ExperienceCard';
import { WorkHeader } from './components/WorkHeader';

/**
 * Alan Ton @ Work — Mobile-first vertical experience timeline.
 */
export const WorkPage: React.FC = () => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['citadel']));

  const allExpanded =
    EXPERIENCE_ENTRIES.length > 0 &&
    EXPERIENCE_ENTRIES.every((entry) => expandedIds.has(entry.id));

  const handleToggleCard = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    setExpandedIds(
      allExpanded ? new Set() : new Set(EXPERIENCE_ENTRIES.map((entry) => entry.id))
    );
  };

  return (
    <div className="relative min-h-screen bg-[#060913] text-slate-100 selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden">
      {/* Subtle atmospheric glow matching LandingPage */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),transparent_70%)]"
        aria-hidden="true"
      />

      <WorkHeader />

      <main className="relative z-10 mx-auto w-full max-w-xl px-3.5 pt-4 pb-14 sm:px-6 sm:pt-6">
        {/* Expand / Collapse Control */}
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={handleToggleExpandAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/75 px-2.5 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md transition-colors hover:border-sky-500/50 hover:text-sky-300"
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Collapse all</span>
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Expand all</span>
              </>
            )}
          </button>
        </div>

        {/* Vertical Timeline */}
        <ol aria-label="Work experience timeline">
          {EXPERIENCE_ENTRIES.map((entry, idx) => (
            <ExperienceCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedIds.has(entry.id)}
              isFirst={idx === 0}
              isLast={idx === EXPERIENCE_ENTRIES.length - 1}
              onToggle={handleToggleCard}
            />
          ))}
        </ol>
      </main>
    </div>
  );
};

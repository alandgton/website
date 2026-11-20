import React from 'react';
import { ChevronDown, Layers, MapPin } from 'lucide-react';
import { ExperienceEntry } from '../config/experience.config';

interface ExperienceCardProps {
  entry: ExperienceEntry;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (id: string) => void;
}

/**
 * Mobile-first multi-row vertical timeline item with a slim left spine and
 * expandable focus/location details.
 */
export const ExperienceCard: React.FC<ExperienceCardProps> = ({
  entry,
  isExpanded,
  isFirst,
  isLast,
  onToggle,
}) => {
  const panelId = `experience-panel-${entry.id}`;

  return (
    <li className="grid grid-cols-[14px_1fr] sm:grid-cols-[18px_1fr] gap-2.5 sm:gap-3.5 items-stretch">
      {/* Slim Vertical Spine & Node */}
      <div className="relative flex flex-col items-center" aria-hidden="true">
        {isFirst ? (
          <div className="h-5" />
        ) : (
          <div className="w-px h-5 bg-slate-800" />
        )}

        <span
          className={`h-2.5 w-2.5 rounded-full shrink-0 border-2 border-[#060913] transition-all ${
            entry.isCurrent
              ? 'bg-sky-400 ring-4 ring-sky-400/20 shadow-[0_0_8px_rgba(56,189,248,0.65)]'
              : isExpanded
                ? 'bg-sky-400 ring-4 ring-sky-400/15'
                : 'bg-slate-300'
          }`}
        />

        {!isLast && <div className="w-px flex-1 bg-slate-800" />}
      </div>

      {/* Multi-Row Expandable Card */}
      <div className={isLast ? '' : 'pb-2.5 sm:pb-3'}>
        <article
          className={`rounded-2xl border backdrop-blur-md transition-all duration-200 ${
            isExpanded
              ? 'border-sky-500/50 bg-slate-900/90 shadow-lg shadow-black/30'
              : 'border-slate-800/90 bg-slate-900/65 hover:border-slate-700 hover:bg-slate-900/80'
          }`}
        >
          <button
            type="button"
            onClick={() => onToggle(entry.id)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            className="w-full text-left px-3.5 py-3 sm:px-4 sm:py-3.5 space-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 rounded-2xl"
          >
            {/* Row 1: Date Range + Current Badge / Chevron */}
            <div className="flex items-center justify-between gap-2">
              <time className="font-mono text-xs tabular-nums text-slate-400">
                {entry.dateRange}
              </time>

              <div className="flex items-center gap-2 shrink-0">
                {entry.isCurrent && (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-medium text-sky-300 leading-none">
                    Present
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-sky-300' : ''
                  }`}
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Row 2: Company Name (Full Width) */}
            <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white leading-snug">
              {entry.company}
            </h2>

            {/* Row 3: Role + Employment Type (Full Width) */}
            <p className="text-xs sm:text-sm text-slate-300 leading-snug">
              <span>{entry.role}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-400">{entry.employmentType}</span>
            </p>
          </button>

          {/* Expanded Details */}
          {isExpanded && (
            <div
              id={panelId}
              className="mx-3.5 sm:mx-4 border-t border-slate-800/80 pt-2.5 pb-3.5 space-y-2.5 text-xs sm:text-sm"
            >
              {entry.courses ? (
                <div className="space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                    Courses
                  </div>
                  <ul className="space-y-1.5">
                    {entry.courses.map((course) => (
                      <li key={course.code} className="flex items-baseline gap-2 leading-snug">
                        <span className="shrink-0 rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 font-mono text-xs font-medium text-sky-300">
                          {course.code}
                        </span>
                        <span className="text-slate-200">{course.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                entry.focus && (
                  <div className="flex items-start gap-2 text-slate-200 leading-snug">
                    <Layers
                      className="h-3.5 w-3.5 text-sky-400/80 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{entry.focus}</span>
                  </div>
                )
              )}

              <div className="flex items-start gap-2 text-xs text-slate-400 leading-snug">
                <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{entry.location}</span>
              </div>
            </div>
          )}
        </article>
      </div>
    </li>
  );
};

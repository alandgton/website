import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Calendar, List, X } from 'lucide-react';
import { CityConfig, ItineraryLegConfig } from '../config/types';

interface ItineraryModalProps {
  isOpen: boolean;
  itinerary: ItineraryLegConfig[];
  cities: Record<string, CityConfig>;
  onClose: () => void;
}

interface TripMonth {
  year: number;
  month: number; // 0-indexed (0 = January)
  ym: string; // YYYY-MM
  name: string;
}

interface CalendarDayCell {
  iso: string;
  dayNum: number;
  inMonth: boolean;
}

const MS_PER_DAY = 86_400_000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  usa: '🇺🇸',
  'united states': '🇺🇸',
  sweden: '🇸🇪',
  denmark: '🇩🇰',
  switzerland: '🇨🇭',
  austria: '🇦🇹',
  hungary: '🇭🇺',
  czechia: '🇨🇿',
  'czech republic': '🇨🇿',
  germany: '🇩🇪',
  egypt: '🇪🇬',
  uae: '🇦🇪',
  'united arab emirates': '🇦🇪',
  singapore: '🇸🇬',
  china: '🇨🇳',
  'china (sar)': '🇭🇰',
  'hong kong': '🇭🇰',
  'south korea': '🇰🇷',
  'korea, republic of': '🇰🇷',
  japan: '🇯🇵',
  canada: '🇨🇦',
  uk: '🇬🇧',
  'united kingdom': '🇬🇧',
  france: '🇫🇷',
  italy: '🇮🇹',
  spain: '🇪🇸',
  netherlands: '🇳🇱',
  turkey: '🇹🇷',
  thailand: '🇹🇭',
  taiwan: '🇹🇼',
  australia: '🇦🇺',
};

/**
 * Resolves a country flag emoji from a city's country name (or city ID fallback).
 */
export function getCountryFlag(country?: string, cityId?: string): string {
  if (cityId?.trim().toUpperCase() === 'HK') return '🇭🇰';
  const normalized = country?.trim().toLowerCase();
  if (!normalized) return '🌐';
  return COUNTRY_FLAGS[normalized] ?? '🌐';
}

function toIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso: string, deltaDays: number): string {
  const ms = Date.parse(`${iso.trim()}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  return toIsoDateUtc(new Date(ms + deltaDays * MS_PER_DAY));
}

/**
 * Formats an ISO YYYY-MM-DD date string in UTC as `Weekday M/D` (no year or leading zeros).
 */
export function formatShortDayDate(iso: string): string {
  const ms = Date.parse(`${iso.trim()}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/**
 * Formats a start/end ISO date pair as `Weekday M/D – Weekday M/D`,
 * collapsing intraday stops (`startIso === endIso`) to a single `Weekday M/D`.
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = startIso.trim();
  const end = endIso.trim();
  if (start === end) {
    return formatShortDayDate(start);
  }
  return `${formatShortDayDate(start)} – ${formatShortDayDate(end)}`;
}

function getWeeksForMonth(year: number, month: number): CalendarDayCell[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const startOffset = first.getUTCDay();
  const gridStart = new Date(Date.UTC(year, month, 1 - startOffset));
  const totalDaysNeeded = startOffset + last.getUTCDate();
  const totalWeeks = Math.ceil(totalDaysNeeded / 7);

  const weeks: CalendarDayCell[][] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekDays: CalendarDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(gridStart.getTime() + (w * 7 + d) * MS_PER_DAY);
      weekDays.push({
        iso: toIsoDateUtc(cur),
        dayNum: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === month,
      });
    }
    weeks.push(weekDays);
  }
  return weeks;
}

function getInitialMonthIndex(months: TripMonth[]): number {
  if (months.length === 0) return 0;
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const exactMatch = months.findIndex((m) => m.ym === currentYm);
  if (exactMatch >= 0) return exactMatch;

  const monthMatch = months.findIndex((m) => m.month === now.getMonth());
  if (monthMatch >= 0) return monthMatch;

  return 0;
}

/**
 * Sticky left gutter bar with a -90° rotated (Read Up) month label shared across Calendar and List views.
 */
function StickyMonthGutter({ label, zClass }: { label: string; zClass: string }) {
  return (
    <div className="w-7 shrink-0 relative flex flex-col items-center py-2 bg-slate-900/55 border-r border-slate-800/90">
      <div
        className={`sticky top-2 ${zClass} flex items-center justify-center border-l-2 border-sky-400/80 pl-1 pr-0.5 py-2 text-sky-300 font-bold text-xs tracking-wider uppercase`}
      >
        <span
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          className="whitespace-nowrap leading-none"
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export const ItineraryModal: React.FC<ItineraryModalProps> = ({
  isOpen,
  itinerary,
  cities,
  onClose,
}) => {
  const months = useMemo<TripMonth[]>(() => {
    const seen = new Set<string>();
    const list: TripMonth[] = [];
    for (const leg of itinerary) {
      const ym = leg.startDate.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym) || seen.has(ym)) continue;
      seen.add(ym);
      const year = Number(ym.slice(0, 4));
      const month = Number(ym.slice(5, 7)) - 1;
      list.push({
        year,
        month,
        ym,
        name: MONTH_NAMES[month] ?? ym,
      });
    }
    return list;
  }, [itinerary]);

  const [activeMode, setActiveMode] = useState<'calendar' | 'list'>('calendar');

  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const currentCalendarRowRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const currentLegRowRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  useEffect(() => {
    if (!isOpen) return;
    setActiveMode('calendar');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const legsWithSpan = useMemo(
    () =>
      itinerary.map((leg, idx) => ({
        leg,
        idx,
        barStart: leg.startDate,
        barEnd: leg.nights > 0 ? addDaysIso(leg.endDate, -1) : leg.startDate,
      })),
    [itinerary]
  );

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, ItineraryLegConfig[]>();
    for (const leg of itinerary) {
      const ym = leg.startDate.slice(0, 7);
      const list = groups.get(ym);
      if (list) {
        list.push(leg);
      } else {
        groups.set(ym, [leg]);
      }
    }
    return Array.from(groups.entries()).map(([ym, legs]) => {
      const monthNum = Number(ym.slice(5, 7)) - 1;
      return {
        ym,
        monthName: MONTH_NAMES[monthNum] ?? ym,
        legs,
      };
    });
  }, [itinerary]);

  const currentLegId = useMemo<number | null>(() => {
    const activeMatch = legsWithSpan.find(
      (item) => todayIso >= item.barStart && todayIso <= item.barEnd
    );
    if (activeMatch) return activeMatch.leg.id;

    const rangeMatch = itinerary.find(
      (leg) => todayIso >= leg.startDate && todayIso <= leg.endDate
    );
    if (rangeMatch) return rangeMatch.id;

    const initialMonth = months[getInitialMonthIndex(months)];
    if (initialMonth) {
      const monthLeg = itinerary.find((leg) => leg.startDate.startsWith(initialMonth.ym));
      if (monthLeg) return monthLeg.id;
    }

    return itinerary[0]?.id ?? null;
  }, [itinerary, legsWithSpan, months, todayIso]);

  const monthsWithWeeks = useMemo(
    () =>
      months.map((m) => ({
        ...m,
        weeks: getWeeksForMonth(m.year, m.month),
      })),
    [months]
  );

  const hasTodayInTrip = useMemo(
    () =>
      monthsWithWeeks.some((m) =>
        m.weeks.some((week) => week.some((day) => day.iso === todayIso && day.inMonth))
      ),
    [monthsWithWeeks, todayIso]
  );

  const fallbackCalendarYm = !hasTodayInTrip
    ? (months[getInitialMonthIndex(months)]?.ym ?? null)
    : null;

  useLayoutEffect(() => {
    if (!isOpen || activeMode !== 'calendar') return;
    const container = calendarContainerRef.current;
    const row = currentCalendarRowRef.current;
    if (!container || !row) return;

    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const targetScrollTop =
      container.scrollTop +
      (rowRect.top - containerRect.top) -
      containerRect.height / 2 +
      rowRect.height / 2;
    container.scrollTop = Math.max(0, targetScrollTop);
  }, [isOpen, activeMode, monthsWithWeeks, todayIso]);

  useLayoutEffect(() => {
    if (!isOpen || activeMode !== 'list') return;
    const container = listContainerRef.current;
    const row = currentLegRowRef.current;
    if (!container || !row) return;

    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const targetScrollTop =
      container.scrollTop +
      (rowRect.top - containerRect.top) -
      containerRect.height / 2 +
      rowRect.height / 2;
    container.scrollTop = Math.max(0, targetScrollTop);
  }, [isOpen, activeMode, currentLegId]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Itinerary"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4 backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[82dvh] rounded-2xl border border-slate-700/85 bg-slate-900/95 shadow-2xl overflow-hidden flex flex-col text-slate-100"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 border-b border-slate-800 shrink-0">
          {/* Calendar | List Toggle */}
          <div
            role="tablist"
            aria-label="Itinerary View"
            className="flex items-center rounded-lg border border-slate-800 bg-slate-950/80 p-0.5 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'calendar'}
              onClick={() => setActiveMode('calendar')}
              className={`flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold transition ${
                activeMode === 'calendar'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'list'}
              onClick={() => setActiveMode('list')}
              className={`flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold transition ${
                activeMode === 'list'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>List</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeMode === 'list' && (
              <span className="hidden sm:inline-block rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-300">
                {itinerary.length} stops
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Itinerary"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Calendar View (Scrollable Multi-Month Sections with Sticky Left Gutter) */}
        {activeMode === 'calendar' ? (
          <>
            <div className="flex items-center border-b border-slate-800/80 bg-slate-900 shrink-0 text-xs font-medium text-slate-400">
              <div
                className="w-7 shrink-0 self-stretch border-r border-slate-800/90 bg-slate-900/55"
                aria-hidden="true"
              />
              <div className="grid grid-cols-7 flex-1 text-center px-2 sm:px-2.5 py-1.5">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            </div>

            <div
              ref={calendarContainerRef}
              data-testid="itinerary-calendar-scroll"
              className="overflow-y-auto flex-1"
            >
              {monthsWithWeeks.map((m, mIdx) => {
                const rowHeightClass = m.weeks.length >= 6 ? 'min-h-[52px]' : 'min-h-[60px]';
                return (
                  <section
                    key={m.ym}
                    className={`flex min-h-[88px] ${mIdx > 0 ? 'border-t border-slate-800/80' : ''}`}
                  >
                    <StickyMonthGutter label={m.name} zClass="z-20" />
                    <div className="flex-1 min-w-0 p-2 sm:p-2.5 space-y-1.5">
                      {m.weeks.map((week, wIdx) => {
                        const firstInMonthCol = week.findIndex((day) => day.inMonth);
                        let lastInMonthCol = -1;
                        for (let c = week.length - 1; c >= 0; c--) {
                          if (week[c].inMonth) {
                            lastInMonthCol = c;
                            break;
                          }
                        }
                        if (firstInMonthCol < 0 || lastInMonthCol < firstInMonthCol) return null;

                        const wStart = week[0].iso;
                        const inMonthSpan = lastInMonthCol - firstInMonthCol + 1;
                        const activeStartIso = week[firstInMonthCol].iso;
                        const activeEndIso = week[lastInMonthCol].iso;
                        const todayCol = week.findIndex((day) => day.iso === todayIso && day.inMonth);
                        const isTargetWeek = hasTodayInTrip
                          ? todayCol >= 0
                          : m.ym === fallbackCalendarYm && wIdx === Math.floor(m.weeks.length / 2);
                        const weekBars = legsWithSpan.filter(
                          (item) => item.barEnd >= activeStartIso && item.barStart <= activeEndIso
                        );

                        return (
                          <div
                            key={`${m.ym}-${wStart}`}
                            ref={isTargetWeek ? currentCalendarRowRef : undefined}
                            className={`relative ${rowHeightClass} pb-1 flex flex-col justify-between`}
                          >
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 grid grid-cols-7"
                            >
                              <div
                                style={{ gridColumn: `${firstInMonthCol + 1} / span ${inMonthSpan}` }}
                                className="rounded-lg border border-slate-800/80 bg-slate-950/55"
                              />
                            </div>

                            {todayCol >= 0 && (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 grid grid-cols-7"
                              >
                                <div
                                  style={{ gridColumn: `${todayCol + 1} / span 1` }}
                                  className="rounded-lg border-2 border-sky-400/90 bg-sky-500/10"
                                />
                              </div>
                            )}

                            <div className="relative z-10 grid grid-cols-7">
                              {week.map((day) => {
                                if (!day.inMonth) {
                                  return (
                                    <div
                                      key={day.iso}
                                      aria-hidden="true"
                                      className="px-1.5 pt-1 text-[11px] sm:text-xs"
                                    />
                                  );
                                }
                                const isToday = day.iso === todayIso;
                                return (
                                  <div
                                    key={day.iso}
                                    aria-current={isToday ? 'date' : undefined}
                                    className={`px-1.5 pt-1 text-[11px] sm:text-xs flex items-center justify-between ${
                                      isToday ? 'font-bold text-sky-300' : 'text-slate-300'
                                    }`}
                                  >
                                    <span>{day.dayNum}</span>
                                    {isToday && (
                                      <span
                                        className="h-1.5 w-1.5 rounded-full bg-sky-400"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <div
                              className="relative z-10 grid grid-cols-7 gap-0.5 px-0.5 mt-0.5"
                              style={{ gridAutoFlow: 'dense' }}
                            >
                              {weekBars.map(({ leg, idx, barStart, barEnd }) => {
                                const effectiveStart =
                                  barStart < activeStartIso ? activeStartIso : barStart;
                                const effectiveEnd =
                                  barEnd > activeEndIso ? activeEndIso : barEnd;
                                let cStart = firstInMonthCol;
                                let cEnd = lastInMonthCol;
                                for (let c = firstInMonthCol; c <= lastInMonthCol; c++) {
                                  if (week[c].iso === effectiveStart) cStart = c;
                                  if (week[c].iso === effectiveEnd) cEnd = c;
                                }

                                const spanCols = Math.max(1, cEnd - cStart + 1);
                                const cityName = cities[leg.dest]?.name ?? leg.dest;
                                const isIntraday = leg.nights === 0;
                                const barStyle = isIntraday
                                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                                  : idx % 2 === 0
                                    ? 'bg-slate-800/95 border-sky-500/35 text-sky-200'
                                    : 'bg-sky-950/80 border-sky-500/25 text-slate-200';

                                return (
                                  <div
                                    key={`${m.ym}-${wStart}-${leg.id}`}
                                    style={{ gridColumn: `${cStart + 1} / span ${spanCols}` }}
                                    title={`${cityName}: ${formatDateRange(leg.startDate, leg.endDate)}`}
                                    className={`truncate rounded border px-1 sm:px-1.5 py-0.5 text-left text-[11px] sm:text-xs font-medium select-text ${barStyle}`}
                                  >
                                    {leg.dest}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          /* List View (Monthly Agenda Timeline with Weekday M/D Dates) */
          <div ref={listContainerRef} className="overflow-y-auto flex-1">
            {groupedByMonth.map(({ ym, monthName, legs }, mIdx) => (
              <section
                key={ym}
                className={`flex min-h-[88px] ${mIdx > 0 ? 'border-t border-slate-800/80' : ''}`}
              >
                <StickyMonthGutter label={monthName} zClass="z-10" />
                <div className="flex-1 min-w-0 divide-y divide-slate-800/50">
                  {legs.map((leg) => {
                    const city = cities[leg.dest];
                    const cityName = city?.name ?? leg.dest;
                    const flag = getCountryFlag(city?.country, leg.dest);
                    const isCurrentLeg = leg.id === currentLegId;

                    return (
                      <div
                        key={leg.id}
                        ref={isCurrentLeg ? currentLegRowRef : undefined}
                        aria-current={isCurrentLeg ? 'date' : undefined}
                        className={`flex items-center justify-between gap-3 px-3.5 py-2 text-xs ${
                          isCurrentLeg
                            ? 'bg-sky-500/10 ring-2 ring-inset ring-sky-400/90'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm leading-none shrink-0" aria-hidden="true">
                            {flag}
                          </span>
                          <span
                            className={`font-semibold truncate ${
                              isCurrentLeg ? 'text-sky-300' : 'text-white'
                            }`}
                          >
                            {cityName}
                          </span>
                          {isCurrentLeg && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <span className="font-mono text-[11px] sm:text-xs text-slate-300 tabular-nums shrink-0">
                          {formatDateRange(leg.startDate, leg.endDate)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

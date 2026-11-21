import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

interface ContinuousDayCell {
  iso: string;
  dayNum: number;
  month: number; // 0-indexed (0 = January)
  monthShort: string;
  ym: string;
}

interface ContinuousWeek {
  days: ContinuousDayCell[];
  wStart: string;
  wEnd: string;
  transitionCol: number;
  ownerMonthName: string;
  ownerYm: string;
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

const MONTH_SHORT_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
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

function buildContinuousWeeks(months: TripMonth[]): ContinuousWeek[] {
  if (months.length === 0) return [];
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];

  const firstDay = new Date(Date.UTC(firstMonth.year, firstMonth.month, 1));
  const gridStartMs = Date.UTC(
    firstMonth.year,
    firstMonth.month,
    1 - firstDay.getUTCDay()
  );

  const lastDay = new Date(Date.UTC(lastMonth.year, lastMonth.month + 1, 0));
  const endOffset = 6 - lastDay.getUTCDay();
  const gridEndMs = Date.UTC(
    lastMonth.year,
    lastMonth.month + 1,
    endOffset
  );

  const weeks: ContinuousWeek[] = [];
  for (let curMs = gridStartMs; curMs <= gridEndMs; curMs += 7 * MS_PER_DAY) {
    const days: ContinuousDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(curMs + d * MS_PER_DAY);
      const month = cur.getUTCMonth();
      const iso = toIsoDateUtc(cur);
      days.push({
        iso,
        dayNum: cur.getUTCDate(),
        month,
        monthShort: MONTH_SHORT_NAMES[month] ?? '',
        ym: iso.slice(0, 7),
      });
    }

    const transitionCol = days.findIndex(
      (day, idx) => idx > 0 && day.month !== days[idx - 1].month
    );
    const ownerDay = transitionCol > 0 ? days[transitionCol] : days[0];

    weeks.push({
      days,
      wStart: days[0].iso,
      wEnd: days[6].iso,
      transitionCol,
      ownerMonthName: MONTH_NAMES[ownerDay.month] ?? ownerDay.ym,
      ownerYm: ownerDay.ym,
    });
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
 * Vertically centers `row` inside `container` without scrolling past the top boundary.
 */
function centerRowInScrollContainer(
  container: HTMLDivElement | null,
  row: HTMLDivElement | null
): void {
  if (!container || !row) return;
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const targetScrollTop =
    container.scrollTop +
    (rowRect.top - containerRect.top) -
    containerRect.height / 2 +
    rowRect.height / 2;
  container.scrollTop = Math.max(0, targetScrollTop);
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

  const initialMonthIndex = useMemo(() => getInitialMonthIndex(months), [months]);

  const currentLegId = useMemo<number | null>(() => {
    const activeMatch = legsWithSpan.find(
      (item) => todayIso >= item.barStart && todayIso <= item.barEnd
    );
    if (activeMatch) return activeMatch.leg.id;

    const rangeMatch = itinerary.find(
      (leg) => todayIso >= leg.startDate && todayIso <= leg.endDate
    );
    if (rangeMatch) return rangeMatch.id;

    const initialMonth = months[initialMonthIndex];
    if (initialMonth) {
      const monthLeg = itinerary.find((leg) => leg.startDate.startsWith(initialMonth.ym));
      if (monthLeg) return monthLeg.id;
    }

    return itinerary[0]?.id ?? null;
  }, [initialMonthIndex, itinerary, legsWithSpan, months, todayIso]);

  const continuousWeeks = useMemo(() => buildContinuousWeeks(months), [months]);

  const barsByWeekStart = useMemo(() => {
    const map = new Map<string, typeof legsWithSpan>();
    for (const week of continuousWeeks) {
      map.set(
        week.wStart,
        legsWithSpan.filter(
          (item) => item.barEnd >= week.wStart && item.barStart <= week.wEnd
        )
      );
    }
    return map;
  }, [continuousWeeks, legsWithSpan]);

  const hasTodayInTrip = useMemo(
    () => continuousWeeks.some((week) => week.days.some((day) => day.iso === todayIso)),
    [continuousWeeks, todayIso]
  );

  const fallbackTargetWeekStart = useMemo(() => {
    if (hasTodayInTrip) return null;
    const fallbackYm = months[initialMonthIndex]?.ym ?? null;
    if (!fallbackYm) return null;
    const matching = continuousWeeks.filter((w) => w.ownerYm === fallbackYm);
    if (matching.length === 0) return null;
    return matching[Math.floor(matching.length / 2)].wStart;
  }, [continuousWeeks, hasTodayInTrip, initialMonthIndex, months]);

  const defaultCalendarMonth = months[initialMonthIndex]?.name ?? '';
  const [activeCalendarMonth, setActiveCalendarMonth] = useState<string>(defaultCalendarMonth);
  const scrollSpyRafRef = useRef<number | null>(null);

  const updateCalendarScrollSpy = useCallback(() => {
    const container = calendarContainerRef.current;
    if (!container) return;
    const rows = container.querySelectorAll<HTMLElement>('[data-week-month]');
    if (rows.length === 0) return;

    if (container.scrollTop <= 8) {
      const firstMonth = rows[0].getAttribute('data-week-month');
      if (firstMonth) setActiveCalendarMonth(firstMonth);
      return;
    }

    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 8) {
      const lastMonth = rows[rows.length - 1].getAttribute('data-week-month');
      if (lastMonth) setActiveCalendarMonth(lastMonth);
      return;
    }

    const probeY = container.getBoundingClientRect().top + container.clientHeight * 0.35;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom >= probeY) {
        const monthLabel = row.getAttribute('data-week-month');
        if (monthLabel) setActiveCalendarMonth(monthLabel);
        break;
      }
    }
  }, []);

  const handleCalendarScroll = useCallback(() => {
    if (scrollSpyRafRef.current !== null) return;
    scrollSpyRafRef.current = window.requestAnimationFrame(() => {
      scrollSpyRafRef.current = null;
      updateCalendarScrollSpy();
    });
  }, [updateCalendarScrollSpy]);

  useEffect(() => {
    return () => {
      if (scrollSpyRafRef.current !== null) {
        window.cancelAnimationFrame(scrollSpyRafRef.current);
        scrollSpyRafRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || activeMode !== 'calendar') return;
    centerRowInScrollContainer(calendarContainerRef.current, currentCalendarRowRef.current);
    updateCalendarScrollSpy();
  }, [isOpen, activeMode, continuousWeeks, todayIso, updateCalendarScrollSpy]);

  useLayoutEffect(() => {
    if (!isOpen || activeMode !== 'list') return;
    centerRowInScrollContainer(listContainerRef.current, currentLegRowRef.current);
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
              onScroll={handleCalendarScroll}
              className="overflow-y-auto flex-1"
            >
              <div className="flex min-h-full">
                <StickyMonthGutter label={activeCalendarMonth} zClass="z-20" />
                <div className="flex-1 min-w-0 p-2 sm:p-2.5 space-y-1.5">
                  {continuousWeeks.map((week) => {
                    const todayCol = week.days.findIndex((day) => day.iso === todayIso);
                    const isTargetWeek = hasTodayInTrip
                      ? todayCol >= 0
                      : week.wStart === fallbackTargetWeekStart;
                    const weekBars = barsByWeekStart.get(week.wStart) ?? [];
                    const hasSplit = week.transitionCol > 0;

                    return (
                      <div
                        key={week.wStart}
                        data-week-month={week.ownerMonthName}
                        ref={isTargetWeek ? currentCalendarRowRef : undefined}
                        className="relative min-h-[56px] rounded-lg border border-slate-800/80 bg-slate-950/55 pb-1 flex flex-col justify-between"
                      >
                        {hasSplit && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 grid grid-cols-7 rounded-lg overflow-hidden"
                          >
                            <div
                              style={{ gridColumn: `1 / span ${week.transitionCol}` }}
                              className="bg-slate-950/80"
                            />
                            <div
                              style={{
                                gridColumn: `${week.transitionCol + 1} / span ${7 - week.transitionCol}`,
                              }}
                              className="bg-sky-950/20 border-l-2 border-sky-400/50"
                            />
                          </div>
                        )}

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
                          {week.days.map((day, colIdx) => {
                            const isToday = day.iso === todayIso;
                            const isFirstOfMonth = day.dayNum === 1;
                            const isSplitBoundary = hasSplit && colIdx === week.transitionCol;
                            const isOutgoingMuted = hasSplit && colIdx < week.transitionCol;

                            return (
                              <div
                                key={day.iso}
                                aria-current={isToday ? 'date' : undefined}
                                className={`px-1 sm:px-1.5 pt-1 text-[11px] sm:text-xs flex items-center justify-between ${
                                  isSplitBoundary ? 'border-l-2 border-sky-400/70' : ''
                                } ${
                                  isToday
                                    ? 'font-bold text-sky-300'
                                    : isFirstOfMonth
                                      ? 'font-bold text-sky-300'
                                      : isOutgoingMuted
                                        ? 'text-slate-500'
                                        : 'text-slate-300'
                                }`}
                              >
                                <span className="truncate">
                                  {isFirstOfMonth ? (
                                    <>
                                      <span className="text-sky-400 mr-0.5">{day.monthShort}</span>1
                                    </>
                                  ) : (
                                    day.dayNum
                                  )}
                                </span>
                                {isToday && (
                                  <span
                                    className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0"
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
                            let cStart = 0;
                            let cEnd = 6;
                            for (let c = 0; c < 7; c++) {
                              if (week.days[c].iso === barStart) cStart = c;
                              if (week.days[c].iso === barEnd) cEnd = c;
                            }
                            if (barStart < week.wStart) cStart = 0;
                            if (barEnd > week.wEnd) cEnd = 6;

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
                                key={`${week.wStart}-${leg.id}`}
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
              </div>
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

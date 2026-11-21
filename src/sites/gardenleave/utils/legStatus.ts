import type { ItineraryLegConfig, LegStatus } from '../config/types';

export interface LegStatusMeta {
  status: LegStatus;
  label: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
}

export const LEG_STATUS_META: Record<LegStatus, LegStatusMeta> = {
  done: {
    status: 'done',
    label: 'Done',
    badgeBg: 'rgba(16, 185, 129, 0.18)',
    badgeColor: '#34d399',
    badgeBorder: 'rgba(52, 211, 153, 0.4)',
  },
  booked: {
    status: 'booked',
    label: 'Booked',
    badgeBg: 'rgba(56, 189, 248, 0.18)',
    badgeColor: '#38bdf8',
    badgeBorder: 'rgba(56, 189, 248, 0.4)',
  },
  tbd: {
    status: 'tbd',
    label: 'TBD',
    badgeBg: 'rgba(148, 163, 184, 0.16)',
    badgeColor: '#cbd5e1',
    badgeBorder: 'rgba(148, 163, 184, 0.35)',
  },
};

const STATUS_RANK: Record<LegStatus, number> = {
  tbd: 0,
  booked: 1,
  done: 2,
};

export function higherStatus(a: LegStatus | undefined, b: LegStatus): LegStatus {
  if (!a) return b;
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

/**
 * Returns local calendar date formatted as ISO YYYY-MM-DD.
 */
export function getLocalTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Resolves a leg's display status dynamically from today's date + lightweight `booked` flag:
 * - `startDate <= todayIso` -> `'done'` (already departed/traveled)
 * - `startDate > todayIso && booked === true` -> `'booked'`
 * - Otherwise -> `'tbd'`
 */
export function resolveLegStatus(
  leg: Pick<ItineraryLegConfig, 'startDate' | 'booked'>,
  todayIso: string
): LegStatus {
  const start = leg.startDate.trim();
  if (start && start <= todayIso) {
    return 'done';
  }
  return leg.booked ? 'booked' : 'tbd';
}

/**
 * Finds the live currently active stop leg for `todayIso`, or `null` if outside the trip window.
 * On transition days (checkout of stop A === check-in of stop B), prefers the arriving stop
 * (`todayIso >= startDate && todayIso < endDate`), matching ItineraryModal's bar span.
 */
export function findCurrentActiveLeg(
  itinerary: ItineraryLegConfig[],
  todayIso: string
): ItineraryLegConfig | null {
  for (const leg of itinerary) {
    if (!leg.startDate) continue;
    if (leg.nights > 0) {
      if (todayIso >= leg.startDate && todayIso < leg.endDate) {
        return leg;
      }
    } else if (todayIso === leg.startDate) {
      return leg;
    }
  }

  for (const leg of itinerary) {
    if (leg.startDate && todayIso >= leg.startDate && todayIso <= leg.endDate) {
      return leg;
    }
  }

  return null;
}

export interface ComputedJourneyStatuses {
  todayIso: string;
  legStatuses: Record<number, LegStatus>;
  cityStatuses: Record<string, LegStatus>;
  currentLegId: number | null;
  currentCityId: string | null;
}

/**
 * Computes per-leg statuses, per-city highest-precedence statuses (`done > booked > tbd`),
 * and the currently active ("Now") leg/city for `todayIso`.
 */
export function computeJourneyStatuses(
  itinerary: ItineraryLegConfig[],
  homeCityId: string,
  todayIso: string = getLocalTodayIso()
): ComputedJourneyStatuses {
  const legStatuses: Record<number, LegStatus> = {};
  const cityStatuses: Record<string, LegStatus> = {};

  if (homeCityId) {
    cityStatuses[homeCityId] = 'done';
  }

  for (const leg of itinerary) {
    const status = resolveLegStatus(leg, todayIso);
    legStatuses[leg.id] = status;

    if (status === 'done') {
      cityStatuses[leg.source] = higherStatus(cityStatuses[leg.source], 'done');
      cityStatuses[leg.dest] = higherStatus(cityStatuses[leg.dest], 'done');
    } else {
      cityStatuses[leg.dest] = higherStatus(cityStatuses[leg.dest], status);
      if (!cityStatuses[leg.source]) {
        cityStatuses[leg.source] = 'tbd';
      }
    }
  }

  const activeLeg = findCurrentActiveLeg(itinerary, todayIso);

  return {
    todayIso,
    legStatuses,
    cityStatuses,
    currentLegId: activeLeg?.id ?? null,
    currentCityId: activeLeg?.dest ?? null,
  };
}

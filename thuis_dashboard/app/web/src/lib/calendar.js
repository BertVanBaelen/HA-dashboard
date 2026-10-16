import { callServiceResponse } from './api.js';
import { colorFor } from './colors.js';

const pad = (n) => String(n).padStart(2, '0');
/** Local "YYYY-MM-DD HH:MM:SS" as HA expects. */
export const haDateTime = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const haDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse HA date or datetime; all-day dates ("YYYY-MM-DD") become local midnight. */
export function parseHaDate(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}

/**
 * Fetch events from several calendars and flatten/sort them.
 * @returns {Promise<{calendar:string,color:string,summary:string,start:Date,end:Date,allDay:boolean,location?:string,description?:string,uid?:string}[]>}
 */
export async function fetchEvents(calendars, start, end) {
  if (!calendars?.length) return [];
  const res = await callServiceResponse('calendar', 'get_events', { start_date_time: haDateTime(start), end_date_time: haDateTime(end) }, calendars);
  const out = [];
  for (const [cal, { events = [] } = {}] of Object.entries(res ?? {})) {
    for (const e of events) {
      out.push({
        calendar: cal,
        color: colorFor(cal),
        summary: e.summary ?? '(geen titel)',
        start: parseHaDate(e.start),
        end: parseHaDate(e.end),
        allDay: /^\d{4}-\d{2}-\d{2}$/.test(e.start),
        location: e.location,
        description: e.description,
        uid: e.uid,
      });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.allDay) - Number(a.allDay));
}

/**
 * Events that are running at `now` plus upcoming (non all-day) events starting within `aheadMs`.
 * Falls back to the calendar entity state/attributes (only the first active event) when fetching fails.
 * @param {string[]} calendars
 * @param {Record<string, any>} [entityStates] `$states`, used for the fallback
 */
export async function fetchCurrentEvents(calendars, now = new Date(), aheadMs = 2 * 3600e3, entityStates = {}) {
  if (!calendars?.length) return { active: [], next: [] };
  const t = now.getTime();
  let events;
  try {
    const seen = new Set();
    events = (await fetchEvents(calendars, new Date(t - 1000), new Date(t + aheadMs))).filter((e) => {
      const k = `${e.calendar}|${e.uid ?? ''}|${e.summary}|${e.start.getTime()}`;
      return !seen.has(k) && !!seen.add(k);
    });
  } catch {
    events = calendars
      .map((cal) => ({ cal, s: entityStates[cal] }))
      .filter(({ s }) => s?.state === 'on' && s.attributes?.start_time)
      .map(({ cal, s }) => {
        const a = s.attributes;
        return { calendar: cal, color: colorFor(cal), summary: a.message ?? '(geen titel)', start: parseHaDate(a.start_time), end: parseHaDate(a.end_time ?? a.start_time), allDay: !!a.all_day, location: a.location, description: a.description };
      });
  }
  return {
    active: events.filter((e) => e.start.getTime() <= t && e.end.getTime() > t),
    next: events.filter((e) => !e.allDay && e.start.getTime() > t && e.start.getTime() <= t + aheadMs),
  };
}

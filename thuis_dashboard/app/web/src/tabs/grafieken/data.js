import { haRequest } from '../../lib/api.js';

const H = 3600e3;
const D = 86400e3;

export const RANGES = {
  '6u': { label: '6u', ms: 6 * H },
  '24u': { label: '24u', ms: 24 * H },
  '7d': { label: '7d', ms: 7 * D },
  '30d': { label: '30d', ms: 30 * D },
};

export const PERIOD_MS = { '5minute': 300e3, hour: H, day: D };

/** History for short ranges, hourly/daily long-term statistics for long ranges. */
export const periodAuto = (/** @type {string} */ range) => (RANGES[range].ms <= 24 * H ? null : range === '7d' ? 'hour' : 'day');
export const period5min = (/** @type {string} */ range) => (RANGES[range].ms <= 24 * H ? '5minute' : range === '7d' ? 'hour' : 'day');
export const periodHourly = (/** @type {string} */ range) => (RANGES[range].ms <= 24 * H ? null : 'hour');
export const periodDaily = () => 'day';

const toNum = (v) => {
  if (v == null || v === '' || v === 'unavailable' || v === 'unknown') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toMs = (t) => (typeof t === 'number' ? (t < 1e11 ? t * 1000 : t) : Date.parse(t));

/** Parse HA history entries (compressed `{s,a,lu,lc}` or full `{state,attributes,last_updated}`). */
function parseHistory(list, attr = '') {
  const pts = [];
  let lastAttr = null;
  for (const e of list ?? []) {
    const t = toMs(e.lu ?? e.lc ?? e.last_updated ?? e.last_changed);
    if (!Number.isFinite(t)) continue;
    let v;
    if (attr) {
      const a = e.a ?? e.attributes;
      if (a && attr in a) lastAttr = toNum(a[attr]);
      v = lastAttr;
    } else v = toNum(e.s ?? e.state);
    if (v != null) pts.push([t, v]);
  }
  return pts;
}

function parseStats(list, stat) {
  const pts = [];
  let prev = null;
  for (const e of list ?? []) {
    const t = toMs(e.start);
    let v = toNum(e[stat]);
    if (stat === 'change' && v == null) {
      const s = toNum(e.state ?? e.sum);
      v = s != null && prev != null ? Math.max(0, s - prev) : null;
      if (s != null) prev = s;
    }
    if (Number.isFinite(t) && v != null) pts.push([t, v]);
  }
  return pts;
}

/** Aggregate raw history into statistic-like buckets (fallback when a sensor has no long-term statistics). */
function bucketize(pts, period, stat) {
  const step = PERIOD_MS[period];
  const buckets = new Map();
  for (const [t, v] of pts) {
    const d = new Date(t);
    const key = period === 'day' ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : Math.floor(t / step) * step;
    const b = buckets.get(key) ?? { sum: 0, n: 0, min: Infinity, max: -Infinity, first: v, last: v };
    b.sum += v; b.n++; b.min = Math.min(b.min, v); b.max = Math.max(b.max, v); b.last = v;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, b]) => [t, stat === 'min' ? b.min : stat === 'max' ? b.max : stat === 'change' ? Math.max(0, b.last - b.first) : stat === 'state' ? b.last : b.sum / b.n]);
}

async function history(ids, start, end, withAttrs) {
  if (!ids.length) return {};
  return (
    (await haRequest({
      type: 'history/history_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: ids,
      minimal_response: !withAttrs,
      no_attributes: !withAttrs,
      significant_changes_only: false,
    })) ?? {}
  );
}

async function statistics(ids, start, end, period) {
  if (!ids.length) return {};
  return (
    (await haRequest({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: ids,
      period,
      types: ['mean', 'min', 'max', 'change', 'state'],
    })) ?? {}
  );
}

const uniq = (a) => [...new Set(a)];

/**
 * @typedef {{entity:string, label:string, color:string, unit?:string, axis?:string, type?:string, stat?:string, attr?:string, dash?:boolean, digits?:number, size?:number, map?:(v:number)=>number|null}} SeriesDef
 * @typedef {{ id: string, title: string, iconPath?: string, accent?: string, ranges?: string[], defaultRange: string,
 *   series: SeriesDef[], axes?: Record<string, {unit?: string, range?: number[], zero?: boolean, digits?: number}>, stacked?: boolean,
 *   period?: (r: string) => string|null, height?: number }} ChartDef
 * @typedef {{x:number[], ys:(number|null)[][], raw:(number|null)[][], hold:boolean[], start:number, end:number, step:number|null, period:string|null}} ChartData
 */

/**
 * Load all series for a chart and align them on one time axis (seconds).
 * @param {{series: SeriesDef[], period?: (r:string)=>string|null, stacked?: boolean}} def
 * @param {string} range
 * @returns {Promise<ChartData>}
 */
export async function loadChart(def, range) {
  const end = new Date();
  const start = new Date(end.getTime() - RANGES[range].ms);
  const period = (def.period ?? periodAuto)(range);
  const series = def.series;

  const valIds = uniq(series.filter((s) => !s.attr).map((s) => s.entity));
  const attrIds = uniq(series.filter((s) => s.attr).map((s) => s.entity));
  const histIds = period ? [] : valIds;
  const statIds = period ? valIds : [];

  const [hist, stats, attrHist] = await Promise.all([
    history(histIds, start, end, false),
    statistics(statIds, start, end, period),
    history(attrIds, start, end, true),
  ]);
  const missing = statIds.filter((id) => !stats[id]?.length);
  const fallback = await history(missing, start, end, false);

  const startMs = start.getTime();
  const endMs = end.getTime();
  const perSeries = series.map((s) => {
    if (s.attr) return { pts: parseHistory(attrHist[s.entity], s.attr), hold: true };
    if (!period) return { pts: parseHistory(hist[s.entity]), hold: true };
    if (stats[s.entity]?.length) return { pts: parseStats(stats[s.entity], s.stat ?? 'mean'), hold: false };
    return { pts: bucketize(parseHistory(fallback[s.entity]), period, s.stat ?? 'mean'), hold: false };
  });

  for (const [i, p] of perSeries.entries()) {
    const map = series[i].map;
    if (map) p.pts = p.pts.map(([t, v]) => [t, map(v)]).filter(([, v]) => v != null && Number.isFinite(v));
  }

  for (const p of perSeries) {
    if (!p.hold || !p.pts.length) continue;
    p.pts = p.pts.map(([t, v]) => [Math.max(t, startMs), v]);
    const last = p.pts[p.pts.length - 1];
    if (last[0] < endMs) p.pts.push([endMs, last[1]]);
  }

  const sec = (t) => Math.round(t / 1000);
  const x = uniq(perSeries.flatMap((p) => p.pts.map(([t]) => sec(t)))).sort((a, b) => a - b);
  const index = new Map(x.map((t, i) => [t, i]));
  const raw = perSeries.map((p) => {
    const arr = new Array(x.length).fill(null);
    for (const [t, v] of p.pts) arr[index.get(sec(t))] = v;
    return arr;
  });

  let ys = raw;
  if (def.stacked) {
    const filled = raw.map((arr) => {
      let last = 0;
      return arr.map((v) => (v == null ? last : (last = v)));
    });
    ys = filled.map((_, si) => x.map((__, i) => filled.slice(0, si + 1).reduce((a, f) => a + f[i], 0)));
  }

  return {
    x,
    ys,
    raw,
    hold: perSeries.map((p) => p.hold),
    start: sec(startMs),
    end: sec(endMs),
    step: period ? PERIOD_MS[period] / 1000 : null,
    period,
  };
}

/** Value at index; for state-hold (history) series the last known value at or before idx. */
export function valueAt(arr, idx, hold) {
  if (idx == null) return null;
  if (!hold) return arr[idx] ?? null;
  for (let i = idx; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}

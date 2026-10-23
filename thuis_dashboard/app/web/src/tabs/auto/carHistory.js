import { get } from 'svelte/store';
import { CAR_ENTITIES, CAR_BATTERY_KWH, CAR_CHARGE_PRICES } from '$shared/config.js';
import { haRequest, states } from '../../lib/api.js';

const P = CAR_ENTITIES.soc.replace(/^sensor\./, '').replace(/_state_of_charge$/, '');
const sid = (/** @type {string} */ suffix) => `sensor.${P}_${suffix}`;

/** History available in the HA recorder (default retention). */
export const HISTORY_DAYS = 10;

const MIN = 60e3;
const H = 3600e3;

export const IDS = {
  mileage: CAR_ENTITIES.mileage,
  speed: CAR_ENTITIES.speed,
  soc: CAR_ENTITIES.soc,
  powerMode: sid('power_mode'),
  poweredOn: sid('last_powered_on'),
  poweredOff: sid('last_powered_off'),
  batteryEnergy: sid('battery_energy'),
  tripEff: sid('last_trip_efficiency'),
  chargingPower: CAR_ENTITIES.chargingPower,
  chargingSwitch: CAR_ENTITIES.charging,
  chargingStatus: sid('charging_status'),
  lastChargeEnergy: sid('last_charge_energy'),
  capacity: sid('total_battery_capacity'),
};

/**
 * Convert a consumption value to kWh/100km based on its unit.
 * Without a usable unit, small values (< 12) are assumed to be km/kWh.
 * @param {number|null|undefined} v @param {string} [unit]
 * @returns {number|null}
 */
export function toKwh100(v, unit = '') {
  if (v == null || !Number.isFinite(v)) return null;
  const u = String(unit).toLowerCase().replace(/\s/g, '');
  if (u.includes('km/kwh')) return v > 0 ? 100 / v : null;
  if (u.includes('kwh/100')) return v;
  if (u.includes('wh/km')) return v / 10;
  if (u.includes('mi/kwh')) return v > 0 ? 100 / (v * 1.609344) : null;
  return v > 0 && v < 12 ? 100 / v : v;
}

/** Consumption of a HA state object in kWh/100km. @param {any} st */
export function stateKwh100(st) {
  const v = Number(st?.state);
  if (!st || st.state === '' || !Number.isFinite(v)) return null;
  return toKwh100(v, st.attributes?.unit_of_measurement);
}

/** @param {string} id */
export const unitOf = (id) => get(states)[id]?.attributes?.unit_of_measurement ?? '';

const toMs = (t) => (typeof t === 'number' ? (t < 1e11 ? t * 1000 : t) : Date.parse(t));
const BAD = new Set(['unavailable', 'unknown', '', 'none']);

/**
 * @typedef {[number, string]} Pt
 * @typedef {[number, number]} NPt
 */

/** @returns {Pt[]} */
function parse(list) {
  /** @type {Pt[]} */
  const out = [];
  for (const e of list ?? []) {
    const t = toMs(e.lu ?? e.lc ?? e.last_updated ?? e.last_changed);
    const s = e.s ?? e.state;
    if (Number.isFinite(t) && s != null) out.push([t, String(s)]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** @param {Pt[]} pts @returns {NPt[]} */
const nums = (pts) => pts.filter(([, s]) => !BAD.has(s.toLowerCase()) && Number.isFinite(Number(s))).map(([t, s]) => [t, Number(s)]);

/** @param {NPt[]} pts @param {number} k @returns {NPt[]} */
const scale = (pts, k, abs = false) => pts.map(([t, v]) => [t, (abs ? Math.abs(v) : v) * k]);

/** Last value at or before t. @param {NPt[]} pts @param {number} t */
function at(pts, t) {
  let v = null;
  for (const [pt, pv] of pts) {
    if (pt > t) break;
    v = pv;
  }
  return v;
}
/** First value at or after t (and before limit). @param {NPt[]} pts */
function after(pts, t, limit = Infinity) {
  for (const [pt, pv] of pts) if (pt >= t && pt <= limit) return pv;
  return null;
}
/** @param {NPt[]} pts */
const within = (pts, a, b) => pts.filter(([t]) => t >= a && t <= b);

/** Merge [start,end] intervals that overlap or are separated by less than gap ms. */
function merge(/** @type {number[][]} */ list, gap) {
  const sorted = list.filter(([a, b]) => b >= a).sort((x, y) => x[0] - y[0]);
  /** @type {number[][]} */
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a - last[1] < gap) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Intervals where a numeric series is above a threshold; long sample gaps are capped. */
function activeIntervals(/** @type {NPt[]} */ pts, thr, cap, end) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [t, v] = pts[i];
    if (v <= thr) continue;
    const next = pts[i + 1]?.[0] ?? end;
    out.push([t, Math.min(next, t + cap)]);
  }
  return out;
}

/** @param {Pt[]} pts @param {(s:string)=>boolean} on */
function stateIntervals(pts, on, end, cap = 12 * H) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (!on(pts[i][1])) continue;
    const next = pts[i + 1]?.[0] ?? end;
    out.push([pts[i][0], Math.min(next, pts[i][0] + cap)]);
  }
  return out;
}

/**
 * @typedef {[number, number, number]} GeoPt  [time, lat, lon]
 * @typedef {[number, number]} LatLon
 * @typedef {{ id:string, name:string, lat:number, lon:number, radius:number, home:boolean }} Zone
 * @typedef {{ mileage:NPt[], speed:NPt[], soc:NPt[], powerMode:Pt[], poweredOn:Pt[], poweredOff:Pt[], batteryEnergy:NPt[],
 *   tripEff:NPt[], chargingPower:NPt[], chargingSwitch:Pt[], chargingStatus:Pt[], lastChargeEnergy:NPt[], track:GeoPt[], zones:Zone[],
 *   start:number, end:number, capacity:number, effUnit:string, powerUnit:string }} CarHistory
 */

/** GPS positions of the car tracker (needs attributes, so it is a separate request). @returns {Promise<GeoPt[]>} */
async function fetchTrack(start, end) {
  const id = CAR_ENTITIES.location;
  if (!id || !get(states)[id]) return [];
  const raw =
    (await haRequest({
      type: 'history/history_during_period',
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      entity_ids: [id],
      minimal_response: false,
      no_attributes: false,
      significant_changes_only: false,
    })) ?? {};
  /** @type {GeoPt[]} */
  const out = [];
  for (const e of raw[id] ?? []) {
    const a = e.a ?? e.attributes ?? {};
    const lat = Number(a.latitude);
    const lon = Number(a.longitude);
    const t = toMs(e.lu ?? e.lc ?? e.last_updated ?? e.last_changed);
    if (!Number.isFinite(t) || !Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;
    const prev = out[out.length - 1];
    if (prev && prev[1] === lat && prev[2] === lon) continue;
    out.push([t, lat, lon]);
  }
  return out.sort((x, y) => x[0] - y[0]);
}

/** HA zones (home first). @returns {Zone[]} */
export function getZones() {
  const st = get(states);
  return Object.values(st)
    .filter((s) => s.entity_id.startsWith('zone.') && Number.isFinite(Number(s.attributes?.latitude)))
    .map((s) => ({
      id: s.entity_id,
      home: s.entity_id === 'zone.home',
      name: s.entity_id === 'zone.home' ? 'Thuis' : (s.attributes.friendly_name ?? s.entity_id.slice(5)),
      lat: Number(s.attributes.latitude),
      lon: Number(s.attributes.longitude),
      radius: Number(s.attributes.radius) || 100,
    }))
    .sort((a, b) => Number(b.home) - Number(a.home));
}

/** Distance in km between two coordinates. @param {LatLon} a @param {LatLon} b */
export function distKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLon = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
}

/** Zone that contains a position (with a little slack for GPS noise). @param {LatLon|null} p @param {Zone[]} zones */
export function zoneAt(p, zones) {
  if (!p) return null;
  return zones.find((z) => distKm(p, [z.lat, z.lon]) * 1000 <= z.radius + 75) ?? null;
}

/** Last GPS position at or before t. @param {GeoPt[]} track @returns {LatLon|null} */
function posAt(track, t) {
  let p = null;
  for (const g of track) {
    if (g[0] > t) break;
    p = g;
  }
  return p ? [p[1], p[2]] : null;
}

/** @type {{ at:number, p: Promise<CarHistory> } | null} */
let cache = null;

/** Load ~10 days of car history from the HA recorder (cached for a minute). */
export function loadCarHistory(force = false) {
  if (!force && cache && Date.now() - cache.at < 60e3) return cache.p;
  const p = fetchHistory();
  cache = { at: Date.now(), p };
  p.catch(() => (cache = null));
  return p;
}

async function fetchHistory() {
  const end = Date.now();
  const start = end - HISTORY_DAYS * 86400e3;
  const st = get(states);
  const ids = Object.values(IDS).filter((id) => id !== IDS.capacity && st[id]);
  const raw = ids.length
    ? ((await haRequest({
        type: 'history/history_during_period',
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      })) ?? {})
    : {};
  const track = await fetchTrack(start, end).catch(() => []);
  const p = (/** @type {string} */ id) => parse(raw[id]);
  const cap = Number(st[IDS.capacity]?.state);
  const powerUnit = st[IDS.chargingPower]?.attributes?.unit_of_measurement ?? 'kW';
  const pw = powerUnit === 'W' ? 1 / 1000 : 1;
  const kwh = (/** @type {string} */ id) => (st[id]?.attributes?.unit_of_measurement === 'Wh' ? 1 / 1000 : 1);
  return {
    mileage: nums(p(IDS.mileage)),
    speed: nums(p(IDS.speed)),
    soc: nums(p(IDS.soc)),
    powerMode: p(IDS.powerMode),
    poweredOn: p(IDS.poweredOn),
    poweredOff: p(IDS.poweredOff),
    batteryEnergy: scale(nums(p(IDS.batteryEnergy)), kwh(IDS.batteryEnergy)),
    tripEff: nums(p(IDS.tripEff)),
    chargingPower: scale(nums(p(IDS.chargingPower)), pw, true),
    chargingSwitch: p(IDS.chargingSwitch),
    chargingStatus: p(IDS.chargingStatus),
    lastChargeEnergy: scale(nums(p(IDS.lastChargeEnergy)), kwh(IDS.lastChargeEnergy)),
    track,
    zones: getZones(),
    start,
    end,
    capacity: Number.isFinite(cap) && cap > 10 ? cap : CAR_BATTERY_KWH,
    effUnit: st[IDS.tripEff]?.attributes?.unit_of_measurement ?? '',
    powerUnit,
  };
}

/**
 * @typedef {{ start:number, end:number, km:number, kwh:number|null, socBefore:number|null, socAfter:number|null,
 *   maxSpeed:number|null, avgSpeed:number|null, kwh100:number|null, from:LatLon|null, to:LatLon|null, path:LatLon[] }} Ride
 */

const OFF_MODES = new Set(['off', 'unavailable', 'unknown', '', 'none', 'standby', '0', 'false']);

/** Timestamps contained in a timestamp-sensor's history. @param {Pt[]} pts */
const stamps = (pts) => [...new Set(pts.map(([, s]) => Date.parse(s)).filter(Number.isFinite))].sort((a, b) => a - b);

/**
 * Detect rides from power mode, power on/off timestamps, speed and odometer changes.
 * @param {CarHistory} h
 * @returns {Ride[]}
 */
export function detectRides(h) {
  const { end } = h;
  const cand = [];
  cand.push(...stateIntervals(h.powerMode, (s) => !OFF_MODES.has(s.toLowerCase()) && !/^acc/i.test(s), end, 6 * H));
  const offs = stamps(h.poweredOff);
  for (const on of stamps(h.poweredOn)) {
    if (on < h.start - 6 * H) continue;
    const off = offs.find((t) => t > on);
    if (off && off - on < 12 * H) cand.push([on, off]);
  }
  cand.push(...activeIntervals(h.speed, 0, 10 * MIN, end));
  for (let i = 1; i < h.mileage.length; i++) {
    const [t0, v0] = h.mileage[i - 1];
    const [t1, v1] = h.mileage[i];
    const d = v1 - v0;
    if (d <= 0) continue;
    // Polling gaps while parked can be long: estimate the driving window from the distance (~50 km/h).
    const est = Math.max(5 * MIN, (d / 50) * H);
    cand.push([Math.max(t0, t1 - est), t1]);
  }

  const merged = merge(cand, 5 * MIN);
  /** @type {Ride[]} */
  const rides = [];
  for (let i = 0; i < merged.length; i++) {
    const [a, b] = merged[i];
    const bound = Math.min(b + 15 * MIN, merged[i + 1]?.[0] ?? Infinity, end);
    const km0 = at(h.mileage, a) ?? after(h.mileage, a, b);
    const km1 = at(h.mileage, bound);
    let km = km0 != null && km1 != null ? km1 - km0 : null;
    const spd = within(h.speed, a, b);
    if (km == null && spd.length > 1) {
      km = 0;
      for (let j = 1; j < spd.length; j++) km += (spd[j - 1][1] * (spd[j][0] - spd[j - 1][0])) / H;
    }
    if (km == null || km < 0.3) continue;

    const socBefore = at(h.soc, a);
    const socAfter = at(h.soc, bound);
    let kwh = null;
    const e0 = at(h.batteryEnergy, a);
    const e1 = at(h.batteryEnergy, bound);
    if (e0 != null && e1 != null && e0 - e1 > 0) kwh = e0 - e1;
    else if (socBefore != null && socAfter != null && socBefore - socAfter > 0) kwh = ((socBefore - socAfter) / 100) * h.capacity;
    else {
      const eff = toKwh100(after(h.tripEff, a, bound + 30 * MIN), h.effUnit);
      if (eff != null) kwh = (km * eff) / 100;
    }

    const moving = spd.filter(([, v]) => v > 0);
    const maxSpeed = moving.length ? Math.max(...moving.map(([, v]) => v)) : null;
    const hours = (b - a) / H;
    let avgSpeed = hours >= 2 / 60 ? km / hours : null;
    if (moving.length >= 3 && (avgSpeed == null || (maxSpeed != null && avgSpeed > maxSpeed))) {
      avgSpeed = moving.reduce((s, [, v]) => s + v, 0) / moving.length;
    }
    const first = h.track.find((g) => g[0] >= a && g[0] <= bound);
    const from = posAt(h.track, a) ?? (first ? /** @type {LatLon} */ ([first[1], first[2]]) : null);
    const to = posAt(h.track, bound);
    /** @type {LatLon[]} */
    const path = [];
    if (from) path.push(from);
    for (const g of h.track) if (g[0] > a && g[0] <= bound) path.push([g[1], g[2]]);
    rides.push({ start: a, end: b, km, kwh, socBefore, socAfter, maxSpeed, avgSpeed, kwh100: kwh != null ? (kwh / km) * 100 : null, from, to, path });
  }
  return rides.reverse();
}

/**
 * @typedef {{ start:number, end:number, kwh:number|null, source:'auto'|'vermogen'|'soc'|null, maxKw:number|null, avgKw:number|null,
 *   socBefore:number|null, socAfter:number|null, dc:boolean, price:number, cost:number|null, pos:LatLon|null }} Charge
 */

const CHARGING_STATUS = /^(charging|charge|in_progress|fast_charging|laden)/i;

/**
 * Detect charging sessions from the charging switch, charging status and charging power.
 * @param {CarHistory} h
 * @returns {Charge[]}
 */
export function detectCharges(h) {
  const { end } = h;
  const cand = [
    ...stateIntervals(h.chargingSwitch, (s) => s === 'on', end, 24 * H),
    ...stateIntervals(h.chargingStatus, (s) => CHARGING_STATUS.test(s), end, 24 * H),
    ...activeIntervals(h.chargingPower, 0.3, 30 * MIN, end),
  ];
  const merged = merge(cand, 10 * MIN);
  /** @type {Charge[]} */
  const out = [];
  for (let i = 0; i < merged.length; i++) {
    const [a, b] = merged[i];
    if (b - a < 2 * MIN) continue;
    const bound = Math.min(b + 60 * MIN, merged[i + 1]?.[0] ?? Infinity, end);
    const pw = within(h.chargingPower, a, b);
    const pos = pw.filter(([, v]) => v > 0.3);
    const maxKw = pos.length ? Math.max(...pos.map(([, v]) => v)) : null;
    const avgKw = pos.length ? pos.reduce((s, [, v]) => s + v, 0) / pos.length : null;
    const socBefore = at(h.soc, a);
    const socAfter = at(h.soc, bound);

    /** @type {number|null} */
    let kwh = null;
    /** @type {Charge['source']} */
    let source = null;
    const lce = within(h.lastChargeEnergy, a, bound).filter(([, v]) => v > 0);
    if (lce.length) {
      kwh = lce[lce.length - 1][1];
      source = 'auto';
    }
    if (kwh == null && pw.length >= 3) {
      let e = 0;
      const pts = [...pw, [b, pw[pw.length - 1][1]]];
      for (let j = 1; j < pts.length; j++) e += (pts[j - 1][1] * Math.min(pts[j][0] - pts[j - 1][0], 30 * MIN)) / H;
      if (e > 0.1) {
        kwh = e;
        source = 'vermogen';
      }
    }
    if (kwh == null && socBefore != null && socAfter != null && socAfter > socBefore) {
      kwh = ((socAfter - socBefore) / 100) * h.capacity;
      source = 'soc';
    }
    if (kwh == null && maxKw == null) continue;
    const dc = maxKw != null && maxKw > CAR_CHARGE_PRICES.dcThresholdKw;
    const price = dc ? CAR_CHARGE_PRICES.dcPerKwh : CAR_CHARGE_PRICES.acPerKwh;
    out.push({ start: a, end: b, kwh, source, maxKw, avgKw, socBefore, socAfter, dc, price, cost: kwh != null ? kwh * price : null, pos: posAt(h.track, b) ?? posAt(h.track, a) });
  }
  return out.reverse();
}

/** @param {number|null|undefined} v @param {number} [d] */
export const fmt = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d }));

/** "Vandaag", "Gisteren" or "dinsdag 3 juni". @param {number} t */
export function dayLabel(t) {
  const d = new Date(t);
  const now = new Date();
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const same = (/** @type {Date} */ a) => a.getFullYear() === d.getFullYear() && a.getMonth() === d.getMonth() && a.getDate() === d.getDate();
  if (same(now)) return 'Vandaag';
  if (same(y)) return 'Gisteren';
  return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
}
/** @param {number} v */
export const eur = (v) => v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' });

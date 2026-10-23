import { writable } from 'svelte/store';
import { distKm, zoneAt } from './carHistory.js';

/**
 * Human place names for car positions: HA zone name, otherwise a reverse-geocoded
 * town/street from OpenStreetMap Nominatim (cached in localStorage, max 1 request/s).
 * @typedef {{ short:string, long:string }} Place
 */

const KEY = 'thuis.places.v1';
const MAX = 400;
/** @type {Record<string, Place|null>} */
let cache = {};
try {
  cache = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
} catch {}

/** Reactive map of geocoded places by rounded coordinate key. */
export const places = writable(/** @type {Record<string, Place|null>} */ ({ ...cache }));

/** ~100 m grid key. @param {[number, number]} p */
export const placeKey = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

/** @type {string[]} */
const queue = [];
let busy = false;

function persist() {
  const keys = Object.keys(cache);
  if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete cache[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const key = /** @type {string} */ (queue.shift());
    if (key in cache) continue;
    const [lat, lon] = key.split(',');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&accept-language=nl&lat=${lat}&lon=${lon}`);
      if (r.status === 429) break;
      const j = r.ok ? await r.json() : null;
      const a = j?.address ?? {};
      const town = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? a.county ?? '';
      const street = a.road ?? a.pedestrian ?? a.neighbourhood ?? '';
      const name = j?.name && j.name !== street ? j.name : '';
      cache[key] = town || street ? { short: name && j?.category === 'amenity' ? name : town || street, long: [name || street, town].filter(Boolean).join(', ') } : null;
    } catch {
      break;
    }
    persist();
    places.set({ ...cache });
    await new Promise((res) => setTimeout(res, 1100));
  }
  busy = false;
}

/** Request a reverse geocode for a position (no-op if cached or already queued). @param {[number, number]|null} p */
export function want(p) {
  if (!p || typeof fetch === 'undefined') return;
  const key = placeKey(p);
  if (key in cache || queue.includes(key)) return;
  queue.push(key);
  pump();
}

/**
 * Best label for a position.
 * @param {[number, number]|null} p
 * @param {import('./carHistory.js').Zone[]} zones
 * @param {Record<string, Place|null>} known
 * @returns {{ short:string, long:string, zone:import('./carHistory.js').Zone|null }}
 */
export function placeLabel(p, zones, known) {
  if (!p) return { short: 'Onbekend', long: 'Locatie onbekend', zone: null };
  const zone = zoneAt(p, zones);
  if (zone) return { short: zone.name, long: zone.name, zone };
  const g = known[placeKey(p)];
  if (g) return { ...g, zone: null };
  const home = zones.find((z) => z.home);
  const away = home ? `${distKm(p, [home.lat, home.lon]).toLocaleString('nl-BE', { maximumFractionDigits: 0 })} km van thuis` : `${p[0].toFixed(3)}, ${p[1].toFixed(3)}`;
  return { short: away, long: away, zone: null };
}

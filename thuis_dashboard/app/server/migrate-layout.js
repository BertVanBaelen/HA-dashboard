export { defaultLayout } from '../shared/default-layout.js';

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

/** Area that matches a legacy room key or name (case-insensitive). */
export function matchArea(areas, ...keys) {
  const wanted = keys.filter(Boolean).map(norm);
  return areas.find((a) => wanted.includes(norm(a.area_id ?? a.id))) ?? areas.find((a) => wanted.includes(norm(a.name))) ?? null;
}

/** Links unlinked layout rooms to HA areas by id/name. Returns a new layout (marked linked). */
export function linkLayout(layout, areas) {
  if (!layout || layout.linked || !areas?.length) return layout;
  const taken = new Set(layout.rooms.map((r) => r.areaId).filter(Boolean));
  const rooms = layout.rooms.map((r) => {
    if (r.areaId || !r.name) return r;
    const a = matchArea(areas.filter((x) => !taken.has(x.area_id ?? x.id)), r.id, r.name);
    if (!a) return r;
    taken.add(a.area_id ?? a.id);
    return { ...r, areaId: a.area_id ?? a.id };
  });
  return { ...layout, rooms, linked: true };
}

/** Comfort temperatures keyed by legacy room key → keyed by area id. Keys that already are area ids stay. */
export function rekeyComfort(comfort, areas) {
  if (!areas?.length) return comfort;
  const ids = new Set(areas.map((a) => a.area_id ?? a.id));
  const out = {};
  const rest = [];
  for (const [k, v] of Object.entries(comfort ?? {})) ids.has(k) ? (out[k] = v) : rest.push([k, v]);
  for (const [k, v] of rest) {
    const a = matchArea(areas, k);
    const key = a ? a.area_id ?? a.id : k;
    if (!(key in out)) out[key] = v;
  }
  return out;
}

export const LEGACY_COMFORT = { living: 21, slaapkamer: 19, badkamer: 22 };
export const LEGACY_SENSOR_LABELS = {
  'binary_sensor.myggbett_door_window_sensor_door': 'Living raam',
  'binary_sensor.myggbett_door_window_sensor_door_2': 'Badkamerdeur',
};

export const LEGACY_PRESETS = [
  {
    id: 'avond', name: 'Avond', icon: 'weatherSunset',
    lights: {
      'light.uplighter_floor_lamp': { on: true, brightness: 40, rgb: [255, 140, 60] },
      'light.0x00124b001f69cb9d': { on: true, brightness: 30, rgb: [255, 140, 60] },
    },
  },
  {
    id: 'lezen', name: 'Lezen', icon: 'book',
    lights: {
      'light.uplighter_floor_lamp': { on: true, brightness: 70, colorTemp: 4000 },
      'light.0x00124b001f69cb9d': { on: false },
    },
  },
  {
    id: 'nacht', name: 'Nacht', icon: 'weatherNight',
    lights: {
      'light.uplighter_floor_lamp': { on: true, brightness: 5, colorTemp: 2200 },
      'light.0x00124b001f69cb9d': { on: false },
    },
  },
  {
    id: 'uit', name: 'Uit', icon: 'power',
    lights: {
      'light.uplighter_floor_lamp': { on: false },
      'light.0x00124b001f69cb9d': { on: false },
    },
  },
];

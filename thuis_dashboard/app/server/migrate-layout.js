import { matchArea, autoLinkRooms } from '../shared/area-match.js';

export { defaultLayout } from '../shared/default-layout.js';
export { matchArea };

/** Bump to run the automatic linking once more on existing installs (2: also matches "Living" ↔ "Living room"). */
export const LINK_REV = 2;

/** Links unlinked layout rooms to HA areas by id/name. Returns a new layout (marked linked). */
export function linkLayout(layout, areas) {
  if (!layout || (layout.linked && (layout.linkRev ?? 1) >= LINK_REV) || !areas?.length) return layout;
  return { ...layout, rooms: autoLinkRooms(layout.rooms, areas), linked: true, linkRev: LINK_REV };
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

import { ROOMS, MEDIA, DOOR_SENSORS, tvIsOn, stereoIsOn } from '$shared/config.js';
import { lampRgb, brightnessPct } from '../verlichting/color.js';

/** @typedef {{ id: string, name: string, icon: string, rect: number[], climate?: string, lights?: string[], openings?: string[], media?: {kind:string,label:string}[], sensors?: {entity:string,label:string}[], switches?: {entity:string,label:string,icon?:string}[], scripts?: {entity:string,label:string,icon?:string}[] }} PlanRoom */

export const toNum = (/** @type {any} */ v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
export const fmt = (/** @type {number|null} */ v, digits = 1) => (v == null ? '–' : v.toFixed(digits).replace('.', ','));

/** @param {PlanRoom} room */
export const climateRoom = (room) => (room.climate ? ROOMS.find((r) => r.key === room.climate) ?? null : null);

/** Label for a door/window sensor, honouring household overrides. */
export function openingLabel(entity, household) {
  const d = DOOR_SENSORS.find((x) => x.entity === entity);
  return household?.sensorLabels?.[entity] || d?.defaultLabel || entity;
}
export const openingKind = (entity) => DOOR_SENSORS.find((x) => x.entity === entity)?.kind ?? 'window';

const PLAYING = ['playing', 'buffering'];

/**
 * Compact live summary of a floor plan room.
 * @param {PlanRoom} room
 * @param {Record<string, any>} s states
 * @param {any} household
 */
export function summarize(room, s, household) {
  const cr = climateRoom(room);
  const c = cr ? s[cr.climate] : null;
  const a = c?.attributes ?? {};
  const sensorVal = (/** @type {RegExp} */ re) => toNum(s[(room.sensors ?? []).find((x) => re.test(x.entity))?.entity]?.state);
  const temp = toNum(s[cr?.temperature]?.state) ?? toNum(a.current_temperature) ?? sensorVal(/temperature/);
  const humidity = toNum(s[cr?.humidity]?.state) ?? toNum(a.current_humidity) ?? sensorVal(/humidity/);
  const heatPct = toNum(s[cr?.heating]?.state) ?? 0;
  const heating = !!c && c.state !== 'off' && (a.hvac_action === 'heating' || heatPct > 0);

  const lights = (room.lights ?? []).map((id) => s[id]).filter(Boolean);
  const lightsOn = lights.filter((l) => l.state === 'on');
  const lamp = lightsOn[0];
  const lampColor = lamp ? lampRgb(lamp) : null;
  const lampLevel = lightsOn.length ? Math.max(...lightsOn.map((l) => brightnessPct(l))) / 100 : 0;

  const media = room.media ?? [];
  const get = (/** @type {string} */ id) => s[id];
  let mediaOn = false;
  let mediaPlaying = false;
  let mediaKind = /** @type {string|null} */ (null);
  for (const m of media) {
    if (m.kind === 'tv' && tvIsOn(get)) {
      mediaOn = true;
      mediaKind ??= 'tv';
      if (PLAYING.includes(s[MEDIA.chromecast]?.state)) mediaPlaying = true;
    } else if (m.kind === 'stereo' && stereoIsOn(get)) {
      mediaOn = true;
      mediaKind ??= 'stereo';
      if (PLAYING.includes(s[MEDIA.stereo]?.state)) mediaPlaying = true;
    } else if (m.kind === 'soundbar' && s[MEDIA.soundbarOn]?.state === 'on') {
      mediaOn = true;
          mediaKind ??= 'soundbar';
    }
  }

  const openings = (room.openings ?? []).map((id) => ({ entity: id, label: openingLabel(id, household), kind: openingKind(id), open: s[id]?.state === 'on' }));
  const tadoWindow = cr ? s[cr.window]?.state === 'on' || a.hvac_action === 'window_open' : false;
  const open = openings.filter((o) => o.open);
  const switchesOn = (room.switches ?? []).filter((x) => s[x.entity]?.state === 'on').length;

  const deviceCount =
    (cr ? 1 : 0) + lights.length + media.length + (room.sensors?.length ?? 0) + openings.length + (room.switches?.length ?? 0) + (room.scripts?.length ?? 0);

  return {
    hasClimate: !!cr,
    hvacMode: c?.state ?? null,
    target: toNum(a.temperature),
    temp, humidity, heatPct, heating,
    lightCount: (room.lights ?? []).length,
    lightsOn: lightsOn.length, lampColor, lampLevel,
    hasMedia: media.length > 0, mediaOn, mediaPlaying, mediaKind,
    openings, openCount: open.length + (tadoWindow && !open.length ? 1 : 0),
    openKind: open[0]?.kind ?? 'window',
    switchesOn,
    deviceCount,
  };
}

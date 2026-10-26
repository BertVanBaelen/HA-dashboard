import { MEDIA, EXCLUDED_ENTITY_PATTERNS, HIDE_LABEL } from './config.js';

const OPENING_CLASSES = ['door', 'window', 'opening', 'garage_door'];
const SENSOR_CLASSES = ['temperature', 'humidity'];
const CLIMATE_HELPERS = [
  ['temperature', 'sensor', '_temperature'],
  ['humidity', 'sensor', '_humidity'],
  ['heating', 'sensor', '_heating'],
  ['tadoMode', 'sensor', '_tado_mode'],
  ['window', 'binary_sensor', '_window'],
  ['earlyStart', 'binary_sensor', '_early_start'],
  ['overlay', 'binary_sensor', '_overlay'],
];
const MEDIA_KINDS = [
  { kind: 'tv', label: 'TV / Chromecast', entities: [MEDIA.tvPower, MEDIA.chromecast, MEDIA.chromecastRemote] },
  { kind: 'stereo', label: 'Stereo', entities: [MEDIA.stereo] },
  { kind: 'soundbar', label: 'Soundbar', entities: [MEDIA.soundbarOn] },
];

export const emptyRoom = () => ({ lights: [], switches: [], scripts: [], sensors: [], openings: [], climate: null, media: [] });
export const emptyTopology = () => ({ areas: [], rooms: {}, unassigned: emptyRoom() });

const domainOf = (id) => id.split('.')[0];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function stripArea(name, areaName) {
  if (!areaName) return name;
  const rest = name.replace(new RegExp(`^${esc(areaName)}[\\s_\\-–:]+`, 'i'), '').trim();
  return rest ? rest[0].toUpperCase() + rest.slice(1) : name;
}

function guessIcon(domain, id, name) {
  const t = `${id} ${name}`.toLowerCase();
  if (/ventilat|\bfan\b|_fan/.test(t)) return 'fan';
  if (/wekker|alarm/.test(t)) return 'alarm';
  if (/verwarm|heat|radiator/.test(t)) return 'heat';
  return domain === 'script' ? 'script' : 'socket';
}

/**
 * Builds the room topology from the HA registries and current states.
 * @param {{ areas?: any[], devices?: any[], entities?: any[], labels?: any[], states?: Map<string, any> | Record<string, any> }} input
 */
export function buildTopology({ areas = [], devices = [], entities = [], labels = [], states = new Map() } = {}) {
  const stateMap = states instanceof Map ? states : new Map(Object.entries(states ?? {}));
  const hideIds = new Set([HIDE_LABEL, ...labels.filter((l) => String(l.name ?? '').toLowerCase() === HIDE_LABEL).map((l) => l.label_id)]);
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const regById = new Map(entities.map((e) => [e.entity_id, e]));
  const areaById = new Map(areas.map((a) => [a.area_id, a]));
  const ids = new Set([...stateMap.keys(), ...entities.map((e) => e.entity_id)]);

  const visible = (id) => {
    if (EXCLUDED_ENTITY_PATTERNS.some((re) => re.test(id))) return false;
    const r = regById.get(id);
    if (!r) return stateMap.has(id);
    if (r.disabled_by || r.hidden_by || r.entity_category) return false;
    if ((r.labels ?? []).some((l) => hideIds.has(l))) return false;
    const dev = r.device_id ? deviceById.get(r.device_id) : null;
    if (dev?.disabled_by) return false;
    return true;
  };
  const areaOf = (id) => {
    const r = regById.get(id);
    if (!r) return null;
    const a = r.area_id ?? deviceById.get(r.device_id)?.area_id ?? null;
    return a && areaById.has(a) ? a : null;
  };
  const deviceOf = (id) => regById.get(id)?.device_id ?? null;
  const deviceClass = (id) => stateMap.get(id)?.attributes?.device_class ?? regById.get(id)?.device_class ?? regById.get(id)?.original_device_class ?? null;
  const rawName = (id) => {
    const r = regById.get(id);
    return String(stateMap.get(id)?.attributes?.friendly_name ?? r?.name ?? r?.original_name ?? id.split('.')[1].replace(/_/g, ' '));
  };
  const nameOf = (id, areaId) => stripArea(rawName(id), areaId ? areaById.get(areaId)?.name : null);

  const byDevice = new Map();
  for (const id of ids) {
    const dev = deviceOf(id);
    if (!dev) continue;
    if (!byDevice.has(dev)) byDevice.set(dev, []);
    byDevice.get(dev).push(id);
  }
  const siblings = (id) => (deviceOf(id) ? byDevice.get(deviceOf(id)) ?? [] : []);

  const rooms = Object.fromEntries(areas.map((a) => [a.area_id, emptyRoom()]));
  const unassigned = emptyRoom();
  const roomFor = (areaId) => (areaId ? rooms[areaId] : unassigned);

  const climateDevices = new Set();
  const used = new Set();
  for (const id of [...ids].filter((x) => domainOf(x) === 'climate' && visible(x)).sort()) {
    const areaId = areaOf(id);
    const c = { entity: id };
    const sib = siblings(id);
    if (deviceOf(id)) climateDevices.add(deviceOf(id));
    for (const [key, domain, suffix] of CLIMATE_HELPERS) {
      const hit = sib.find((x) => domainOf(x) === domain && x.endsWith(suffix) && !used.has(x));
      c[key] = hit ?? null;
      if (hit) used.add(hit);
    }
    if (areaId && !rooms[areaId].climate) rooms[areaId].climate = c;
  }

  for (const id of [...ids].sort()) {
    if (used.has(id) || !visible(id)) continue;
    const domain = domainOf(id);
    const areaId = areaOf(id);
    const room = roomFor(areaId);
    if (domain === 'light') {
      const scene = siblings(id).find((x) => domainOf(x) === 'select' && x.endsWith('_scene') && !regById.get(x)?.disabled_by) ?? null;
      room.lights.push({ entity: id, name: nameOf(id, areaId), sceneSelect: scene });
    } else if (domain === 'switch' || domain === 'script') {
      const name = nameOf(id, areaId);
      room[domain === 'switch' ? 'switches' : 'scripts'].push({ entity: id, name, icon: guessIcon(domain, id, name) });
    } else if (domain === 'binary_sensor' && OPENING_CLASSES.includes(deviceClass(id))) {
      const battery = siblings(id).find((x) => domainOf(x) === 'sensor' && deviceClass(x) === 'battery') ?? null;
      room.openings.push({ entity: id, name: nameOf(id, areaId), kind: deviceClass(id) === 'window' ? 'window' : 'door', battery });
    } else if (domain === 'sensor' && SENSOR_CLASSES.includes(deviceClass(id)) && !climateDevices.has(deviceOf(id))) {
      room.sensors.push({ entity: id, name: nameOf(id, areaId), kind: deviceClass(id) });
    }
  }

  for (const m of MEDIA_KINDS) {
    const areaId = m.entities.map((id) => (id && visible(id) ? areaOf(id) : null)).find(Boolean);
    if (areaId) rooms[areaId].media.push({ kind: m.kind, label: m.label });
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  for (const r of [...Object.values(rooms), unassigned]) for (const k of ['lights', 'switches', 'scripts', 'sensors', 'openings']) r[k].sort(byName);

  return {
    areas: areas.map((a) => ({ id: a.area_id, name: a.name, icon: a.icon ?? null, floorId: a.floor_id ?? null })).sort(byName),
    rooms,
    unassigned,
  };
}

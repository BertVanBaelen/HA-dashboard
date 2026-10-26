const NO_ROOM = 'Zonder ruimte';

/** @typedef {{ key: string, name: string, climate: string, temperature: string|null, humidity: string|null, heating: string|null, tadoMode: string|null, window: string|null, earlyStart: string|null, overlay: string|null }} ClimateRoom */

/** @returns {ClimateRoom|null} */
export function climateOf(topology, areaId) {
  const c = topology?.rooms?.[areaId]?.climate;
  if (!c) return null;
  const { entity, ...rest } = c;
  return { key: areaId, name: areaName(topology, areaId), climate: entity, ...rest };
}

export const areaName = (topology, areaId) => topology?.areas?.find((a) => a.id === areaId)?.name ?? areaId ?? NO_ROOM;

/** Areas in name order, each with its room contents; unassigned last (only when it has items of `key`). */
export function roomEntries(topology, key = null) {
  const out = (topology?.areas ?? []).map((a) => ({ areaId: a.id, name: a.name, room: topology.rooms[a.id] }));
  const u = topology?.unassigned;
  if (u && (!key || u[key]?.length)) out.push({ areaId: null, name: NO_ROOM, room: u });
  return out.filter((e) => e.room);
}

export const allLights = (topology) =>
  roomEntries(topology).flatMap((e) => e.room.lights.map((l) => ({ ...l, room: e.name, areaId: e.areaId })));

export const allClimates = (topology) => (topology?.areas ?? []).map((a) => climateOf(topology, a.id)).filter(Boolean);

export const allOpenings = (topology) =>
  roomEntries(topology).flatMap((e) => e.room.openings.map((o) => ({ ...o, room: e.name, areaId: e.areaId })));

/** Label of a door/window sensor, honouring household overrides. */
export const openingLabel = (o, household) => household?.sensorLabels?.[o.entity] || o.name || o.entity;

/** Merges the stored layout and the HA topology into floor plan rooms. */
export function planRooms(layout, topology) {
  const toPlan = (base, areaId) => {
    const r = areaId ? topology?.rooms?.[areaId] : null;
    return {
      ...base,
      areaId,
      name: areaId ? areaName(topology, areaId) : base.name,
      climate: areaId ? climateOf(topology, areaId) : null,
      lights: (r?.lights ?? []).map((l) => l.entity),
      lightItems: (r?.lights ?? []).map((l) => ({ ...l, room: areaName(topology, areaId) })),
      openings: r?.openings ?? [],
      media: r?.media ?? [],
      sensors: (r?.sensors ?? []).map((x) => ({ entity: x.entity, label: x.name })),
      switches: (r?.switches ?? []).map((x) => ({ entity: x.entity, label: x.name, icon: x.icon })),
      scripts: (r?.scripts ?? []).map((x) => ({ entity: x.entity, label: x.name, icon: x.icon })),
    };
  };
  const known = new Set((topology?.areas ?? []).map((a) => a.id));
  const placed = (layout?.rooms ?? []).map((r) => toPlan(r, r.areaId && known.has(r.areaId) ? r.areaId : null));
  const onPlan = new Set(placed.map((r) => r.areaId).filter(Boolean));
  const unplaced = (topology?.areas ?? [])
    .filter((a) => !onPlan.has(a.id))
    .map((a) => toPlan({ id: `area:${a.id}`, name: a.name, icon: 'home', rect: null, floor: 'plain', furniture: null }, a.id));
  return { placed, unplaced };
}

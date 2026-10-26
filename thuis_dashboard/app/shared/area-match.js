// Matching floor plan rooms to Home Assistant areas by id/name.

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const words = (s) => norm(s).split(' ').filter(Boolean);
const areaId = (a) => a.area_id ?? a.id;

/**
 * Area matching any of the given keys (room id / name): exact id, exact name,
 * then a unique area whose id or name contains all words of a key (e.g. "Living" ↔ "Living room").
 * @param {{ id?: string, area_id?: string, name: string }[]} areas
 * @param {...(string|null|undefined)} keys
 */
export function matchArea(areas, ...keys) {
  const wanted = keys.filter(Boolean).map(norm).filter(Boolean);
  if (!wanted.length) return null;
  const exact = areas.find((a) => wanted.includes(norm(areaId(a)))) ?? areas.find((a) => wanted.includes(norm(a.name)));
  if (exact) return exact;
  const contains = (hay, key) => {
    const w = words(hay);
    return words(key).every((k) => w.includes(k)) || w.every((k) => words(key).includes(k));
  };
  const loose = areas.filter((a) => wanted.some((k) => contains(a.name, k) || contains(areaId(a), k)));
  return loose.length === 1 ? loose[0] : null;
}

/**
 * Links rooms without an area to free areas. Rooms without a name (drawing only) are skipped.
 * @template {{ id?: any, name?: any, areaId?: any }} R
 * @param {R[]} rooms
 * @param {{ id?: string, area_id?: string, name: string }[]} areas
 * @returns {R[]} new array, unchanged rooms keep their identity
 */
export function autoLinkRooms(rooms, areas) {
  const taken = new Set(rooms.map((r) => r.areaId).filter(Boolean));
  return rooms.map((r) => {
    if (r.areaId || !r.name) return r;
    const a = matchArea(areas.filter((x) => !taken.has(areaId(x))), r.id, r.name);
    if (!a) return r;
    taken.add(areaId(a));
    return { ...r, areaId: areaId(a) };
  });
}

import { FLOOR_TYPES } from './config.js';

export const ROOM_ICON_KEYS = ['home', 'sofa', 'bed', 'kitchen', 'shower', 'toilet', 'hall', 'stair', 'storage', 'terrace', 'mistique', 'desk', 'dining', 'kids', 'laundry', 'garage', 'garden'];
export const FURNITURE_KEYS = ['terrace', 'mistique', 'bedroom', 'storage', 'bathroom', 'kitchen', 'living'];
export const MAX_ROOMS = 50;
const MAX_ITEMS = 100;
const ID_RE = /^[\w-]{1,40}$/;

class LayoutError extends Error {}
const fail = (msg) => {
  throw new LayoutError(msg);
};
const num = (v, what) => {
  const n = Number(v);
  if (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) fail(`${what}: ongeldig getal`);
  return Math.round(n * 10) / 10;
};
const oneOf = (v, list, what) => (list.includes(v) ? v : fail(`${what}: onbekende waarde "${v}"`));

/** Gap in the wall and the swing arc of a door. */
export function doorGeometry(d) {
  const t = d.thick ?? 6;
  const s = d.size;
  const start = d.hinge !== 'end';
  const inward = d.swing !== 'out';
  if (d.wall === 'v') {
    const gap = [d.x, d.y, t, s];
    if (d.swing === 'none') return { gap, path: null };
    const e = inward ? d.x + t - 1 : d.x + 1;
    const [hy, oy] = start ? [d.y, d.y + s] : [d.y + s, d.y];
    return { gap, path: `M${e} ${hy} h${inward ? s : -s} A${s} ${s} 0 0 ${start === inward ? 1 : 0} ${e} ${oy}` };
  }
  const gap = [d.x, d.y, s, t];
  if (d.swing === 'none') return { gap, path: null };
  const e = inward ? d.y + t - 1 : d.y + 1;
  const [hx, ox] = start ? [d.x, d.x + s] : [d.x + s, d.x];
  return { gap, path: `M${hx} ${e} v${inward ? s : -s} A${s} ${s} 0 0 ${start === inward ? 0 : 1} ${ox} ${e}` };
}

/** Outer wall: bounding box of all indoor rooms plus the wall thickness. */
export function shellRect(rooms, wall = 6) {
  const inside = rooms.filter((r) => r.floor !== 'deck');
  if (!inside.length) return null;
  const x0 = Math.min(...inside.map((r) => r.rect[0])) - wall;
  const y0 = Math.min(...inside.map((r) => r.rect[1])) - wall;
  const x1 = Math.max(...inside.map((r) => r.rect[0] + r.rect[2])) + wall;
  const y1 = Math.max(...inside.map((r) => r.rect[1] + r.rect[3])) + wall;
  return [x0, y0, x1 - x0, y1 - y0];
}

export const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** Pairs of room ids whose rectangles overlap (warning only). */
export function overlappingRooms(layout) {
  const out = [];
  const rs = layout?.rooms ?? [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (overlaps(rs[i].rect, rs[j].rect)) out.push([rs[i].id, rs[j].id]);
  return out;
}

/**
 * Validates and normalizes a floor plan layout. Throws an Error with a Dutch message when invalid.
 * @param {any} input
 */
export function validateLayout(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Plattegrond ontbreekt');
  const vb = input.viewBox;
  if (!Array.isArray(vb) || vb.length !== 4) fail('Plangrootte ontbreekt');
  const [vx, vy, vw, vh] = vb.map((v, i) => num(v, 'Plangrootte'));
  if (vw < 50 || vh < 50 || vw > 2000 || vh > 2000) fail('Plangrootte moet tussen 50 en 2000 liggen');
  const inX = (x, what) => (x < vx - 0.01 || x > vx + vw + 0.01 ? fail(`${what} ligt buiten het plan`) : x);
  const inY = (y, what) => (y < vy - 0.01 || y > vy + vh + 0.01 ? fail(`${what} ligt buiten het plan`) : y);
  const rect = (r, what, min = 2) => {
    if (!Array.isArray(r) || r.length !== 4) fail(`${what}: ongeldige rechthoek`);
    const [x, y, w, h] = r.map((v) => num(v, what));
    if (w < min || h < min) fail(`${what} is te klein`);
    inX(x, what), inY(y, what), inX(x + w, what), inY(y + h, what);
    return [x, y, w, h];
  };
  const ids = new Set();
  const id = (v, what) => {
    const s = String(v ?? '');
    if (!ID_RE.test(s)) fail(`${what}: ongeldige id`);
    if (ids.has(s)) fail(`${what}: id "${s}" komt dubbel voor`);
    ids.add(s);
    return s;
  };
  const list = (v, max, what) => {
    if (v == null) return [];
    if (!Array.isArray(v)) fail(`${what}: geen lijst`);
    if (v.length > max) fail(`Maximaal ${max} ${what.toLowerCase()}`);
    return v;
  };

  const floors = FLOOR_TYPES.map((f) => f.key);
  const areaIds = new Set();
  const rooms = list(input.rooms, MAX_ROOMS, 'Ruimtes').map((r, i) => {
    const what = `Ruimte ${r?.name || i + 1}`;
    if (!r || typeof r !== 'object') fail(`${what}: ongeldig`);
    const areaId = r.areaId == null || r.areaId === '' ? null : String(r.areaId);
    if (areaId && (areaId.length > 100 || areaIds.has(areaId))) fail(`${what}: ruimte uit Home Assistant staat er dubbel op`);
    if (areaId) areaIds.add(areaId);
    const name = String(r.name ?? '').trim();
    if (name.length > 40) fail(`${what}: naam is te lang`);
    return {
      id: id(r.id, what),
      areaId,
      name,
      icon: oneOf(r.icon ?? 'home', ROOM_ICON_KEYS, `${what} – icoon`),
      rect: rect(r.rect, what, 4),
      floor: oneOf(r.floor ?? 'plain', floors, `${what} – vloer`),
      furniture: r.furniture ? oneOf(r.furniture, FURNITURE_KEYS, `${what} – meubels`) : null,
    };
  });
  const doors = list(input.doors, MAX_ITEMS, 'Deuren').map((d, i) => {
    const what = `Deur ${i + 1}`;
    if (!d || typeof d !== 'object') fail(`${what}: ongeldig`);
    const out = {
      id: id(d.id, what),
      x: inX(num(d.x, what), what),
      y: inY(num(d.y, what), what),
      wall: oneOf(d.wall, ['h', 'v'], `${what} – muur`),
      size: num(d.size, what),
      thick: d.thick == null ? 6 : num(d.thick, what),
      swing: oneOf(d.swing ?? 'in', ['in', 'out', 'none'], `${what} – draairichting`),
      hinge: oneOf(d.hinge ?? 'start', ['start', 'end'], `${what} – scharnier`),
    };
    if (out.size < 4 || out.size > 120) fail(`${what}: breedte moet tussen 4 en 120 liggen`);
    if (out.thick < 2 || out.thick > 16) fail(`${what}: dikte moet tussen 2 en 16 liggen`);
    return out;
  });
  const windows = list(input.windows, MAX_ITEMS, 'Ramen').map((w, i) => ({ id: id(w?.id, `Raam ${i + 1}`), rect: rect(w?.rect, `Raam ${i + 1}`) }));
  const decor = list(input.decor, MAX_ITEMS, 'Decoratie').map((d, i) => {
    const what = `Decoratie ${i + 1}`;
    const out = { id: id(d?.id, what), kind: oneOf(d?.kind, ['plant', 'rail'], what), x: inX(num(d?.x, what), what), y: inY(num(d?.y, what), what) };
    if (out.kind === 'rail') out.w = num(d.w ?? 20, what);
    return out;
  });
  return { version: 1, linked: true, viewBox: [vx, vy, vw, vh], rooms, doors, windows, decor };
}

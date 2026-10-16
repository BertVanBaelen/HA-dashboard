import { fmtTime, fmtDate, isSameDay, startOfDay } from '../../lib/format.js';

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function weekStart(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const lastMoment = (e) => (e.end > e.start ? new Date(e.end.getTime() - 1) : e.start);

/** Map dayKey → events overlapping that day, limited to [from, to). */
export function groupByDay(events, from, to) {
  const m = new Map();
  for (const e of events) {
    const last = lastMoment(e);
    for (let d = startOfDay(e.start < from ? from : e.start); d <= last && d < to; d = addDays(d, 1)) {
      const k = dayKey(d);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
  }
  return m;
}

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function dayLabel(d) {
  const today = startOfDay();
  if (isSameDay(d, today)) return 'Vandaag';
  if (isSameDay(d, addDays(today, 1))) return 'Morgen';
  if (isSameDay(d, addDays(today, -1))) return 'Gisteren';
  return cap(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function fmtRange(e) {
  const last = lastMoment(e);
  const long = { weekday: 'short', day: 'numeric', month: 'short' };
  if (e.allDay) {
    if (isSameDay(e.start, last)) return `${cap(fmtDate(e.start, long))} · hele dag`;
    return `${cap(fmtDate(e.start, long))} – ${fmtDate(last, long)} · hele dag`;
  }
  if (isSameDay(e.start, last)) return `${cap(fmtDate(e.start, long))} · ${fmtTime(e.start)} – ${fmtTime(e.end)}`;
  return `${cap(fmtDate(e.start, long))} ${fmtTime(e.start)} – ${fmtDate(e.end, long)} ${fmtTime(e.end)}`;
}

/** Horizontal swipe detection (touch); the element should carry class no-swipe. */
export function swipe(node, opts) {
  let o = opts;
  let s = null;
  const start = (e) => {
    const t = e.touches[0];
    s = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const end = (e) => {
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.t < 800) (dx < 0 ? o.onleft : o.onright)?.();
    s = null;
  };
  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('touchend', end, { passive: true });
  return {
    update: (n) => (o = n),
    destroy() {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchend', end);
    },
  };
}

const nl = 'nl-BE';

export const fmtTime = (d) => new Date(d).toLocaleTimeString(nl, { hour: '2-digit', minute: '2-digit' });
/** @type {(d: any, opts?: any) => string} */
export const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(d).toLocaleDateString(nl, opts);
export const fmtDay = (d) => new Date(d).toLocaleDateString(nl, { weekday: 'short' }).replace('.', '');
export const fmtDateTime = (d) => `${fmtDate(d)} ${fmtTime(d)}`;

export function isSameDay(a, b) {
  a = new Date(a); b = new Date(b);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** "zojuist", "5 min geleden", "2 u geleden", "3 d geleden" */
export function relTime(d) {
  if (!d) return '–';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const fut = diff < 0;
  const s = Math.abs(diff);
  let t;
  if (s < 45) return 'zojuist';
  if (s < 3600) t = `${Math.round(s / 60)} min`;
  else if (s < 86400) t = `${Math.round(s / 3600)} u`;
  else t = `${Math.round(s / 86400)} d`;
  return fut ? `over ${t}` : `${t} geleden`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

export const fmtNum = (n, digits = 1) => (Number.isFinite(Number(n)) ? Number(n).toFixed(digits).replace('.', ',') : '–');

/** Minutes → "1 u 35 min" */
export function fmtDuration(min) {
  min = Math.round(Number(min));
  if (!Number.isFinite(min)) return '–';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} u ${m.toString().padStart(2, '0')} min` : `${m} min`;
}

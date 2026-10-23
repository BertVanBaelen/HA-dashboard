import { actionQuiet, prefs, savePrefs } from '../../lib/api.js';

// Swiped-away ids are applied locally at once and saved to the server in one batch shortly after.
let saveTimer = 0;
function flush() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = 0;
  savePrefs({}).catch(() => {});
}
addEventListener('pagehide', flush);

function updateDismissed(fn) {
  prefs.update((p) => ({ ...p, news: { ...p.news, dismissed: fn({ ...p.news.dismissed }) } }));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1200);
}

export const dismiss = (/** @type {string[]} */ ids) =>
  updateDismissed((d) => {
    const now = Math.round(Date.now() / 1000);
    for (const id of ids) d[id] = now;
    return d;
  });

export const undismiss = (/** @type {string[]} */ ids) =>
  updateDismissed((d) => {
    for (const id of ids) delete d[id];
    return d;
  });

/** Full article bodies, cached per item for this page load. Failed loads are retried after a minute. */
const bodies = new Map();
export function loadBody(/** @type {string} */ id) {
  if (!bodies.has(id)) {
    const p = actionQuiet('news', { op: 'article', id }).catch((err) => ({ readable: false, blocks: [], error: err.message }));
    bodies.set(id, p);
    p.then((r) => r.error && setTimeout(() => bodies.delete(id), 60e3));
  }
  return bodies.get(id);
}

/**
 * Svelte action: fire `fn` on press and keep repeating while held.
 * @param {HTMLElement} node
 * @param {{ fn: () => void, repeat?: boolean, delay?: number, interval?: number }} opts
 */
export function hold(node, opts) {
  let o = opts;
  let t1 = 0;
  let t2 = 0;
  const stop = () => {
    clearTimeout(t1);
    clearInterval(t2);
    node.classList.remove('held');
  };
  const down = (/** @type {PointerEvent} */ e) => {
    if (e.button !== 0 || /** @type {HTMLButtonElement} */ (node).disabled) return;
    e.preventDefault();
    stop();
    node.classList.add('held');
    buzz();
    o.fn();
    if (o.repeat === false) return;
    t1 = setTimeout(() => {
      t2 = setInterval(() => o.fn(), o.interval ?? 180);
    }, o.delay ?? 450);
  };
  const key = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      o.fn();
    }
  };
  const noMenu = (/** @type {Event} */ e) => e.preventDefault();
  const ends = ['pointerup', 'pointerleave', 'pointercancel', 'blur'];
  node.addEventListener('pointerdown', down);
  node.addEventListener('keydown', key);
  node.addEventListener('contextmenu', noMenu);
  ends.forEach((ev) => node.addEventListener(ev, stop));
  return {
    update(/** @type {typeof opts} */ n) {
      o = n;
    },
    destroy() {
      stop();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('keydown', key);
      node.removeEventListener('contextmenu', noMenu);
      ends.forEach((ev) => node.removeEventListener(ev, stop));
    },
  };
}

export function buzz(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

/** Only absolute http(s) artwork can be loaded through ingress; HA-relative paths fall back. */
export function artworkUrl(s) {
  const pic = s?.attributes?.entity_picture;
  return typeof pic === 'string' && /^https?:\/\//.test(pic) ? pic : null;
}

export const OFF_STATES = ['off', 'unavailable', 'unknown', 'standby'];

/**
 * Svelte action: a tap fires `fn` on release; holding fires and keeps repeating.
 * Scroll-friendly: the press is cancelled when the finger moves or the browser starts scrolling
 * (pointercancel). Use with `touch-action: manipulation` so the page can still scroll over it.
 * @param {HTMLElement} node
 * @param {{ fn: () => void, repeat?: boolean, delay?: number, interval?: number }} opts
 */
export function hold(node, opts) {
  let o = opts;
  let t1 = 0;
  let t2 = 0;
  let active = false;
  let fired = false;
  let x0 = 0;
  let y0 = 0;
  const stop = () => {
    active = false;
    clearTimeout(t1);
    clearInterval(t2);
    node.classList.remove('held');
  };
  const fire = () => {
    fired = true;
    buzz();
    o.fn();
  };
  const down = (/** @type {PointerEvent} */ e) => {
    if (e.button !== 0 || /** @type {HTMLButtonElement} */ (node).disabled) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    stop();
    active = true;
    fired = false;
    x0 = e.clientX;
    y0 = e.clientY;
    node.classList.add('held');
    t1 = setTimeout(() => {
      if (!active) return;
      fire();
      if (o.repeat !== false) t2 = setInterval(() => o.fn(), o.interval ?? 180);
    }, o.delay ?? 450);
  };
  const move = (/** @type {PointerEvent} */ e) => {
    if (active && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) stop();
  };
  const up = () => {
    if (active && !fired) fire();
    stop();
  };
  const key = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      o.fn();
    }
  };
  const noMenu = (/** @type {Event} */ e) => e.preventDefault();
  const cancels = ['pointerleave', 'pointercancel', 'blur'];
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('keydown', key);
  node.addEventListener('contextmenu', noMenu);
  cancels.forEach((ev) => node.addEventListener(ev, stop));
  return {
    update(/** @type {typeof opts} */ n) {
      o = n;
    },
    destroy() {
      stop();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('keydown', key);
      node.removeEventListener('contextmenu', noMenu);
      cancels.forEach((ev) => node.removeEventListener(ev, stop));
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

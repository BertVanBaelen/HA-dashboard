import { writable, derived, get } from 'svelte/store';

/** @typedef {{entity_id:string,state:string,attributes:Record<string,any>,last_changed:string,last_updated:string}} HassEntity */

export const connection = writable(/** @type {'connecting'|'open'|'closed'} */ ('connecting'));
export const haConnected = writable(true);
export const ready = writable(false);
export const isMock = writable(false);
/** @type {import('svelte/store').Writable<Record<string, HassEntity>>} */
export const states = writable({});
export const user = writable(/** @type {{id:string,name:string,displayName:string,person:string|null}|null} */ (null));
export const prefs = writable(/** @type {any} */ (null));
export const household = writable(/** @type {any} */ (null));
export const toasts = writable(/** @type {{id:number,text:string,kind:string}[]} */ ([]));

let ws;
let seq = 1;
const pending = new Map();
let retry = 500;
const listeners = new Set();

function wsUrl() {
  const u = new URL(location.href);
  if (!u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/[^/]*$/, '/');
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname += 'ws';
  u.hash = '';
  return u.toString();
}

export function connect() {
  connection.set('connecting');
  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    connection.set('open');
    retry = 500;
  };
  ws.onclose = () => {
    connection.set('closed');
    for (const [, p] of pending) p.reject(new Error('Verbinding verbroken'));
    pending.clear();
    setTimeout(connect, retry);
    retry = Math.min(retry * 2, 10000);
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    switch (msg.type) {
      case 'init':
        user.set(msg.user);
        prefs.set(msg.prefs);
        household.set(msg.household);
        states.set(msg.states);
        haConnected.set(msg.haConnected);
        isMock.set(!!msg.mock);
        ready.set(true);
        break;
      case 'states':
        states.update((s) => {
          const next = { ...s };
          for (const [id, st] of Object.entries(msg.changes)) {
            if (st) next[id] = st;
            else delete next[id];
          }
          return next;
        });
        for (const l of listeners) l(msg.changes);
        break;
      case 'state_reset':
        states.set(msg.states);
        break;
      case 'ha':
        haConnected.set(msg.connected);
        break;
      case 'prefs':
        prefs.set(msg.prefs);
        break;
      case 'household':
        household.set(msg.household);
        break;
      case 'result': {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error));
        break;
      }
    }
  };
}

function request(payload, timeout = 70000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('Geen verbinding'));
    const id = seq++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Time-out'));
    }, timeout);
    pending.set(id, {
      resolve: (v) => (clearTimeout(timer), resolve(v)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    });
    ws.send(JSON.stringify({ ...payload, id }));
  });
}

/** Subscribe to raw state change batches: cb(changes: Record<id, state|null>). */
export function onStateChanges(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---- Toasts --------------------------------------------------------------

let toastId = 1;
export function toast(text, kind = 'info', ms = 3200) {
  const id = toastId++;
  toasts.update((t) => [...t, { id, text, kind }]);
  setTimeout(() => toasts.update((t) => t.filter((x) => x.id !== id)), ms);
}

async function withToast(promise, okText) {
  try {
    const r = await promise;
    if (okText) toast(okText, 'ok');
    return r;
  } catch (err) {
    toast(err.message ?? String(err), 'error', 5000);
    throw err;
  }
}

// ---- HA calls ------------------------------------------------------------

/**
 * Call a HA service. `target` is an entity id string, an array, or a target object.
 * Errors are shown as a toast and re-thrown.
 */
export function callService(domain, service, data = {}, target, okText) {
  const t = typeof target === 'string' || Array.isArray(target) ? { entity_id: target } : target;
  return withToast(request({ type: 'call_service', domain, service, data, target: t }, domain === 'update' ? 30 * 60e3 : 70000), okText);
}

/** Call a service that returns data (e.g. weather.get_forecasts). No toast on error. */
export function callServiceResponse(domain, service, data = {}, target) {
  const t = typeof target === 'string' || Array.isArray(target) ? { entity_id: target } : target;
  return request({ type: 'call_service', domain, service, data, target: t, return_response: true });
}

/** Raw HA websocket command (history, statistics, todo/item/list). */
export function haRequest(msg) {
  return request({ type: 'ws', msg });
}

/** Run a backend composite action (allesUit, mediaMode, applyPreset, ...). */
export function action(name, args = {}, okText) {
  return withToast(request({ type: 'action', name, args }), okText);
}

export function savePrefs(patch) {
  const next = { ...get(prefs), ...patch };
  prefs.set(next);
  return withToast(request({ type: 'set_prefs', prefs: next }));
}

export function saveHousehold(patch) {
  const next = { ...get(household), ...patch };
  household.set(next);
  return withToast(request({ type: 'set_household', household: next }));
}

// ---- Helpers -------------------------------------------------------------

/** Derived store for a single entity. */
export function entity(id) {
  return derived(states, ($s) => $s[id] ?? null);
}

export const isOn = (s) => s?.state === 'on';
export const unavailable = (s) => !s || s.state === 'unavailable' || s.state === 'unknown';
export const num = (s, digits = 1) => {
  const n = Number(s?.state);
  return Number.isFinite(n) ? n.toFixed(digits).replace('.', ',') : '–';
};
export const attr = (s, key) => s?.attributes?.[key];
export const name = (s) => s?.attributes?.friendly_name ?? s?.entity_id ?? '';

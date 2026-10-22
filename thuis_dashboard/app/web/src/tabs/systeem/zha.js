import { writable, derived } from 'svelte/store';
import { haRequest, callService, connection } from '../../lib/api.js';

export const PERMIT_JOIN_SECONDS = 254;
const REFRESH_MS = 60e3;
const PERMIT_KEY = 'zha.permitUntil';

/**
 * @typedef {{ ieee: string, name: string, manufacturer: string, model: string, available: boolean, lqi: number|null,
 *   rssi: number|null, lastSeen: number|null, battery: boolean, type: 'Coordinator'|'Router'|'EndDevice'|string, coordinator: boolean, areaId: string|null,
 *   entityIds: string[] }} ZhaDevice
 */

/** @type {import('svelte/store').Writable<{ devices: ZhaDevice[]|null, error: string|null, loading: boolean, updated: number }>} */
export const zha = writable({ devices: null, error: null, loading: false, updated: 0 });

/** Epoch ms until which permit join is (locally assumed to be) active. ZHA has no state entity for it. */
export const permitUntil = writable(Number(localStorage.getItem(PERMIT_KEY)) || 0);
permitUntil.subscribe((v) => (v ? localStorage.setItem(PERMIT_KEY, String(v)) : localStorage.removeItem(PERMIT_KEY)));

function toMs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v))) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n < 1e12 ? n * 1000 : n;
  }
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** @returns {ZhaDevice} */
export function normalizeDevice(d) {
  const type = d.device_type ?? (d.nwk === 0 || d.nwk === '0x0000' ? 'Coordinator' : 'EndDevice');
  return {
    ieee: String(d.ieee ?? ''),
    name: d.user_given_name || d.name || [d.manufacturer, d.model].filter(Boolean).join(' ') || String(d.ieee ?? 'Onbekend'),
    manufacturer: d.manufacturer ?? '',
    model: d.model ?? '',
    available: d.available !== false,
    lqi: num(d.lqi),
    rssi: num(d.rssi),
    lastSeen: toMs(d.last_seen),
    battery: !/^mains$/i.test(String(d.power_source ?? '')),
    type,
    coordinator: type === 'Coordinator',
    areaId: d.area_id ?? null,
    entityIds: (d.entities ?? []).map((e) => e?.entity_id).filter(Boolean),
  };
}

function friendlyError(err) {
  const m = err?.message ?? String(err);
  if (/unknown.?command|unknown_command|not.?found|not loaded/i.test(m)) return 'ZHA is niet ingesteld in Home Assistant';
  if (/niet toegestaan/i.test(m)) return 'ZHA-opvraging is niet toegestaan';
  return m;
}

let inflight = null;
export function refreshZha() {
  if (inflight) return inflight;
  zha.update((z) => ({ ...z, loading: true }));
  inflight = haRequest({ type: 'zha/devices' })
    .then((res) => {
      const devices = (Array.isArray(res) ? res : []).map(normalizeDevice);
      zha.set({ devices, error: null, loading: false, updated: Date.now() });
    })
    .catch((err) => zha.update((z) => ({ ...z, error: friendlyError(err), loading: false })))
    .finally(() => (inflight = null));
  return inflight;
}

let users = 0;
let timer = null;
let unsubConn = null;
const onVisible = () => {
  if (document.visibilityState === 'visible') refreshZha();
};

/** Start periodic refresh (while the page is visible). Returns a stop function; ref-counted. */
export function useZha() {
  if (users++ === 0) {
    unsubConn = connection.subscribe((c) => c === 'open' && refreshZha());
    timer = setInterval(() => document.visibilityState === 'visible' && refreshZha(), REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    if (--users > 0) return;
    clearInterval(timer);
    unsubConn?.();
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export async function permitJoin() {
  await callService('zha', 'permit', { duration: PERMIT_JOIN_SECONDS }, undefined, 'Koppelmodus aan voor ruim 4 minuten');
  permitUntil.set(Date.now() + PERMIT_JOIN_SECONDS * 1000);
}

/** ZHA has no "stop permit" service; permitting with duration 0 closes the network again. */
export async function stopPermitJoin() {
  await callService('zha', 'permit', { duration: 0 }, undefined, 'Koppelmodus uit');
  permitUntil.set(0);
}

/** Entity ids that belong to ZHA devices (used to show a Zigbee icon on batteries). */
export const zhaEntities = derived(zha, ($z) => new Set(($z.devices ?? []).flatMap((d) => d.entityIds)));

/** Summary for the hero chip / card header. */
export const zhaSummary = derived(zha, ($z) => {
  if (!$z.devices) return { known: false, error: $z.error, total: 0, online: 0, offline: 0, coordinatorOk: null };
  const coord = $z.devices.find((d) => d.coordinator);
  const list = $z.devices.filter((d) => !d.coordinator);
  const online = list.filter((d) => d.available).length;
  return { known: true, error: $z.error, total: list.length, online, offline: list.length - online, coordinatorOk: coord ? coord.available : null };
});

import { mdiHomeAssistant, mdiPuzzle, mdiStorefrontOutline, mdiCardsOutline, mdiChip, mdiPackageVariant, mdiCellphone, mdiTablet, mdiRadiator, mdiDoorOpen, mdiWindowOpenVariant, mdiZigbee, mdiBattery } from '@mdi/js';
import { PEOPLE, DOOR_SENSORS, CAR_ENTITIES } from '$shared/config.js';

export const FEATURE_BACKUP = 8;

export const BACKUP = {
  state: 'sensor.backup_backup_manager_state',
  lastSuccessful: 'sensor.backup_last_successful_automatic_backup',
  lastAttempted: 'sensor.backup_last_attempted_automatic_backup',
  nextScheduled: 'sensor.backup_next_scheduled_automatic_backup',
  event: 'event.backup_automatic_backup',
};

export const BACKUP_MAX_AGE_MS = 3 * 86400e3;

const SYSTEM = ['home_assistant_core', 'home_assistant_operating_system', 'home_assistant_supervisor'];
const APPS = ['file_editor', 'matter_server', 'cloudflared', 'immich', 'postgres_17', 'studio_code_server', 'travelsteps', 'openthread_border_router', 'sonoff_dongle_flasher', 'alarm_actions', 'alarm_actions_app'];
const HACS = ['hacs', 'mg_saic', 'govee', 'govee_cloud_integration', 'local_tuya', 'google_home', 'advanced_history'];
const CARDS = ['tabbed_card', 'bubble_card', 'card_mod', 'statistics_graph_chart_card', 'universal_remote_card', 'config_template_card', 'custom_features_for_home_assistant_cards'];

export const UPDATE_GROUPS = [
  { key: 'systeem', label: 'Systeem', icon: mdiHomeAssistant, color: '#18bcf2' },
  { key: 'apps', label: 'Apps', icon: mdiPuzzle, color: '#8b5cf6' },
  { key: 'hacs', label: 'HACS & integraties', icon: mdiStorefrontOutline, color: '#f59e0b' },
  { key: 'kaarten', label: 'Kaarten', icon: mdiCardsOutline, color: '#ec4899' },
  { key: 'apparaten', label: 'Apparaten', icon: mdiChip, color: '#22c55e' },
  { key: 'overig', label: 'Overig', icon: mdiPackageVariant, color: '#64748b' },
];

/** Groups whose updates get a backup first when the toggle is on (Core, OS and apps). */
export const BACKUP_GROUPS = new Set(['systeem', 'apps']);

const slug = (id) => id.replace(/^update\./, '').replace(/_update$/, '');

export const isOwnDashboard = (s) => /dashboard/i.test(s.entity_id) || /dashboard/i.test(s.attributes?.title ?? '');

export function updateGroup(s) {
  const n = slug(s.entity_id);
  if (SYSTEM.includes(n)) return 'systeem';
  if (APPS.includes(n)) return 'apps';
  if (HACS.includes(n)) return 'hacs';
  if (CARDS.includes(n)) return 'kaarten';
  if (/_firmware(_\d+)?$/.test(n)) return 'apparaten';
  if (isOwnDashboard(s) || String(s.attributes?.entity_picture ?? '').includes('/hassio/addons/')) return 'apps';
  return 'overig';
}

export const supports = (s, f) => ((Number(s?.attributes?.supported_features) || 0) & f) === f;

export const inProgress = (s) => {
  const p = s?.attributes?.in_progress;
  return p === true || (typeof p === 'number' && p > 0);
};

export function updatePercentage(s) {
  const a = s?.attributes ?? {};
  const p = a.update_percentage ?? (typeof a.in_progress === 'number' ? a.in_progress : null);
  return p != null && Number.isFinite(Number(p)) ? Math.max(0, Math.min(100, Number(p))) : null;
}

export function updateTitle(s) {
  const a = s.attributes ?? {};
  const t = String(a.title || a.friendly_name || slug(s.entity_id).replace(/_/g, ' '));
  return t.replace(/\s*(update|firmware)$/i, '') || t;
}

/** Order for "Alles bijwerken": everything else first, then the dashboard itself, supervisor, OS and Core last. */
export function installOrder(s) {
  const n = slug(s.entity_id);
  if (n === 'home_assistant_core') return 4;
  if (n === 'home_assistant_operating_system') return 3;
  if (n === 'home_assistant_supervisor') return 2;
  if (isOwnDashboard(s)) return 1;
  return 0;
}

const stripSuffix = (s, re) => String(s?.attributes?.friendly_name ?? '').replace(re, '').trim();

/** @param {Set<string>} [zigbeeIds] entity ids belonging to ZHA devices */
export function batteryInfo(id, s, sensorLabels = {}, zigbeeIds) {
  const person = PEOPLE.find((p) => p.battery === id);
  if (person) return { label: `Telefoon ${person.name}`, icon: mdiCellphone, chargingEntity: person.batteryState };
  if (id.startsWith('sensor.tablet_')) return { label: 'Tablet', icon: mdiTablet, chargingEntity: 'sensor.tablet_battery_state' };
  const door = DOOR_SENSORS.find((d) => d.battery === id);
  if (door) return { label: sensorLabels?.[door.entity] || door.defaultLabel, icon: door.kind === 'window' ? mdiWindowOpenVariant : mdiDoorOpen };
  const re = /\s*(batterij|battery)( level)?$/i;
  if (id.startsWith('binary_sensor.') && /_battery(_\d+)?$/.test(id) && !zigbeeIds?.has(id)) {
    const serial = id.replace(/^binary_sensor\./, '').replace(/_battery(_\d+)?$/, '').toUpperCase();
    const fn = stripSuffix(s, re);
    return { label: `Tado ${fn && fn.toUpperCase() !== serial ? fn : serial}`, icon: mdiRadiator };
  }
  return { label: stripSuffix(s, re) || id, icon: zigbeeIds?.has(id) ? mdiZigbee : mdiBattery };
}

export const isBatteryEntity = (id, s) =>
  /^sensor\..+_battery(_level)?(_\d+)?$/.test(id) ||
  /^binary_sensor\..+_battery(_\d+)?$/.test(id) ||
  (s?.attributes?.device_class === 'battery' && id !== CAR_ENTITIES.soc && (id.startsWith('binary_sensor.') || (id.startsWith('sensor.') && s.attributes.unit_of_measurement === '%')));

export const levelColor = (pct) => (pct < 20 ? 'var(--danger)' : pct < 40 ? 'var(--warn)' : 'var(--ok)');

export function connectivityLabel(id, s) {
  if (id.includes('mg_mg4_electric')) return 'MG4';
  if (id.includes('uplighter')) return 'Uplighter';
  const fn = stripSuffix(s, /\s*(connection state|verbindingsstatus|connectivity|connectiviteit|verbinding)$/i);
  const tado = id.match(/^binary_sensor\.((?:ru|va|ib)\d+)_connection_state$/);
  if (tado) return `Tado ${fn && fn.toUpperCase() !== tado[1].toUpperCase() ? fn : tado[1].toUpperCase()}`;
  const room = id.match(/^binary_sensor\.(living|slaapkamer|badkamer)_\w+_connectivity$/);
  if (room) return `Tado ${room[1][0].toUpperCase()}${room[1].slice(1)}`;
  return fn || id;
}

export const isConnectivityEntity = (id, s) =>
  /^binary_sensor\..+_(connection_state|connectivity)$/.test(id) || (id.startsWith('binary_sensor.') && s?.attributes?.device_class === 'connectivity') || /^sensor\..+_reachability$/.test(id);

export function connectivityOk(s) {
  if (!s || s.state === 'unavailable' || s.state === 'unknown') return false;
  if (s.entity_id.startsWith('binary_sensor.')) return s.state === 'on';
  return !/unreach|offline|disconnect|niet/i.test(s.state);
}

const isUnavail = (s) => !s || s.state === 'unavailable' || s.state === 'unknown';

/** @param {Record<string, any>} st */
export function collectUpdates(st) {
  return Object.values(st).filter((s) => s.entity_id.startsWith('update.') && (s.state === 'on' || inProgress(s)));
}

/** @param {Record<string, any>} st */
export function collectBatteries(st, sensorLabels = {}, zigbeeIds = undefined) {
  return Object.values(st)
    .filter((s) => isBatteryEntity(s.entity_id, s))
    .map((s) => {
      const id = s.entity_id;
      const info = batteryInfo(id, s, sensorLabels, zigbeeIds);
      const binary = id.startsWith('binary_sensor.');
      const n = Number(s.state);
      const na = isUnavail(s) || (!binary && !Number.isFinite(n));
      const pct = na ? null : binary ? (s.state === 'on' ? 10 : 100) : Math.max(0, Math.min(100, n));
      const low = !na && (binary ? s.state === 'on' : n < 20);
      const charging = info.chargingEntity ? /^charging$/i.test(st[info.chargingEntity]?.state ?? '') : false;
      const sort = na ? 1000 : binary ? (low ? 10 : 100.5) : n;
      return { id, ...info, binary, pct, low, na, charging, sort };
    })
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}

/** @param {Record<string, any>} st */
export function collectConnectivity(st) {
  return Object.values(st)
    .filter((s) => isConnectivityEntity(s.entity_id, s))
    .map((s) => ({ id: s.entity_id, label: connectivityLabel(s.entity_id, s), ok: connectivityOk(s), na: isUnavail(s) }))
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.label.localeCompare(b.label));
}

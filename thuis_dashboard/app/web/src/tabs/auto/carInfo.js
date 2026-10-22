import {
  mdiBatteryHigh, mdiBatteryArrowUp, mdiBatteryCharging, mdiCarBattery, mdiEvStation, mdiEvPlugType2, mdiLightningBolt,
  mdiCurrentDc, mdiCurrentAc, mdiSineWave, mdiSpeedometer, mdiCounter, mdiMapMarkerPath, mdiLeaf, mdiPower,
  mdiKey, mdiClockOutline, mdiFan, mdiThermometer, mdiCarDefrostFront, mdiCarDefrostRear, mdiCarSeatHeater, mdiSteering,
  mdiAirConditioner, mdiLock, mdiCarDoor, mdiCarBack, mdiWindowClosedVariant, mdiCarTireAlert, mdiCarLightDimmed,
  mdiCarLightHigh, mdiCarParkingLights, mdiCarConnected, mdiUpdate, mdiMapMarker, mdiPalmTree, mdiAlertCircleOutline,
  mdiCarInfo, mdiTagOutline, mdiCalendar, mdiBarcode, mdiRoadVariant, mdiBatteryHeart, mdiCalendarClock, mdiTimerSand,
  mdiTimerOutline, mdiMapMarkerDistance, mdiDatabaseClockOutline, mdiThermostat, mdiCarCog, mdiPlusCircleOutline,
  mdiWeatherWindy, mdiChip, mdiCarWrench, mdiWifi, mdiLightbulbOutline,
} from '@mdi/js';
import { CAR_ENTITIES } from '$shared/config.js';
import { relTime, fmtDateTime, fmtDuration } from '../../lib/format.js';
import { toKwh100 } from './carHistory.js';

const P = CAR_ENTITIES.soc.replace(/^sensor\./, '').replace(/_state_of_charge$/, '');
const id = (/** @type {string} */ domain, /** @type {string} */ suffix) => `${domain}.${P}_${suffix}`;

/**
 * @typedef {{ id: string, label: string, icon: string, digits?: number, kind?: 'dur'|'time'|'ts'|'eff', on?: string, off?: string }} InfoItem
 * @typedef {{ key: string, title: string, icon: string, accent?: string, items: InfoItem[] }} InfoGroup
 */

const OPEN = { on: 'Open', off: 'Dicht' };
const ONOFF = { on: 'Aan', off: 'Uit' };

/** @type {InfoGroup[]} */
export const GROUPS = [
  {
    key: 'battery', title: 'Batterij & laden', icon: mdiBatteryCharging, accent: 'var(--ok)',
    items: [
      { id: CAR_ENTITIES.soc, label: 'Laadniveau', icon: mdiBatteryHigh, digits: 0 },
      { id: CAR_ENTITIES.range, label: 'Bereik', icon: mdiMapMarkerDistance, digits: 0 },
      { id: CAR_ENTITIES.targetSoc, label: 'Doel-laadniveau', icon: mdiBatteryArrowUp, digits: 0 },
      { id: id('sensor', 'target_soc'), label: 'Doel-laadniveau (auto)', icon: mdiBatteryArrowUp, digits: 0 },
      { id: id('sensor', 'total_battery_capacity'), label: 'Batterijcapaciteit', icon: mdiCarBattery, digits: 1 },
      { id: id('sensor', 'charging_status'), label: 'Laadstatus', icon: mdiEvStation },
      { id: CAR_ENTITIES.charging, label: 'Laden', icon: mdiEvStation, on: 'Bezig', off: 'Gestopt' },
      { id: id('binary_sensor', 'charging_gun_state'), label: 'Laadkabel', icon: mdiEvPlugType2, on: 'Aangesloten', off: 'Niet aangesloten' },
      { id: CAR_ENTITIES.chargingPower, label: 'Laadvermogen', icon: mdiLightningBolt, digits: 1 },
      { id: id('sensor', 'charging_current'), label: 'Laadstroom', icon: mdiCurrentDc, digits: 1 },
      { id: id('sensor', 'charging_voltage'), label: 'Laadspanning', icon: mdiSineWave, digits: 0 },
      { id: CAR_ENTITIES.chargingCurrentLimit, label: 'Laadstroomlimiet', icon: mdiCurrentAc },
      { id: id('sensor', 'charging_current_limit'), label: 'Laadstroomlimiet (auto)', icon: mdiCurrentAc },
      { id: CAR_ENTITIES.remainingChargingTime, label: 'Tijd tot vol', icon: mdiTimerSand, kind: 'dur' },
      { id: CAR_ENTITIES.chargingDuration, label: 'Laadduur', icon: mdiTimerOutline, kind: 'dur' },
      { id: id('sensor', 'charge_session_duration'), label: 'Duur laadsessie', icon: mdiTimerOutline, kind: 'dur' },
      { id: CAR_ENTITIES.estimatedRangeAfterCharging, label: 'Bereik na laden', icon: mdiMapMarkerDistance, digits: 0 },
      { id: id('sensor', 'added_electric_range'), label: 'Bijgeladen bereik', icon: mdiPlusCircleOutline, digits: 0 },
      { id: id('sensor', 'last_charge_duration'), label: 'Vorige laadbeurt – duur', icon: mdiTimerOutline, kind: 'dur' },
      { id: id('sensor', 'last_charge_range_added'), label: 'Vorige laadbeurt – bereik', icon: mdiPlusCircleOutline, digits: 0 },
      { id: id('sensor', 'charging_data_freshness'), label: 'Laaddata versheid', icon: mdiDatabaseClockOutline },
      { id: id('sensor', 'charging_data_last_updated'), label: 'Laaddata bijgewerkt', icon: mdiDatabaseClockOutline, kind: 'ts' },
      { id: CAR_ENTITIES.chargingPortLock, label: 'Laadpoort', icon: mdiEvPlugType2, on: 'Vergrendeld', off: 'Ontgrendeld' },
      { id: CAR_ENTITIES.scheduledChargingMode, label: 'Gepland laden', icon: mdiCalendarClock },
      { id: CAR_ENTITIES.scheduledChargingStart, label: 'Gepland laden – start', icon: mdiClockOutline, kind: 'time' },
      { id: CAR_ENTITIES.scheduledChargingEnd, label: 'Gepland laden – einde', icon: mdiClockOutline, kind: 'time' },
      { id: CAR_ENTITIES.batteryHeating, label: 'Batterijverwarming', icon: mdiBatteryHeart, ...ONOFF },
      { id: id('sensor', 'battery_heating_status'), label: 'Status batterijverwarming', icon: mdiBatteryHeart },
      { id: CAR_ENTITIES.batteryHeatingSchedule, label: 'Batterij voorverwarmen', icon: mdiCalendarClock, ...ONOFF },
      { id: CAR_ENTITIES.batteryHeatingTime, label: 'Voorverwarmen om', icon: mdiClockOutline, kind: 'time' },
    ],
  },
  {
    key: 'drive', title: 'Rijden', icon: mdiRoadVariant, accent: 'var(--accent-2)',
    items: [
      { id: CAR_ENTITIES.speed, label: 'Snelheid', icon: mdiSpeedometer, digits: 0 },
      { id: CAR_ENTITIES.mileage, label: 'Kilometerstand', icon: mdiCounter, digits: 0 },
      { id: id('sensor', 'journey_distance'), label: 'Huidige rit', icon: mdiMapMarkerPath, digits: 1 },
      { id: id('sensor', 'last_trip_distance'), label: 'Vorige rit', icon: mdiMapMarkerPath, digits: 1 },
      { id: id('sensor', 'last_trip_efficiency'), label: 'Verbruik vorige rit', icon: mdiLeaf, digits: 1, kind: 'eff' },
      { id: id('sensor', 'mileage_since_last_charge'), label: 'Km sinds laden', icon: mdiRoadVariant, digits: 0 },
      { id: id('sensor', 'power_usage_since_last_charge'), label: 'Verbruikt sinds laden', icon: mdiLightningBolt, digits: 1 },
      { id: id('sensor', 'efficiency_since_last_charge'), label: 'Verbruik sinds laden', icon: mdiLeaf, digits: 1, kind: 'eff' },
      { id: id('sensor', 'efficiency_since_charge_soc'), label: 'Verbruik sinds laden (SoC)', icon: mdiLeaf, digits: 1, kind: 'eff' },
      { id: id('sensor', 'power_mode'), label: 'Stroommodus', icon: mdiPower },
      { id: id('binary_sensor', 'engine_status'), label: 'Motor', icon: mdiCarCog, ...ONOFF },
      { id: id('sensor', 'last_powered_on'), label: 'Laatst aangezet', icon: mdiPower, kind: 'ts' },
      { id: id('sensor', 'last_powered_off'), label: 'Laatst uitgezet', icon: mdiPower, kind: 'ts' },
      { id: id('sensor', 'last_vehicle_activity'), label: 'Laatste activiteit', icon: mdiClockOutline, kind: 'ts' },
      { id: id('sensor', 'last_key_seen'), label: 'Sleutel laatst gezien', icon: mdiKey, kind: 'ts' },
    ],
  },
  {
    key: 'climate', title: 'Klimaat', icon: mdiFan, accent: 'var(--heat)',
    items: [
      { id: CAR_ENTITIES.interiorTemperature, label: 'Binnentemperatuur', icon: mdiThermometer, digits: 1 },
      { id: CAR_ENTITIES.exteriorTemperature, label: 'Buitentemperatuur', icon: mdiThermometer, digits: 1 },
      { id: CAR_ENTITIES.climate, label: 'Klimaatregeling', icon: mdiThermostat },
      { id: id('number', 'climate_target_temperature'), label: 'Doeltemperatuur', icon: mdiThermostat, digits: 1 },
      { id: id('select', 'climate_mode'), label: 'Klimaatmodus', icon: mdiFan },
      { id: id('sensor', 'climate_mode'), label: 'Klimaatmodus (auto)', icon: mdiFan },
      { id: id('binary_sensor', 'hvac_status'), label: 'Klimaat actief', icon: mdiFan, on: 'Ja', off: 'Nee' },
      { id: id('switch', 'air_conditioning'), label: 'Airco', icon: mdiAirConditioner, ...ONOFF },
      { id: id('binary_sensor', 'ventilation'), label: 'Ventilatie', icon: mdiWeatherWindy, ...ONOFF },
      { id: CAR_ENTITIES.frontDefrost, label: 'Voorruit ontdooien', icon: mdiCarDefrostFront, ...ONOFF },
      { id: CAR_ENTITIES.rearDefrost, label: 'Achterruit ontdooien', icon: mdiCarDefrostRear, ...ONOFF },
      { id: CAR_ENTITIES.seatLeft, label: 'Stoelverwarming links', icon: mdiCarSeatHeater, ...ONOFF },
      { id: CAR_ENTITIES.seatLeftLevel, label: 'Niveau stoel links', icon: mdiCarSeatHeater },
      { id: id('sensor', 'front_left_heated_seat_level'), label: 'Niveau stoel links (auto)', icon: mdiCarSeatHeater },
      { id: CAR_ENTITIES.seatRight, label: 'Stoelverwarming rechts', icon: mdiCarSeatHeater, ...ONOFF },
      { id: CAR_ENTITIES.seatRightLevel, label: 'Niveau stoel rechts', icon: mdiCarSeatHeater },
      { id: id('sensor', 'front_right_heated_seat_level'), label: 'Niveau stoel rechts (auto)', icon: mdiCarSeatHeater },
      { id: CAR_ENTITIES.steeringWheel, label: 'Stuurverwarming', icon: mdiSteering, ...ONOFF },
      { id: id('sensor', 'steering_wheel_heat'), label: 'Stuurverwarming (auto)', icon: mdiSteering },
    ],
  },
  {
    key: 'doors', title: 'Deuren & ramen', icon: mdiCarDoor, accent: 'var(--accent)',
    items: [
      { id: CAR_ENTITIES.lock, label: 'Slot', icon: mdiLock },
      { id: CAR_ENTITIES.lockStatus, label: 'Slotstatus', icon: mdiLock },
      ...CAR_ENTITIES.openings.map((o) => ({ id: o.entity, label: o.label, icon: /boot/.test(o.entity) ? mdiCarBack : mdiCarDoor, ...OPEN })),
      { id: id('binary_sensor', 'window_front_left'), label: 'Raam linksvoor', icon: mdiWindowClosedVariant, ...OPEN },
      { id: id('binary_sensor', 'window_front_right'), label: 'Raam rechtsvoor', icon: mdiWindowClosedVariant, ...OPEN },
      { id: id('binary_sensor', 'window_rear_left'), label: 'Raam linksachter', icon: mdiWindowClosedVariant, ...OPEN },
      { id: id('binary_sensor', 'window_rear_right'), label: 'Raam rechtsachter', icon: mdiWindowClosedVariant, ...OPEN },
    ],
  },
  {
    key: 'tyres', title: 'Banden', icon: mdiCarTireAlert, accent: 'var(--info)',
    items: [
      ...CAR_ENTITIES.tyres.map((t) => ({ id: t.entity, label: t.label, icon: mdiCarTireAlert, digits: 1 })),
      { id: id('binary_sensor', 'wheel_tyre_monitor_status'), label: 'Bandenbewaking', icon: mdiCarTireAlert, on: 'Probleem', off: 'In orde' },
    ],
  },
  {
    key: 'lights', title: 'Verlichting', icon: mdiLightbulbOutline, accent: 'var(--warn)',
    items: [
      { id: id('binary_sensor', 'dipped_beam_status'), label: 'Dimlicht', icon: mdiCarLightDimmed, ...ONOFF },
      { id: id('binary_sensor', 'main_beam_status'), label: 'Grootlicht', icon: mdiCarLightHigh, ...ONOFF },
      { id: id('binary_sensor', 'side_light_status'), label: 'Standlicht', icon: mdiCarParkingLights, ...ONOFF },
    ],
  },
  {
    key: 'other', title: 'Verbinding & overig', icon: mdiCarInfo, accent: 'var(--accent-3)',
    items: [
      { id: CAR_ENTITIES.reachability, label: 'Bereikbaarheid', icon: mdiWifi },
      { id: CAR_ENTITIES.lastUpdate, label: 'Laatste update', icon: mdiCarConnected, kind: 'ts' },
      { id: id('sensor', 'next_update_time'), label: 'Volgende update', icon: mdiUpdate, kind: 'ts' },
      { id: id('sensor', 'data_freshness'), label: 'Data versheid', icon: mdiDatabaseClockOutline },
      { id: CAR_ENTITIES.location, label: 'Locatie', icon: mdiMapMarker },
      { id: CAR_ENTITIES.holidayMode, label: 'Vakantiemodus', icon: mdiPalmTree, ...ONOFF },
      { id: CAR_ENTITIES.commandErrors, label: 'Laatste commandofout', icon: mdiAlertCircleOutline, kind: 'ts' },
      { id: id('sensor', 'brand'), label: 'Merk', icon: mdiTagOutline },
      { id: id('sensor', 'model'), label: 'Model', icon: mdiCarInfo },
      { id: id('sensor', 'model_year'), label: 'Bouwjaar', icon: mdiCalendar },
      { id: id('sensor', 'vin'), label: 'VIN', icon: mdiBarcode },
      { id: 'update.mg_saic_update', label: 'MG SAIC-integratie', icon: mdiChip },
    ],
  },
];

export const ICON_FALLBACK = mdiCarWrench;

/** Entities intentionally not shown as stats (still used internally, e.g. for cost calculations). */
export const HIDDEN = new Set([
  id('sensor', 'battery_energy'),
  id('sensor', 'last_charge_energy'),
  id('sensor', 'ancillary_battery_voltage'),
  CAR_ENTITIES.instantPower,
]);

/** @type {Record<string,string>} */
const WORDS = {
  online: 'Online', offline: 'Offline', charging: 'Laden', not_charging: 'Niet aan het laden', 'not charging': 'Niet aan het laden',
  charging_finished: 'Klaar met laden', finished: 'Klaar', complete: 'Voltooid', idle: 'Inactief', disconnected: 'Niet verbonden',
  connected: 'Verbonden', home: 'Thuis', not_home: 'Niet thuis', locked: 'Vergrendeld', unlocked: 'Ontgrendeld',
  locking: 'Vergrendelen…', unlocking: 'Ontgrendelen…', jammed: 'Geblokkeerd', open: 'Open', opening: 'Openen…', closed: 'Dicht',
  disabled: 'Uit', enabled: 'Aan', 'until configured soc': 'Tot doel-%', 'until configured time': 'Tot eindtijd',
  heat_cool: 'Aan', heat: 'Verwarmen', cool: 'Koelen', fan_only: 'Ventilatie', dry: 'Drogen', auto: 'Auto',
  off: 'Uit', on: 'Aan', low: 'Laag', medium: 'Midden', mid: 'Midden', high: 'Hoog', max: 'Max',
  fresh: 'Actueel', stale: 'Verouderd', running: 'Actief', heating: 'Verwarmt', true: 'Ja', false: 'Nee',
  accessory: 'Accessoires', ready: 'Rijklaar', standby: 'Stand-by',
};

const ISO = /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/;

/** @param {string} v */
const word = (v) => WORDS[v.toLowerCase()] ?? (v.length > 1 ? v[0].toUpperCase() + v.slice(1).replace(/_/g, ' ') : v);

/** @param {number} v @param {number} d */
const fmt = (v, d) => v.toLocaleString('nl-BE', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Human readable value of a car entity.
 * @param {any} st HA state object
 * @param {InfoItem} item
 * @returns {{ text: string, unit?: string, sub?: string, title?: string, tone?: 'ok'|'warn'|'danger'|'' , na: boolean }}
 */
export function formatValue(st, item) {
  if (!st || st.state === 'unavailable' || st.state === 'unknown' || st.state === '') return { text: '—', na: true };
  const [domain] = st.entity_id.split('.');
  const a = st.attributes ?? {};
  const v = String(st.state);

  if ((item.kind === 'ts' || a.device_class === 'timestamp' || domain === 'event' || domain === 'button') && ISO.test(v)) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) {
      const msg = domain === 'event' ? a.message ?? a.error ?? a.detail ?? a.event_type : '';
      return { text: relTime(t), sub: msg ? String(msg) : fmtDateTime(t), title: fmtDateTime(t), na: false };
    }
  }

  if (item.kind === 'time' || domain === 'time') return { text: v.slice(0, 5), na: false };

  if (domain === 'binary_sensor' || domain === 'switch' || domain === 'input_boolean') {
    if (item.id === CAR_ENTITIES.lockStatus) {
      const isLocked = a.device_class === 'lock' ? v === 'off' : v === 'on';
      return { text: isLocked ? 'Vergrendeld' : 'Ontgrendeld', tone: isLocked ? 'ok' : 'warn', na: false };
    }
    const on = v === 'on';
    const warnOn = item.on === 'Open' || item.on === 'Probleem';
    return { text: on ? item.on ?? 'Aan' : item.off ?? 'Uit', tone: on ? (warnOn ? (item.on === 'Probleem' ? 'danger' : 'warn') : 'ok') : '', na: false };
  }

  if (domain === 'lock') return { text: word(v), tone: v === 'locked' ? 'ok' : 'warn', na: false };

  if (domain === 'climate') {
    const tt = a.temperature != null ? `${fmt(Number(a.temperature), 1)}°` : '';
    return { text: word(v), sub: [tt && `Doel ${tt}`, a.current_temperature != null ? `Nu ${fmt(Number(a.current_temperature), 1)}°` : ''].filter(Boolean).join(' · '), tone: v !== 'off' ? 'ok' : '', na: false };
  }

  if (domain === 'device_tracker') {
    const lat = Number(a.latitude), lon = Number(a.longitude);
    return { text: word(v), sub: Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : '', na: false };
  }

  if (domain === 'update') {
    const sub = a.installed_version ? `Versie ${a.installed_version}${v === 'on' && a.latest_version ? ` → ${a.latest_version}` : ''}` : '';
    return { text: v === 'on' ? 'Update beschikbaar' : 'Up-to-date', sub, tone: v === 'on' ? 'warn' : 'ok', na: false };
  }

  const n = Number(v);
  const unit = a.unit_of_measurement ?? '';
  if (v.trim() !== '' && Number.isFinite(n) && !/vin|model_year/.test(st.entity_id)) {
    if (item.kind === 'eff') {
      const c = toKwh100(n, unit);
      return c != null ? { text: fmt(c, 1), unit: 'kWh/100km', na: false } : { text: '—', na: true };
    }
    if (item.kind === 'dur' || a.device_class === 'duration') {
      const min = unit === 's' ? n / 60 : unit === 'h' ? n * 60 : unit === 'd' ? n * 1440 : n;
      return { text: fmtDuration(min), na: false };
    }
    return { text: fmt(n, item.digits ?? (Number.isInteger(n) ? 0 : 1)), unit, na: false };
  }

  if (ISO.test(v) && Number.isFinite(Date.parse(v))) {
    const t = Date.parse(v);
    return { text: relTime(t), sub: fmtDateTime(t), title: fmtDateTime(t), na: false };
  }

  return { text: word(v), unit: unit || undefined, na: false };
}

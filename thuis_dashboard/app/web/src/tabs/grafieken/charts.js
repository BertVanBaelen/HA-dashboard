import {
  mdiSofaOutline, mdiBedOutline, mdiShowerHead, mdiWeatherPartlyCloudy, mdiRadiator, mdiBatteryCharging60,
  mdiThermometer, mdiSpeedometer, mdiSpeedometerSlow, mdiMapMarkerDistance, mdiEvStation,
  mdiCellphone, mdiAccessPointNetwork,
  mdiRoadVariant, mdiCurrentAc, mdiLeaf, mdiMapMarkerPath, mdiCarTireAlert,
} from '@mdi/js';
import { ROOMS, HOME, CAR_ENTITIES as CAR, PEOPLE, DOOR_SENSORS } from '$shared/config.js';
import { PERSON_COLORS } from '../../lib/colors.js';
import { period5min, periodDaily, periodHourly } from './data.js';
import { toKwh100, unitOf } from '../auto/carHistory.js';

/** Value mapper converting a consumption sensor (km/kWh, …) to kWh/100km. @param {string} entity */
const kwh100 = (entity) => (/** @type {number} */ v) => toKwh100(v, unitOf(entity));

const ROOM_ICONS = { living: mdiSofaOutline, slaapkamer: mdiBedOutline, badkamer: mdiShowerHead };
const PCT = { unit: '%', range: [0, 100] };
const friendlyLabel = (n, id) => n || id.replace(/^sensor\./, '').replace(/_battery(_level)?(_\d+)?$/, '').replace(/_/g, ' ');

/** @returns {import('./data.js').ChartDef[]} */
export function klimaatCharts() {
  const rooms = ROOMS.map((r) => ({
    id: `room-${r.key}`,
    title: r.name,
    iconPath: ROOM_ICONS[r.key],
    defaultRange: '24u',
    axes: { y: { unit: '°C' }, y2: { unit: '%', digits: 0 } },
    series: [
      { entity: r.temperature, label: 'Temperatuur', color: '--accent', type: 'area' },
      { entity: r.climate, attr: 'temperature', label: 'Setpoint', color: '--heat', type: 'step', dash: true, unit: '°C' },
      { entity: r.humidity, label: 'Vochtigheid', color: '--info', axis: 'y2', digits: 0 },
    ].filter(Boolean),
  }));
  return [
    ...rooms,
    {
      id: 'outdoor',
      title: 'Buiten',
      iconPath: mdiWeatherPartlyCloudy,
      accent: 'var(--cool)',
      defaultRange: '7d',
      axes: { y: { unit: '°C' }, y2: { unit: '%', range: [0, 100], digits: 0 } },
      series: [
        { entity: HOME.outdoorTemperature, label: 'Buiten', color: '--cool', type: 'area' },
        { entity: HOME.solar, label: 'Zon', color: '#f59e0b', axis: 'y2', digits: 0 },
      ],
    },
    {
      id: 'heating',
      title: 'Verwarmingsvermogen',
      iconPath: mdiRadiator,
      accent: 'var(--heat)',
      defaultRange: '24u',
      stacked: true,
      axes: { y: { unit: '%', zero: true, digits: 0 } },
      series: ROOMS.map((r, i) => ({ entity: r.heating, label: r.name, color: ['--heat', '--accent-2', '--accent-3'][i % 3], digits: 0 })),
    },
  ];
}

/** @returns {import('./data.js').ChartDef[]} */
export function autoCharts() {
  const carPrefix = CAR.soc.replace(/^sensor\./, '').replace(/_state_of_charge$/, '');
  const carId = (/** @type {string} */ domain, /** @type {string} */ suffix) => `${domain}.${carPrefix}_${suffix}`;
  return [
    {
      id: 'car-soc',
      title: 'Batterij',
      iconPath: mdiBatteryCharging60,
      accent: 'var(--ok)',
      defaultRange: '7d',
      period: periodHourly,
      axes: { y: PCT },
      series: [{ entity: CAR.soc, label: 'Batterij', color: '--ok', type: 'area', digits: 0 }],
    },
    {
      id: 'car-temp',
      title: 'Temperatuur',
      iconPath: mdiThermometer,
      defaultRange: '7d',
      ranges: ['7d', '30d'],
      period: periodDaily,
      axes: { y: { unit: '°C' } },
      series: [
        { entity: CAR.interiorTemperature, label: 'Binnen', color: '--ok' },
        { entity: CAR.exteriorTemperature, label: 'Buiten', color: '--danger' },
      ],
    },
    {
      id: 'car-speed-day',
      title: 'Snelheid per dag',
      iconPath: mdiSpeedometer,
      defaultRange: '7d',
      ranges: ['7d', '30d'],
      period: periodDaily,
      axes: { y: { zero: true, digits: 0 } },
      series: [
        { entity: CAR.speed, stat: 'max', label: 'Max', color: '--accent-2', type: 'bar', size: 0.75, digits: 0 },
        { entity: CAR.speed, stat: 'mean', label: 'Gemiddeld', color: '--accent', type: 'bar', size: 0.4, digits: 0 },
      ],
    },
    {
      id: 'car-speed-recent',
      title: 'Snelheid recent',
      iconPath: mdiSpeedometerSlow,
      defaultRange: '6u',
      ranges: ['6u', '24u'],
      period: period5min,
      axes: { y: { zero: true, digits: 0 } },
      series: [{ entity: CAR.speed, label: 'Snelheid', color: '--accent', type: 'bar', size: 0.8, digits: 0 }],
    },
    {
      id: 'car-km',
      title: 'Kilometers per dag',
      iconPath: mdiMapMarkerDistance,
      accent: 'var(--accent-2)',
      defaultRange: '30d',
      ranges: ['7d', '30d'],
      period: periodDaily,
      axes: { y: { zero: true, digits: 0 } },
      series: [{ entity: CAR.mileage, stat: 'change', label: 'Gereden', color: '--accent-2', type: 'bar', size: 0.7, digits: 0 }],
    },
    {
      id: 'car-charge',
      title: 'Laadsessie',
      iconPath: mdiEvStation,
      accent: 'var(--ok)',
      defaultRange: '6u',
      axes: { y: PCT, y2: { zero: true } },
      series: [
        { entity: CAR.soc, label: 'Batterij', color: '--ok', type: 'area', digits: 0 },
        { entity: CAR.chargingPower, label: 'Laadvermogen', color: '--danger', axis: 'y2' },
      ],
    },
    {
      id: 'car-range',
      title: 'Bereik',
      iconPath: mdiRoadVariant,
      accent: 'var(--accent)',
      defaultRange: '7d',
      period: periodHourly,
      axes: { y: { zero: true, digits: 0 } },
      series: [
        { entity: CAR.range, label: 'Bereik', color: '--accent', type: 'area', digits: 0 },
        { entity: CAR.estimatedRangeAfterCharging, label: 'Na laden', color: '--accent-2', dash: true, digits: 0 },
      ],
    },
    {
      id: 'car-charge-elec',
      title: 'Laadstroom & spanning',
      iconPath: mdiCurrentAc,
      accent: 'var(--warn)',
      defaultRange: '24u',
      ranges: ['6u', '24u', '7d'],
      axes: { y: { zero: true }, y2: { zero: true, digits: 0 } },
      series: [
        { entity: carId('sensor', 'charging_current'), label: 'Stroom', color: '--warn', type: 'area' },
        { entity: carId('sensor', 'charging_voltage'), label: 'Spanning', color: '--info', axis: 'y2', digits: 0 },
      ],
    },
    {
      id: 'car-efficiency',
      title: 'Verbruik',
      iconPath: mdiLeaf,
      accent: 'var(--ok)',
      defaultRange: '30d',
      ranges: ['7d', '30d'],
      period: periodDaily,
      axes: { y: { unit: 'kWh/100km', zero: true } },
      series: [
        { entity: carId('sensor', 'last_trip_efficiency'), label: 'Vorige rit', color: '--ok', unit: 'kWh/100km', map: kwh100(carId('sensor', 'last_trip_efficiency')) },
        { entity: carId('sensor', 'efficiency_since_last_charge'), label: 'Sinds laden', color: '--accent-2', unit: 'kWh/100km', map: kwh100(carId('sensor', 'efficiency_since_last_charge')) },
      ],
    },
    {
      id: 'car-trips',
      title: 'Ritafstand',
      iconPath: mdiMapMarkerPath,
      accent: 'var(--accent-2)',
      defaultRange: '30d',
      ranges: ['7d', '30d'],
      period: periodDaily,
      axes: { y: { zero: true, digits: 0 } },
      series: [{ entity: carId('sensor', 'last_trip_distance'), stat: 'max', label: 'Langste rit', color: '--accent-2', type: 'bar', size: 0.6, digits: 1 }],
    },
    {
      id: 'car-tyres',
      title: 'Bandenspanning',
      iconPath: mdiCarTireAlert,
      accent: 'var(--info)',
      defaultRange: '30d',
      ranges: ['7d', '30d'],
      period: periodDaily,
      series: CAR.tyres.map((t, i) => ({ entity: t.entity, label: t.label, color: ['--accent', '--accent-2', '--info', '--warn'][i % 4], digits: 1 })),
    },
  ];
}

/**
 * Battery sensors (device_class battery, %) not covered by the fixed phone/door charts, e.g. ZHA devices.
 * @param {Record<string, any>} st
 * @returns {string[]}
 */
export function extraBatterySensors(st) {
  const known = new Set([...PEOPLE.map((p) => p.battery), ...DOOR_SENSORS.map((d) => d.battery), CAR.soc]);
  return Object.values(st)
    .filter((s) => s.entity_id.startsWith('sensor.') && s.attributes?.device_class === 'battery' && s.attributes?.unit_of_measurement === '%')
    .map((s) => s.entity_id)
    .filter((id) => !known.has(id) && !id.startsWith('sensor.tablet_'))
    .sort();
}

/**
 * @param {Record<string,string>} labels sensor label overrides (household.sensorLabels)
 * @param {(id: string) => string|undefined} friendly
 * @param {string[]} [extra] additional battery sensors (see extraBatterySensors)
 * @returns {import('./data.js').ChartDef[]}
 */
export function batterijCharts(labels, friendly, extra = []) {
  const colors = ['--accent-3', '--info', '--warn', '--ok', '--heat', '--cool'];
  return [
    {
      id: 'bat-phones',
      title: 'Persoonlijke toestellen',
      iconPath: mdiCellphone,
      defaultRange: '24u',
      axes: { y: PCT },
      series: PEOPLE.map((p, i) => ({ entity: p.battery, label: p.name, color: PERSON_COLORS[p.key] ?? '--accent', type: i === 0 ? 'area' : undefined, digits: 0 })),
    },
    {
      id: 'bat-sensors',
      title: 'Sensoren',
      iconPath: mdiAccessPointNetwork,
      defaultRange: '30d',
      axes: { y: PCT },
      series: [
        ...DOOR_SENSORS.map((d, i) => ({ entity: d.battery, label: labels?.[d.entity] ?? d.defaultLabel, color: ['--accent', '--accent-2'][i % 2], digits: 0 })),
        ...extra.map((id, i) => ({ entity: id, label: friendlyLabel(friendly(id), id), color: colors[i % colors.length], digits: 0 })),
      ],
    },
  ];
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTopology, stripArea } from '../shared/topology.js';
import { MEDIA } from '../shared/config.js';

const areas = [
  { area_id: 'living', name: 'Living' },
  { area_id: 'slaapkamer', name: 'Slaapkamer' },
];
const devices = [
  { id: 'dev_lamp', area_id: 'slaapkamer' },
  { id: 'dev_tado', area_id: 'living' },
  { id: 'dev_door', area_id: 'living' },
  { id: 'dev_off', area_id: 'living', disabled_by: 'user' },
];
const entities = [
  { entity_id: 'light.uplighter', device_id: 'dev_lamp' },
  { entity_id: 'select.uplighter_scene', device_id: 'dev_lamp', entity_category: 'config' },
  { entity_id: 'light.strip', device_id: 'dev_lamp', area_id: 'living' },
  { entity_id: 'light.hidden_label', area_id: 'living', labels: ['dashboard_verbergen'] },
  { entity_id: 'light.hidden_custom', area_id: 'living', labels: ['lbl_hide'] },
  { entity_id: 'light.disabled', area_id: 'living', disabled_by: 'user' },
  { entity_id: 'light.hidden', area_id: 'living', hidden_by: 'user' },
  { entity_id: 'light.dev_disabled', device_id: 'dev_off' },
  { entity_id: 'light.nowhere' },
  { entity_id: 'climate.living', device_id: 'dev_tado' },
  { entity_id: 'sensor.living_temperature', device_id: 'dev_tado' },
  { entity_id: 'sensor.living_humidity', device_id: 'dev_tado' },
  { entity_id: 'sensor.living_heating', device_id: 'dev_tado' },
  { entity_id: 'binary_sensor.living_window', device_id: 'dev_tado' },
  { entity_id: 'binary_sensor.door', device_id: 'dev_door' },
  { entity_id: 'sensor.door_battery', device_id: 'dev_door' },
  { entity_id: 'switch.slaapkamer_ventilator', area_id: 'slaapkamer' },
  { entity_id: 'script.slaapkamer_wekker', area_id: 'slaapkamer' },
  { entity_id: 'sensor.slaapkamer_temp', area_id: 'slaapkamer' },
  { entity_id: MEDIA.tvPower, area_id: 'slaapkamer' },
];
const st = (state, attributes = {}) => ({ state, attributes });
const states = {
  'light.uplighter': st('on', { friendly_name: 'Slaapkamer Uplighter' }),
  'light.strip': st('off', { friendly_name: 'LED-strip' }),
  'binary_sensor.door': st('off', { device_class: 'door', friendly_name: 'Badkamerdeur' }),
  'sensor.door_battery': st('80', { device_class: 'battery' }),
  'sensor.slaapkamer_temp': st('19', { device_class: 'temperature', friendly_name: 'Slaapkamer temperatuur' }),
  'sensor.living_temperature': st('21', { device_class: 'temperature' }),
  'light.orphan_state': st('on'),
};
const labels = [{ label_id: 'lbl_hide', name: 'Dashboard_Verbergen' }];
const topo = () => buildTopology({ areas, devices, entities, labels, states });

test('room membership: entity area wins over device area', () => {
  const t = topo();
  assert.deepEqual(t.rooms.slaapkamer.lights.map((l) => l.entity), ['light.uplighter']);
  assert.deepEqual(t.rooms.living.lights.map((l) => l.entity), ['light.strip']);
});

test('hidden, disabled and labelled entities are skipped', () => {
  const t = topo();
  const all = [...Object.values(t.rooms), t.unassigned].flatMap((r) => r.lights.map((l) => l.entity));
  for (const id of ['light.hidden_label', 'light.hidden_custom', 'light.disabled', 'light.hidden', 'light.dev_disabled']) assert.ok(!all.includes(id), id);
});

test('entities without area land in unassigned, state-only entities too', () => {
  const ids = topo().unassigned.lights.map((l) => l.entity);
  assert.ok(ids.includes('light.nowhere'));
  assert.ok(ids.includes('light.orphan_state'));
});

test('names are stripped of the area prefix', () => {
  assert.equal(topo().rooms.slaapkamer.lights[0].name, 'Uplighter');
  assert.equal(stripArea('Living raam', 'Living'), 'Raam');
  assert.equal(stripArea('Living', 'Living'), 'Living');
});

test('scene select from the same device, config category allowed', () => {
  assert.equal(topo().rooms.slaapkamer.lights[0].sceneSelect, 'select.uplighter_scene');
});

test('climate picks Tado helpers from the same device', () => {
  const t = topo();
  const c = t.rooms.living.climate;
  assert.equal(c.entity, 'climate.living');
  assert.equal(c.temperature, 'sensor.living_temperature');
  assert.equal(c.humidity, 'sensor.living_humidity');
  assert.equal(c.heating, 'sensor.living_heating');
  assert.equal(c.window, 'binary_sensor.living_window');
  assert.equal(c.tadoMode, null);
  assert.equal(t.rooms.living.sensors.length, 0);
  assert.equal(t.rooms.slaapkamer.climate, null);
});

test('openings with battery, switches, scripts, sensors', () => {
  const t = topo();
  assert.deepEqual(t.rooms.living.openings, [{ entity: 'binary_sensor.door', name: 'Badkamerdeur', kind: 'door', battery: 'sensor.door_battery' }]);
  assert.equal(t.rooms.slaapkamer.switches[0].icon, 'fan');
  assert.equal(t.rooms.slaapkamer.scripts[0].icon, 'alarm');
  assert.equal(t.rooms.slaapkamer.sensors[0].kind, 'temperature');
});

test('media placement follows the area of the media entity', () => {
  const t = topo();
  assert.deepEqual(t.rooms.slaapkamer.media.map((m) => m.kind), ['tv']);
  assert.equal(t.rooms.living.media.length, 0);
});

test('areas are listed sorted with ids', () => {
  assert.deepEqual(topo().areas.map((a) => a.id), ['living', 'slaapkamer']);
});

test('empty input gives an empty topology', () => {
  const t = buildTopology();
  assert.deepEqual(t.areas, []);
  assert.deepEqual(t.unassigned.lights, []);
});

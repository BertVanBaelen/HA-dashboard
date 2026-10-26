import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.js';
import { linkLayout, rekeyComfort, matchArea, defaultLayout } from '../server/migrate-layout.js';

const quiet = { info() {}, warn() {}, error() {} };
const AREAS = [
  { area_id: 'living', name: 'Living' },
  { area_id: 'mistique_kamer', name: 'Mistique Kamer' },
  { area_id: 'bad', name: 'Badkamer' },
  { area_id: 'slaapkamer', name: 'Slaapkamer' },
];

async function withStore(raw, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'td-'));
  const file = join(dir, 'preferences.json');
  try {
    if (raw) await writeFile(file, JSON.stringify(raw));
    await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('matchArea matches id or name, ignoring case and separators', () => {
  assert.equal(matchArea(AREAS, 'mistique')?.area_id, undefined);
  assert.equal(matchArea(AREAS, 'mistique', 'Mistique kamer').area_id, 'mistique_kamer');
  assert.equal(matchArea(AREAS, 'badkamer').area_id, 'bad');
  assert.equal(matchArea(AREAS, 'zolder'), null);
});

test('linkLayout links named rooms once and leaves drawings alone', () => {
  const l = linkLayout(defaultLayout(), AREAS);
  const by = Object.fromEntries(l.rooms.map((r) => [r.id, r.areaId]));
  assert.equal(by.living, 'living');
  assert.equal(by.mistique, 'mistique_kamer');
  assert.equal(by.badkamer, 'bad');
  assert.equal(by.trap, null);
  assert.equal(by.terras, null);
  assert.equal(l.linked, true);
  assert.equal(linkLayout(l, AREAS), l);
  assert.equal(linkLayout(defaultLayout(), []).linked, false);
});

test('rekeyComfort moves legacy keys to area ids and keeps unknown keys', () => {
  assert.deepEqual(rekeyComfort({ living: 21, badkamer: 22, zolder: 18 }, AREAS), { living: 21, bad: 22, zolder: 18 });
  assert.deepEqual(rekeyComfort({ bad: 23, badkamer: 22 }, AREAS), { bad: 23 });
  const once = rekeyComfort({ living: 21, badkamer: 22 }, AREAS);
  assert.deepEqual(rekeyComfort(once, AREAS), once);
});

test('store migrates a v1 file, keeps user data and is idempotent', async () => {
  const preset = { id: 'x', name: 'Eigen', icon: 'star', lights: { 'light.a': { on: true } } };
  await withStore({ version: 1, users: { u1: { startTab: 'agenda' } }, household: { comfort: { living: 20 }, sensorLabels: { 'binary_sensor.a': 'Voordeur' }, presets: [preset] } }, async (file) => {
    const s = new Store(file, quiet);
    await s.load();
    const h = s.getHousehold();
    assert.deepEqual(h.comfort, { living: 20, slaapkamer: 19, badkamer: 22 });
    assert.equal(h.sensorLabels['binary_sensor.a'], 'Voordeur');
    assert.ok(Object.keys(h.sensorLabels).length > 1);
    assert.deepEqual(h.presets, [preset]);
    assert.equal(h.layout.linked, false);
    assert.equal(h.layout.rooms.length, defaultLayout().rooms.length);
    assert.equal(s.getUser('u1').startTab, 'agenda');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).version, 2);

    assert.equal(await s.linkAreas(AREAS.map((a) => ({ id: a.area_id, name: a.name }))), true);
    assert.deepEqual(s.getHousehold().comfort, { living: 20, slaapkamer: 19, bad: 22 });
    assert.equal(s.getHousehold().layout.rooms.find((r) => r.id === 'badkamer').areaId, 'bad');
    assert.equal(await s.linkAreas(AREAS.map((a) => ({ id: a.area_id, name: a.name }))), false);

    const again = new Store(file, quiet);
    await again.load();
    assert.deepEqual(again.getHousehold(), s.getHousehold());
    assert.equal(await again.linkAreas(AREAS.map((a) => ({ id: a.area_id, name: a.name }))), false);
  });
});

test('missing file gives migrated defaults', async () => {
  await withStore(null, async (file) => {
    const s = new Store(file, quiet);
    await s.load();
    const h = s.getHousehold();
    assert.equal(h.comfort.living, 21);
    assert.ok(h.presets.length > 0);
    assert.equal(h.layout.rooms.length, 9);
  });
});

test('invalid stored layout falls back to the default', async () => {
  await withStore({ version: 2, users: {}, household: { layout: { viewBox: 'x' } } }, async (file) => {
    const s = new Store(file, quiet);
    await s.load();
    assert.equal(s.getHousehold().layout.rooms.length, 9);
  });
});

test('setHousehold never overwrites the layout, setLayout validates', async () => {
  await withStore(null, async (file) => {
    const s = new Store(file, quiet);
    await s.load();
    const before = s.getHousehold().layout;
    await s.setHousehold({ ...s.getHousehold(), layout: { viewBox: [0, 0, 100, 100], rooms: [] } });
    assert.deepEqual(s.getHousehold().layout, before);
    await assert.rejects(s.setLayout({ viewBox: [0, 0, 1, 1] }));
    assert.deepEqual(s.getHousehold().layout, before);
    await s.setLayout({ viewBox: [0, 0, 200, 200], rooms: [{ id: 'a', areaId: 'living', rect: [0, 0, 50, 50] }] });
    assert.equal(s.getHousehold().layout.rooms.length, 1);
    assert.equal(s.getHousehold().layout.linked, true);
  });
});

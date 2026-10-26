import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLayout, doorGeometry, shellRect, overlappingRooms } from '../shared/layout.js';
import { defaultLayout } from '../shared/default-layout.js';

const base = () => ({
  viewBox: [0, 0, 300, 520],
  rooms: [{ id: 'a', areaId: 'living', name: '', icon: 'sofa', rect: [10, 10, 100, 100], floor: 'wood' }],
  doors: [{ id: 'd1', x: 20, y: 105, wall: 'h', size: 20 }],
  windows: [{ id: 'w1', rect: [20, 4, 40, 6] }],
});

test('default layout validates unchanged', () => {
  const d = defaultLayout();
  const v = validateLayout(d);
  assert.deepEqual(v.rooms, d.rooms);
  assert.deepEqual(v.doors, d.doors);
  assert.deepEqual(v.windows, d.windows);
  assert.deepEqual(v.decor, d.decor);
  assert.equal(v.linked, true);
  assert.equal(d.linked, false);
  assert.deepEqual(overlappingRooms(d), []);
});

test('fills defaults and rounds numbers', () => {
  const v = validateLayout({ ...base(), rooms: [{ id: 'a', rect: ['10.04', 10, 100, 100] }] });
  assert.deepEqual(v.rooms[0], { id: 'a', areaId: null, name: '', icon: 'home', rect: [10, 10, 100, 100], floor: 'plain', furniture: null });
  assert.equal(validateLayout(base()).doors[0].swing, 'in');
});

test('rejects invalid input', () => {
  const bad = [
    null,
    [],
    { ...base(), viewBox: [0, 0, 10, 10] },
    { ...base(), viewBox: [0, 0, 'x', 500] },
    { ...base(), rooms: [{ id: 'a', rect: [10, 10, 100, NaN] }] },
    { ...base(), rooms: [{ id: 'a', rect: [250, 10, 100, 100] }] },
    { ...base(), rooms: [{ id: 'a', rect: [10, 10, 2, 100] }] },
    { ...base(), rooms: [{ id: 'a', rect: [10, 10, 100, 100], icon: 'rocket' }] },
    { ...base(), rooms: [{ id: 'a', rect: [10, 10, 100, 100], floor: 'lava' }] },
    { ...base(), rooms: [{ id: 'a b', rect: [10, 10, 100, 100] }] },
    { ...base(), rooms: [{ id: 'a', rect: [10, 10, 50, 50] }, { id: 'a', rect: [80, 80, 50, 50] }] },
    { ...base(), rooms: [{ id: 'a', areaId: 'x', rect: [10, 10, 50, 50] }, { id: 'b', areaId: 'x', rect: [80, 80, 50, 50] }] },
    { ...base(), rooms: [{ id: 'a', name: 'x'.repeat(41), rect: [10, 10, 50, 50] }] },
    { ...base(), doors: [{ id: 'd', x: 20, y: 20, wall: 'd', size: 20 }] },
    { ...base(), doors: [{ id: 'd', x: 20, y: 20, wall: 'h', size: 200 }] },
    { ...base(), doors: [{ id: 'd', x: 20, y: 600, wall: 'h', size: 20 }] },
    { ...base(), doors: [{ id: 'd', x: 20, y: 20, wall: 'h', size: 20, swing: 'up' }] },
    { ...base(), windows: [{ id: 'w', rect: [0, 0, 1, 1] }] },
    { ...base(), rooms: Array.from({ length: 51 }, (_, i) => ({ id: `r${i}`, rect: [0, 0, 10, 10] })) },
    { ...base(), rooms: 'x' },
  ];
  for (const l of bad) assert.throws(() => validateLayout(l), Error, JSON.stringify(l)?.slice(0, 80));
});

test('error messages are Dutch', () => {
  assert.throws(() => validateLayout({ ...base(), rooms: [{ id: 'a', name: 'Living', rect: [250, 10, 100, 100] }] }), /Ruimte Living ligt buiten het plan/);
});

test('door geometry reproduces the hand-drawn arcs', () => {
  const paths = defaultLayout().doors.map((d) => doorGeometry(d).path);
  assert.deepEqual(paths.slice(0, 6), [
    'M66 180 v20 A20 20 0 0 0 86 180',
    'M130 176 v-20 A20 20 0 0 0 110 176',
    'M156 196 h20 A20 20 0 0 1 156 216',
    'M112 272 v20 A20 20 0 0 0 132 272',
    'M68 272 v20 A20 20 0 0 0 88 272',
    'M256 50 v24 A24 24 0 0 1 232 50',
  ]);
  assert.equal(paths[6], null);
  assert.deepEqual(doorGeometry({ x: 57, y: 200, wall: 'v', size: 40, swing: 'none' }).gap, [57, 200, 6, 40]);
});

test('shell wraps indoor rooms only', () => {
  assert.deepEqual(shellRect(defaultLayout().rooms), [0, 44, 300, 476]);
  assert.equal(shellRect([{ floor: 'deck', rect: [0, 0, 10, 10] }]), null);
});

test('overlapping rooms are reported', () => {
  assert.deepEqual(overlappingRooms({ rooms: [{ id: 'a', rect: [0, 0, 10, 10] }, { id: 'b', rect: [5, 5, 10, 10] }, { id: 'c', rect: [10, 0, 5, 5] }] }), [['a', 'b']]);
});

const ROOMS = [
  ['terras', 'Terras', 'terrace', [0, 0, 300, 44], 'deck', 'terrace'],
  ['mistique', 'Mistique kamer', 'mistique', [6, 50, 92, 126], 'wood', 'mistique'],
  ['slaapkamer', 'Slaapkamer', 'bed', [102, 50, 192, 126], 'wood', 'bedroom'],
  ['trap', '', 'stair', [6, 180, 52, 88], 'stair', null],
  ['hall', 'Hall', 'hall', [62, 180, 90, 88], 'plain', null],
  ['bergplaats', 'Bergplaats', 'storage', [156, 180, 138, 88], 'plain', 'storage'],
  ['badkamer', 'Badkamer', 'shower', [6, 272, 86, 104], 'tile', 'bathroom'],
  ['keuken', 'Keuken', 'kitchen', [6, 380, 86, 134], 'tile', 'kitchen'],
  ['living', 'Living', 'sofa', [96, 272, 198, 242], 'wood', 'living'],
];
const DOORS = [
  [66, 175, 'h', 20, 6, 'in', 'start'],
  [110, 175, 'h', 20, 6, 'out', 'end'],
  [151, 196, 'v', 20, 6, 'in', 'start'],
  [112, 267, 'h', 20, 6, 'in', 'start'],
  [68, 267, 'h', 20, 6, 'in', 'start'],
  [232, 43, 'h', 24, 8, 'in', 'end'],
  [57, 200, 'v', 40, 6, 'none', 'start'],
  [91, 410, 'v', 60, 6, 'none', 'start'],
];
const WINDOWS = [[18, 44, 64, 6], [116, 44, 96, 6], [294, 70, 6, 86], [294, 330, 6, 150], [140, 514, 130, 6], [18, 514, 56, 6], [294, 196, 6, 50]];

/** Layout of the apartment as it was hard-coded up to 0.6.x (areas not linked yet). */
export function defaultLayout() {
  return {
    version: 1,
    linked: false,
    viewBox: [0, 0, 300, 520],
    rooms: ROOMS.map(([id, name, icon, rect, floor, furniture]) => ({ id, areaId: null, name, icon, rect: [...rect], floor, furniture })),
    doors: DOORS.map(([x, y, wall, size, thick, swing, hinge], i) => ({ id: `d${i + 1}`, x, y, wall, size, thick, swing, hinge })),
    windows: WINDOWS.map((rect, i) => ({ id: `w${i + 1}`, rect: [...rect] })),
    decor: [
      { id: 'rail', kind: 'rail', x: 0, y: 2, w: 300 },
      { id: 'plant1', kind: 'plant', x: 16, y: 18 },
      { id: 'plant2', kind: 'plant', x: 284, y: 18 },
    ],
  };
}

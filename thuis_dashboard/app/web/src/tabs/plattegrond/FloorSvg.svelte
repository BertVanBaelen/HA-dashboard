<script>
  // Schematic drawing of the apartment. Coordinates match FLOORPLAN.viewBox / FLOORPLAN_ROOMS in shared/config.js.
  const floors = [
    { id: 'mistique', x: 6, y: 50, w: 92, h: 126, kind: 'wood' },
    { id: 'slaapkamer', x: 102, y: 50, w: 192, h: 126, kind: 'wood' },
    { id: 'trap', x: 6, y: 180, w: 52, h: 88, kind: 'stair' },
    { id: 'hall', x: 62, y: 180, w: 90, h: 88, kind: 'plain' },
    { id: 'bergplaats', x: 156, y: 180, w: 138, h: 88, kind: 'plain' },
    { id: 'badkamer', x: 6, y: 272, w: 86, h: 104, kind: 'tile' },
    { id: 'keuken', x: 6, y: 380, w: 86, h: 134, kind: 'tile' },
    { id: 'living', x: 96, y: 272, w: 198, h: 242, kind: 'wood' },
  ];
  // Gaps in the walls: [x, y, w, h]
  const openings = [
    [66, 175, 20, 6], [110, 175, 20, 6], [151, 196, 6, 20], [112, 267, 20, 6], [68, 267, 20, 6],
    [232, 43, 24, 8], [57, 200, 6, 40], [91, 410, 6, 60],
  ];
  const doors = [
    'M66 180 v20 A20 20 0 0 0 86 180',
    'M130 176 v-20 A20 20 0 0 0 110 176',
    'M156 196 h20 A20 20 0 0 1 156 216',
    'M112 272 v20 A20 20 0 0 0 132 272',
    'M68 272 v20 A20 20 0 0 0 88 272',
    'M256 50 v24 A24 24 0 0 1 232 50',
  ];
  // Windows on the outer walls: [x, y, w, h]
  const windows = [
    [18, 44, 64, 6], [116, 44, 96, 6], [294, 70, 6, 86], [294, 330, 6, 150], [140, 514, 130, 6], [18, 514, 56, 6], [294, 196, 6, 50],
  ];
  const stairs = Array.from({ length: 10 }, (_, i) => 186 + i * 8);
  const planks = Array.from({ length: 29 }, (_, i) => 10 + i * 10);
</script>

<svg class="floor" viewBox="0 0 300 520" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs>
    <pattern id="fp-tile" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" class="f-tile" />
      <path d="M10 0V10H0" class="tile-line" />
    </pattern>
    <pattern id="fp-wood" width="60" height="9" patternUnits="userSpaceOnUse">
      <rect width="60" height="9" class="f-wood" />
      <path d="M0 9H60M22 0V9M52 0V4.5" class="wood-line" />
    </pattern>
  </defs>

  <!-- Terras -->
  <rect x="0" y="0" width="300" height="44" class="f-deck" />
  {#each planks as x (x)}<line x1={x} y1="4" x2={x} y2="44" class="deck-line" />{/each}
  <line x1="0" y1="2" x2="300" y2="2" class="rail" />
  <circle cx="16" cy="18" r="7" class="plant" /><circle cx="284" cy="18" r="7" class="plant" />
  <rect x="120" y="12" width="34" height="20" rx="4" class="furn" />
  <circle cx="114" cy="22" r="5" class="furn" /><circle cx="160" cy="22" r="5" class="furn" />

  <!-- Building shell = walls -->
  <rect x="0" y="44" width="300" height="476" rx="2" class="wall" />
  {#each floors as f (f.id)}
    <rect x={f.x} y={f.y} width={f.w} height={f.h} class="floor-{f.kind}" fill={f.kind === 'tile' ? 'url(#fp-tile)' : f.kind === 'wood' ? 'url(#fp-wood)' : undefined} />
  {/each}
  {#each openings as [x, y, w, h], i (i)}<rect {x} {y} width={w} height={h} class="floor-plain" />{/each}
  {#each windows as [x, y, w, h], i (i)}
    <rect {x} {y} width={w} height={h} class="win" />
    {#if w > h}<line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} class="win-line" />{:else}<line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} class="win-line" />{/if}
  {/each}
  {#each doors as d, i (i)}<path {d} class="door" />{/each}

  <!-- Trap -->
  {#each stairs as y (y)}<line x1="10" y1={y} x2="54" y2={y} class="stair" />{/each}
  <path d="M32 262 V190 M27 196 L32 189 L37 196" class="stair-arrow" />

  <!-- Mistique kamer -->
  <rect x="12" y="140" width="46" height="20" rx="3" class="furn" />
  <circle cx="35" cy="128" r="7" class="furn" />
  <rect x="70" y="60" width="22" height="40" rx="3" class="furn" />

  <!-- Slaapkamer -->
  <rect x="150" y="62" width="74" height="88" rx="5" class="furn" />
  <rect x="156" y="68" width="29" height="16" rx="4" class="furn soft" />
  <rect x="189" y="68" width="29" height="16" rx="4" class="furn soft" />
  <path d="M150 96 H224" class="furn-line" />
  <rect x="130" y="64" width="14" height="14" rx="3" class="furn" />
  <rect x="230" y="64" width="14" height="14" rx="3" class="furn" />
  <rect x="270" y="90" width="18" height="70" rx="2" class="furn" />

  <!-- Bergplaats -->
  <rect x="266" y="186" width="22" height="76" rx="2" class="furn" />
  {#each [204, 222, 240] as y (y)}<line x1="266" y1={y} x2="288" y2={y} class="furn-line" />{/each}

  <!-- Badkamer -->
  <rect x="10" y="300" width="32" height="70" rx="12" class="furn" />
  <rect x="15" y="306" width="22" height="58" rx="9" class="furn soft" />
  <rect x="58" y="296" width="28" height="16" rx="5" class="furn" />
  <circle cx="72" cy="304" r="4" class="furn-line" />
  <ellipse cx="78" cy="356" rx="7" ry="9" class="furn" />
  <rect x="70" y="366" width="16" height="7" rx="2" class="furn" />

  <!-- Keuken -->
  <rect x="6" y="386" width="20" height="128" class="furn" />
  <rect x="26" y="494" width="62" height="20" class="furn" />
  {#each [[16, 404], [16, 420]] as [cx, cy] (cy)}<circle {cx} {cy} r="5" class="furn-line" />{/each}
  <rect x="9" y="446" width="14" height="22" rx="3" class="furn soft" />
  <rect x="42" y="420" width="30" height="44" rx="4" class="furn" />

  <!-- Living -->
  <rect x="200" y="280" width="72" height="6" rx="2" class="furn dark" />
  <rect x="180" y="362" width="104" height="80" rx="10" class="rug" />
  <rect x="206" y="384" width="52" height="28" rx="6" class="furn" />
  <path d="M176 470 H286 V500 H176 Z M176 470 V500 M286 470 V500" class="furn" />
  <rect x="180" y="474" width="102" height="10" rx="4" class="furn soft" />
  <rect x="110" y="410" width="40" height="70" rx="5" class="furn" />
  {#each [[104, 424], [104, 446], [104, 468], [156, 424], [156, 446], [156, 468]] as [cx, cy], i (i)}<circle {cx} {cy} r="4.5" class="furn" />{/each}
  <circle cx="282" cy="296" r="7" class="plant" />
</svg>

<style>
  .floor {
    --wall: #3a4256; --wood: #f4ede1; --wood-line: #e6dccb; --tile: #eef2f6; --tile-line: #dde4ec; --plain: #f1efe9;
    --deck: #e3ead8; --deck-line: #cfd9c1; --furn: #ffffff; --furn-stroke: #b6b1a6; --win: #bfe0f5; --door: #9aa3b5; --rug: #e9dfcf; --plant: #9fcf8a;
    position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: -2; pointer-events: none;
  }
  :global([data-mode='dark']) .floor {
    --wall: #8796b8; --wood: #232b40; --wood-line: #2a3349; --tile: #1f2739; --tile-line: #283146; --plain: #222a3d;
    --deck: #1d2a2a; --deck-line: #253434; --furn: #2c354d; --furn-stroke: #4a5574; --win: #3b6d96; --door: #64708d; --rug: #2a3248; --plant: #3f7a4c;
  }
  .wall { fill: var(--wall); }
  .floor-wood { fill: var(--wood); }
  .floor-tile { fill: var(--tile); }
  .floor-plain, .floor-stair { fill: var(--plain); }
  .f-wood { fill: var(--wood); }
  .f-tile { fill: var(--tile); }
  .wood-line { stroke: var(--wood-line); stroke-width: 0.6; fill: none; }
  .tile-line { stroke: var(--tile-line); stroke-width: 0.6; fill: none; }
  .f-deck { fill: var(--deck); }
  .deck-line { stroke: var(--deck-line); stroke-width: 1; }
  .rail { stroke: var(--wall); stroke-width: 2; stroke-dasharray: 2 4; }
  .win { fill: var(--win); }
  .win-line { stroke: var(--wall); stroke-width: 0.8; opacity: 0.5; }
  .door { fill: none; stroke: var(--door); stroke-width: 1; stroke-dasharray: 3 2; }
  .stair { stroke: var(--furn-stroke); stroke-width: 1; }
  .stair-arrow { fill: none; stroke: var(--door); stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
  .furn { fill: var(--furn); stroke: var(--furn-stroke); stroke-width: 1; }
  .furn.soft { fill: color-mix(in srgb, var(--furn-stroke) 18%, var(--furn)); }
  .furn.dark { fill: var(--wall); stroke: none; }
  .furn-line { fill: none; stroke: var(--furn-stroke); stroke-width: 1; }
  .rug { fill: var(--rug); opacity: 0.8; }
  .plant { fill: var(--plant); opacity: 0.85; }
</style>

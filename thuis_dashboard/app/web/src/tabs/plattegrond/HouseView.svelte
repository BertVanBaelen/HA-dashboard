<script>
  import { fade } from 'svelte/transition';
  import { HOME } from '$shared/config.js';
  import { states } from '../../lib/api.js';
  import { css } from '../verlichting/color.js';
  import RoomBadge from './RoomBadge.svelte';
  import SolarSun from './SolarSun.svelte';

  /**
   * House-shaped view of the rooms (same room buttons as the floor plan).
   * @type {{ rooms: import('./summary.js').PlanRoom[], sums: Record<string, any>, selectedId?: string|null, onselect: (r: import('./summary.js').PlanRoom) => void, describe: (s: any) => string }}
   */
  let { rooms, sums, selectedId = null, onselect, describe } = $props();

  const VW = 360;
  const BASE_H = 176;
  const PAD = 8;
  const GAP = 6;
  // Minimum floor height so a full badge (name, temperature, indicators) fits.
  const MIN_ROW = 80;

  const rows = $derived(rooms.length > 1 ? Math.ceil(rooms.length / 2) : 1);
  // The house grows taller when there are many floors; ground and tree move down with it.
  const extra = $derived(Math.max(0, rows * MIN_ROW + GAP * (rows - 1) + PAD * 2 - BASE_H));
  const VH = $derived(320 + extra);
  const WALL = $derived({ x: 36, y: 118, w: 288, h: BASE_H + extra });

  // One or two rooms per floor; with an odd count the top floor gets a single, full-width room.
  const slots = $derived.by(() => {
    const n = rooms.length;
    if (!n) return [];
    const cols = n === 1 ? 1 : 2;
    const firstFull = n > 1 && n % 2 === 1;
    const iw = WALL.w - PAD * 2;
    const rh = (WALL.h - PAD * 2 - GAP * (rows - 1)) / rows;
    const half = (iw - GAP) / 2;
    const out = [];
    let i = 0;
    for (let row = 0; row < rows; row++) {
      const y = WALL.y + PAD + row * (rh + GAP);
      const perRow = cols === 1 || (row === 0 && firstFull) ? 1 : 2;
      for (let c = 0; c < perRow && i < n; c++, i++) {
        const w = perRow === 1 ? iw : half;
        out.push({ room: rooms[i], rect: [WALL.x + PAD + c * (half + GAP), y, w, rh] });
      }
    }
    return out;
  });

  const pct = (/** @type {number} */ v, /** @type {number} */ total) => `${((v / total) * 100).toFixed(3)}%`;
  const box = (/** @type {number[]} */ r) => `left:${pct(r[0], VW)};top:${pct(r[1], VH)};width:${pct(r[2], VW)};height:${pct(r[3], VH)}`;
  const compact = (/** @type {number[]} */ r) => r[3] < 62 || r[2] < 96;

  const sunS = $derived($states[HOME.sun]);
  const night = $derived(sunS ? sunS.state === 'below_horizon' : (() => { const h = new Date().getHours(); return h < 7 || h >= 21; })());
  const anyHeating = $derived(rooms.some((r) => sums[r.id]?.heating));
</script>

<div class="house no-swipe" class:night style="aspect-ratio:{VW} / {VH}" role="group" aria-label="Huisje met alle ruimtes">
  <svg viewBox="0 0 {VW} {VH}" aria-hidden="true">
    <defs>
      <linearGradient id="hv-roof" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" class="roof-a" />
        <stop offset="100%" class="roof-b" />
      </linearGradient>
    </defs>

    {#if night}
      <g transition:fade={{ duration: 600 }}>
        {#each [[20, 22], [104, 16], [130, 52], [300, 24], [340, 60], [16, 90]] as [x, y], i (i)}
          <circle cx={x} cy={y} r={i % 2 ? 1.2 : 1.8} class="star" style="animation-delay:{i * 0.41}s" />
        {/each}
      </g>
    {/if}
    <SolarSun cx={52} cy={46} id="hv-sun" labelGap={16} />

    <g transform="translate(0 {extra})">
      <path d="M0 296 Q 90 284 180 294 T {VW} 292 V320 H0Z" class="ground" />
      <g class="tree">
        <rect x="14" y="262" width="4" height="34" rx="2" class="trunk" />
        <circle cx="16" cy="256" r="11" class="leaf" />
        <circle cx="10" cy="266" r="7" class="leaf" />
        <circle cx="23" cy="265" r="7" class="leaf" />
      </g>
      <circle cx="340" cy="288" r="8" class="leaf" />
    </g>

    <rect x="258" y="44" width="18" height="60" rx="2" class="chimney" />
    {#if anyHeating}
      <g class="smoke" transition:fade>
        <circle cx="267" cy="38" r="5" style="animation-delay:0s" />
        <circle cx="267" cy="38" r="6" style="animation-delay:1s" />
        <circle cx="267" cy="38" r="5" style="animation-delay:2s" />
      </g>
    {/if}

    <rect x={WALL.x} y={WALL.y} width={WALL.w} height={WALL.h} class="wall" />
    <path d="M22 121 L180 26 L338 121 Z" fill="url(#hv-roof)" class="roof" />
    <circle cx="180" cy="86" r="11" class="attic" />
    <path d="M180 75 V97 M169 86 H191" class="attic-line" />
  </svg>

  {#each slots as { room: r, rect } (r.id)}
    {@const s = sums[r.id]}
    <button
      class="room"
      class:sel={selectedId === r.id}
      class:lit={s.lightsOn > 0}
      class:heating={s.heating}
      class:alert={s.openCount > 0}
      style="{box(rect)};--lamp:{s.lampColor ? css(s.lampColor) : 'transparent'};--lvl:{s.lampLevel}"
      aria-label="{r.name}: {describe(s)}"
      onclick={() => onselect(r)}
    >
      <span class="glow"></span>
      <RoomBadge room={r} {s} compact={compact(rect)} />
    </button>
  {/each}
</div>

<style>
  .house {
    position: relative; overflow: hidden; isolation: isolate; width: 100%;
    border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow);
    background: linear-gradient(180deg, color-mix(in srgb, #38bdf8 26%, var(--surface)) 0%, color-mix(in srgb, #7dd3fc 10%, var(--surface)) 80%);
    user-select: none; -webkit-user-select: none; transition: background 1s;
  }
  .house.night { background: linear-gradient(180deg, color-mix(in srgb, #1e1b4b 70%, var(--surface)) 0%, color-mix(in srgb, #312e81 30%, var(--surface)) 80%); }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: -2; pointer-events: none; }

  .star { fill: #fef9c3; animation: twinkle 6s ease-in-out infinite; }

  .ground { fill: color-mix(in srgb, #22c55e 28%, var(--surface-solid)); }
  .night .ground { fill: color-mix(in srgb, #14532d 45%, var(--surface-solid)); }
  .trunk { fill: color-mix(in srgb, #92400e 70%, var(--surface-solid)); }
  .leaf { fill: color-mix(in srgb, #16a34a 70%, var(--surface-solid)); }

  .chimney { fill: color-mix(in srgb, #9a3412 55%, var(--surface-solid)); }
  .smoke circle { fill: color-mix(in srgb, var(--text-3) 45%, transparent); opacity: 0; animation: smoke 3s ease-out infinite; transform-box: fill-box; transform-origin: center; }

  .wall { fill: color-mix(in srgb, #f59e0b 8%, var(--surface-solid)); stroke: var(--border); stroke-width: 1.5; }
  .roof { stroke: color-mix(in srgb, #7c2d12 40%, transparent); stroke-width: 1.5; stroke-linejoin: round; }
  .roof-a { stop-color: color-mix(in srgb, #c2410c 75%, var(--surface-solid)); }
  .roof-b { stop-color: color-mix(in srgb, #9a3412 75%, var(--surface-solid)); }
  .attic { fill: color-mix(in srgb, #7dd3fc 45%, var(--surface-solid)); stroke: rgba(255, 255, 255, 0.55); stroke-width: 2; }
  .night .attic { fill: color-mix(in srgb, #1e293b 80%, var(--surface-solid)); }
  .attic-line { stroke: rgba(255, 255, 255, 0.55); stroke-width: 1.5; }

  .room {
    position: absolute; z-index: 0; display: grid; place-items: center; padding: 3px; margin: 0; cursor: pointer; overflow: hidden;
    container: room / size;
    background: color-mix(in srgb, #7dd3fc 14%, var(--surface-2)); color: var(--text);
    border: 2px solid color-mix(in srgb, var(--text-3) 35%, transparent); border-radius: 8px;
    box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--surface-solid) 55%, transparent);
    transition: background 0.35s var(--ease), border-color 0.3s, box-shadow 0.4s var(--ease);
    -webkit-tap-highlight-color: transparent;
  }
  .night .room { background: color-mix(in srgb, #0f172a 55%, var(--surface-2)); }
  .room:hover, .room:focus-visible { border-color: color-mix(in srgb, var(--accent) 60%, transparent); outline: none; }
  .room:active :global(.badge) { transform: scale(0.94); }
  .room.sel { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .room.heating { background: color-mix(in srgb, var(--heat) 16%, var(--surface-2)); }
  .room.alert { border-color: color-mix(in srgb, var(--danger) 70%, transparent); border-style: dashed; }
  .glow {
    position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; opacity: 0;
    background: radial-gradient(circle at 50% 50%, var(--lamp), transparent 75%);
    transition: opacity 0.7s var(--ease);
  }
  .room.lit .glow { opacity: calc(0.35 + var(--lvl) * 0.5); animation: breathe 4s ease-in-out infinite; }

  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
  @keyframes smoke { 0% { opacity: 0; transform: translate(0, 0) scale(0.6); } 20% { opacity: 0.8; } 100% { opacity: 0; transform: translate(10px, -28px) scale(1.8); } }
  @media (prefers-reduced-motion: reduce) {
    .room.lit .glow, .star, .smoke circle { animation: none; }
  }
</style>

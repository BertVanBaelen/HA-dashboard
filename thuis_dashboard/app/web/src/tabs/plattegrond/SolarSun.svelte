<svelte:options namespace="svg" />

<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { HOME } from '$shared/config.js';
  import { states, unavailable } from '../../lib/api.js';

  /**
   * Solar-driven sun (or moon at night) like the one on the Klimaat tab; render inside an <svg>.
   * @type {{ cx: number, cy: number, id: string, label?: boolean, labelGap?: number, labelSide?: 'below'|'left', scale?: number }}
   */
  let { cx, cy, id, label = true, labelGap = 24, labelSide = 'below', scale = 1 } = $props();

  const toNum = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const solarS = $derived($states[HOME.solar]);
  const solar = $derived(unavailable(solarS) ? null : Math.max(0, Math.min(100, toNum(solarS?.state) ?? 0)));
  const sunS = $derived($states[HOME.sun]);
  const night = $derived(sunS ? sunS.state === 'below_horizon' : (() => { const h = new Date().getHours(); return h < 7 || h >= 21; })());

  const sunT = new Tween(0, { duration: 1400, easing: cubicOut });
  $effect(() => {
    sunT.target = night ? 0 : (solar ?? 30) / 100;
  });
  const b = $derived(sunT.current);
  const r = $derived(14 + 8 * b);
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
</script>

<defs>
  <radialGradient id="{id}-glow">
    <stop offset="0%" stop-color="#fde68a" stop-opacity="0.95" />
    <stop offset="45%" stop-color="#fbbf24" stop-opacity="0.35" />
    <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
  </radialGradient>
  <mask id="{id}-moon">
    <rect x={cx - 40} y={cy - 40} width="80" height="80" fill="white" />
    <circle cx={cx + 10} cy={cy - 8} r="15" fill="black" />
  </mask>
</defs>

<g transform="translate({cx} {cy}) scale({scale}) translate({-cx} {-cy})">
{#if night}
  <g transition:fade={{ duration: 600 }}>
    <circle {cx} {cy} r="34" fill="url(#{id}-glow)" opacity="0.25" />
    <circle {cx} {cy} r="16" class="moon" mask="url(#{id}-moon)" />
  </g>
{:else}
  <g transition:fade={{ duration: 600 }}>
    <circle {cx} {cy} r={r * 2.6} fill="url(#{id}-glow)" opacity={0.25 + 0.75 * b} class="halo" />
    <g class="rays" style="opacity:{0.25 + 0.75 * b};transform-origin:{cx}px {cy}px">
      {#each rays as deg (deg)}
        <line x1={cx} y1={cy - r - 5} x2={cx} y2={cy - r - 7 - 12 * b} transform="rotate({deg} {cx} {cy})" />
      {/each}
    </g>
    <circle {cx} {cy} {r} class="sun" style="opacity:{0.55 + 0.45 * b}" />
  </g>
{/if}

{#if night || (solar ?? 0) < 70}
  <g class="cloud" style="opacity:{night ? 0.35 : Math.min(0.95, 1.15 - b)}" transition:fade={{ duration: 800 }}>
    <path transform="translate({cx - 38} {cy - 72})" d="M40 82 a12 12 0 0 1 12-12 a16 16 0 0 1 30 4 a10 10 0 0 1 4 20 h-42 a9 9 0 0 1 -4-12z" />
  </g>
{/if}
</g>

{#if label}
  {@const text = night ? 'Nacht' : solar == null ? 'Zon –' : `Zon ${Math.round(solar)}%`}
  {#if labelSide === 'left'}
    <text x={cx - ((night ? 16 : r) + 6) * scale - labelGap} y={cy + 3.5} text-anchor="end" class="lbl">{text}</text>
  {:else}
    <text x={cx} y={cy + ((night ? 16 : r) + labelGap) * scale} text-anchor="middle" class="lbl">{text}</text>
  {/if}
{/if}

<style>
  .halo { animation: breathe 5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  .rays { stroke: #fbbf24; stroke-width: 3; stroke-linecap: round; animation: spin 30s linear infinite; transition: opacity 1s; }
  .sun { fill: #fbbf24; filter: drop-shadow(0 0 8px #fbbf24); transition: opacity 1s; }
  .moon { fill: #fef3c7; filter: drop-shadow(0 0 8px rgba(254, 243, 199, 0.6)); }
  .cloud { transition: opacity 1.2s; animation: drift 14s ease-in-out infinite alternate; }
  .cloud path { fill: color-mix(in srgb, var(--surface-solid) 85%, #94a3b8); }
  :global(.night) .cloud path { fill: color-mix(in srgb, #64748b 60%, var(--surface-solid)); }
  .lbl { font-size: 10px; font-weight: 800; fill: var(--text-2); letter-spacing: 0.02em; }

  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes drift { from { transform: translateX(-6px); } to { transform: translateX(10px); } }
  @media (prefers-reduced-motion: reduce) {
    .halo, .rays, .cloud { animation: none; }
  }
</style>

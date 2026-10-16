<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { mdiLightningBolt } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ soc: number|null, charging?: boolean, target?: number|null, size?: number }} */
  let { soc, charging = false, target = null, size = 210 } = $props();

  const uid = $props.id();
  const stroke = 18;
  const r = $derived((size - stroke) / 2);
  const C = $derived(2 * Math.PI * r);
  const value = Tween.of(() => (Number.isFinite(soc) ? Math.max(0, Math.min(100, Number(soc))) : 0), { duration: 1400, easing: cubicOut });
  const known = $derived(Number.isFinite(soc));
  const hue = $derived(Math.round(Math.max(0, Math.min(100, value.current)) * 1.25));
  const color = $derived(`hsl(${hue} 78% 48%)`);
  const color2 = $derived(`hsl(${Math.min(140, hue + 25)} 85% 58%)`);
  const targetAngle = $derived(target != null && Number.isFinite(Number(target)) ? (Number(target) / 100) * 360 - 90 : null);
  const offset = $derived(C * (1 - value.current / 100));
</script>

<div class="ring" class:charging style="--rc:{color};--size:{size}px">
  <svg viewBox="0 0 {size} {size}" width={size} height={size} aria-hidden="true">
    <defs>
      <linearGradient id="g-{uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color={color2} />
        <stop offset="100%" stop-color={color} />
      </linearGradient>
      <mask id="m-{uid}">
        <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="#fff" stroke-width={stroke} stroke-linecap="round"
          stroke-dasharray={C} stroke-dashoffset={offset} transform="rotate(-90 {size / 2} {size / 2})" />
      </mask>
    </defs>
    <circle class="track" cx={size / 2} cy={size / 2} {r} fill="none" stroke-width={stroke} />
    {#if known && value.current > 0}
      <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="url(#g-{uid})" stroke-width={stroke} stroke-linecap="round"
        stroke-dasharray={C} stroke-dashoffset={offset} transform="rotate(-90 {size / 2} {size / 2})" />
    {/if}
    {#if charging}
      <g mask="url(#m-{uid})">
        <circle class="flow" cx={size / 2} cy={size / 2} {r} fill="none" stroke-width={stroke} stroke-dasharray="6 22" transform="rotate(-90 {size / 2} {size / 2})" />
      </g>
      {#if targetAngle != null}
        <g transform="rotate({targetAngle} {size / 2} {size / 2})">
          <line class="target" x1={size / 2 + r - stroke / 2 - 4} y1={size / 2} x2={size / 2 + r + stroke / 2 + 4} y2={size / 2} />
        </g>
      {/if}
    {/if}
  </svg>
  <div class="center">
    {#if charging}
      <span class="bolt"><Icon path={mdiLightningBolt} size={size * 0.15} /></span>
    {/if}
    <span class="pct num">{known ? Math.round(value.current) : '–'}<small>%</small></span>
    <span class="tiny muted lbl">{charging ? 'Aan het laden' : 'Batterij'}</span>
  </div>
</div>

<style>
  .ring { position: relative; width: var(--size); height: var(--size); flex: none; filter: drop-shadow(0 14px 30px color-mix(in srgb, var(--rc) 35%, transparent)); }
  svg { display: block; overflow: visible; }
  .track { stroke: var(--surface-3); }
  .flow { stroke: rgba(255, 255, 255, 0.55); animation: flow 1.1s linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -28; } }
  .target { stroke: var(--text); stroke-width: 3; stroke-linecap: round; opacity: 0.7; }
  .charging { animation: breathe 2.6s ease-in-out infinite; }
  @keyframes breathe {
    0%, 100% { filter: drop-shadow(0 14px 30px color-mix(in srgb, var(--rc) 30%, transparent)); }
    50% { filter: drop-shadow(0 10px 44px color-mix(in srgb, var(--rc) 70%, transparent)); }
  }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .pct { font-size: calc(var(--size) * 0.26); font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
  .pct small { font-size: 0.4em; font-weight: 700; color: var(--text-2); margin-left: 2px; }
  .lbl { text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .bolt { color: #facc15; display: grid; place-items: center; animation: bolt 1.4s ease-in-out infinite; filter: drop-shadow(0 0 10px rgba(250, 204, 21, 0.8)); }
  @keyframes bolt {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.25); opacity: 0.75; }
  }
</style>

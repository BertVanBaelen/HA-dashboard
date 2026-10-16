<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { mdiFire, mdiPowerStandby } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ min?: number, max?: number, current?: number|null, target?: number|null, off?: boolean, heating?: boolean, disabled?: boolean, label?: string }} */
  let { min = 12, max = 25, current = null, target = null, off = false, heating = false, disabled = false, label = '' } = $props();

  const uid = $props.id();
  const R = 80;
  const C = 100;
  const START = 135;
  const SWEEP = 270;

  const valid = (v) => v != null && Number.isFinite(v);
  const frac = (v) => (!valid(v) ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min))));
  const point = (f, r = R) => {
    const a = ((START + SWEEP * f) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const arcPath = $derived.by(() => {
    const [sx, sy] = point(0);
    const [ex, ey] = point(1);
    return `M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}`;
  });

  const ticks = $derived.by(() => {
    const out = [];
    for (let t = Math.ceil(min); t <= max; t++) {
      const f = frac(t);
      const major = t % 5 === 0;
      const [x1, y1] = point(f, major ? 63 : 66);
      const [x2, y2] = point(f, 70);
      out.push({ t, x1, y1, x2, y2, major });
    }
    return out;
  });

  const setF = new Tween(0, { duration: 900, easing: cubicOut });
  const curF = new Tween(0, { duration: 1200, easing: cubicOut });
  const curN = new Tween(0, { duration: 900, easing: cubicOut });
  $effect(() => {
    setF.target = off ? 0 : frac(target);
  });
  $effect(() => {
    curF.target = frac(current);
    if (valid(current)) curN.target = /** @type {number} */ (current);
  });

  const knob = $derived(point(setF.current));
  const dot = $derived(point(curF.current));
  const heatMix = $derived(Math.round(frac(valid(target) ? target : current) * 100));
  const fmt = (v) => v.toFixed(1).replace('.', ',');
</script>

<div class="gauge" class:off class:heating class:disabled style="--mix:{heatMix}%">
  <svg viewBox="0 0 200 200" aria-label={label} role="img">
    <defs>
      <linearGradient id="g-{uid}" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="180" y2="0">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="35%" stop-color="#818cf8" />
        <stop offset="62%" stop-color="#fbbf24" />
        <stop offset="82%" stop-color="#fb923c" />
        <stop offset="100%" stop-color="#ef4444" />
      </linearGradient>
      <filter id="f-{uid}" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>

    {#each ticks as t (t.t)}
      <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} class="tick" class:major={t.major} />
    {/each}

    <path d={arcPath} class="track" />
    {#if heating && !off}
      <path d={arcPath} class="glow" stroke="url(#g-{uid})" filter="url(#f-{uid})" pathLength="100" stroke-dasharray="{setF.current * 100} 100" />
    {/if}
    <path d={arcPath} class="value" stroke="url(#g-{uid})" pathLength="100" stroke-dasharray="{setF.current * 100} 100" />

    {#if valid(current)}
      <circle cx={dot[0]} cy={dot[1]} r="4" class="cur" />
    {/if}
    {#if !off && valid(target)}
      <circle cx={knob[0]} cy={knob[1]} r="10" class="knob" />
      <circle cx={knob[0]} cy={knob[1]} r="4.5" class="knob-in" />
    {/if}
  </svg>

  <div class="center">
    <div class="state-ic">
      {#if off}
        <Icon path={mdiPowerStandby} size={20} />
      {:else if heating}
        <span class="flame"><Icon path={mdiFire} size={24} /></span>
        <span class="ember e1"></span><span class="ember e2"></span><span class="ember e3"></span>
      {/if}
    </div>
    <div class="temp num">
      {#if valid(current)}{fmt(curN.current)}<small>°</small>{:else}–{/if}
    </div>
    <div class="sub">
      {#if off}Uit{:else if valid(target)}<span class="arrow">→</span> {fmt(/** @type {number} */ (target))}°{:else}–{/if}
    </div>
  </div>
</div>

<style>
  .gauge { position: relative; width: 100%; max-width: 230px; aspect-ratio: 1; margin: 0 auto; container-type: inline-size; }
  svg { width: 100%; height: 100%; overflow: visible; }
  .track { fill: none; stroke: var(--surface-3); stroke-width: 14; stroke-linecap: round; }
  .value { fill: none; stroke-width: 14; stroke-linecap: round; transition: opacity 0.4s, filter 0.4s; }
  .glow { fill: none; stroke-width: 18; stroke-linecap: round; opacity: 0.6; animation: heat-pulse 2.2s ease-in-out infinite; }
  .tick { stroke: var(--text-3); stroke-width: 1; opacity: 0.45; stroke-linecap: round; }
  .tick.major { stroke-width: 2; opacity: 0.8; }
  .cur { fill: var(--text); stroke: var(--surface-solid); stroke-width: 2.5; }
  .knob { fill: var(--surface-solid); stroke: color-mix(in oklab, var(--cool), var(--heat) var(--mix)); stroke-width: 4; filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.25)); transition: stroke 0.6s; }
  .knob-in { fill: color-mix(in oklab, var(--cool), var(--heat) var(--mix)); transition: fill 0.6s; }
  .off .value, .disabled .value { opacity: 0.25; filter: grayscale(1); }

  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; padding-top: 4cqw; }
  .state-ic { height: 28px; position: relative; display: grid; place-items: center; color: var(--text-3); }
  .flame { color: var(--heat); display: block; animation: flicker 1.1s ease-in-out infinite; transform-origin: 50% 90%; filter: drop-shadow(0 0 8px color-mix(in srgb, var(--heat) 70%, transparent)); }
  .ember { position: absolute; bottom: 4px; left: 50%; width: 4px; height: 4px; border-radius: 50%; background: var(--heat); opacity: 0; animation: ember 1.8s ease-out infinite; }
  .e2 { animation-delay: 0.6s; margin-left: -7px; }
  .e3 { animation-delay: 1.2s; margin-left: 6px; }
  .temp { font-size: clamp(1.8rem, 19cqw, 3rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
  .temp small { font-size: 0.45em; font-weight: 600; color: var(--text-2); vertical-align: top; margin-left: 1px; }
  .sub { margin-top: 6px; font-weight: 700; font-size: 0.95rem; color: color-mix(in oklab, var(--cool), var(--heat) var(--mix)); transition: color 0.6s; }
  .off .sub { color: var(--text-3); }
  .arrow { opacity: 0.6; }

  @keyframes heat-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.75; } }
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-2deg); }
    25% { transform: scale(1.12, 0.94) rotate(3deg); }
    50% { transform: scale(0.94, 1.1) rotate(-3deg); }
    75% { transform: scale(1.06) rotate(2deg); }
  }
  @keyframes ember {
    0% { transform: translateY(0) scale(1); opacity: 0; }
    20% { opacity: 0.9; }
    100% { transform: translateY(-26px) scale(0.3); opacity: 0; }
  }
</style>

<script>
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { mdiFire, mdiPowerStandby, mdiMinus, mdiPlus, mdiWaterPercent } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ value?: number|null, min?: number, max?: number, step?: number, current?: number|null, humidity?: number|null, off?: boolean, heating?: boolean, disabled?: boolean, label?: string, debounce?: number, onchange?: (v: number) => void }} */
  let { value = null, min = 10, max = 25, step = 0.5, current = null, humidity = null, off = false, heating = false, disabled = false, label = '', debounce = 800, onchange } = $props();

  const uid = $props.id();
  const R = 88;
  const C = 100;
  const START = 135;
  const SWEEP = 270;

  const valid = (v) => v != null && Number.isFinite(v);
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const snap = (v) => clamp(Math.round(v / step) * step);
  const frac = (v) => (!valid(v) ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min))));
  const point = (f, r = R) => {
    const a = ((START + SWEEP * f) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const fmt = (v) => v.toFixed(1).replace('.', ',');

  const arcPath = $derived.by(() => {
    const [sx, sy] = point(0);
    const [ex, ey] = point(1);
    return `M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}`;
  });
  const ticks = $derived.by(() => {
    const out = [];
    for (let t = Math.ceil(min * 2) / 2; t <= max + 1e-9; t += 0.5) {
      const f = frac(t);
      const whole = Number.isInteger(t);
      const major = whole && t % 5 === 0;
      const [x1, y1] = point(f, major ? 69 : whole ? 72 : 74.5);
      const [x2, y2] = point(f, 78);
      out.push({ t, x1, y1, x2, y2, whole, major });
    }
    return out;
  });

  let local = $state(/** @type {number|null} */ (null));
  let dragging = $state(false);
  let pendingUntil = 0;
  let timer;
  let bump = $state(0);

  const shown = $derived(local ?? (valid(value) ? snap(/** @type {number} */ (value)) : null));
  const active = $derived(!off || local != null);

  $effect(() => {
    value;
    off;
    if (!dragging && !timer && local != null && (Date.now() > pendingUntil || (valid(value) && Math.abs(/** @type {number} */ (value) - local) < 1e-6 && !off))) local = null;
  });

  const angF = new Tween(0, { duration: 700, easing: cubicOut });
  $effect(() => {
    const f = frac(shown);
    if (dragging) angF.set(f, { duration: 0 });
    else angF.target = f;
  });

  const curDot = $derived(valid(current) ? point(frac(current), R) : null);
  const mix = $derived(Math.round(frac(shown) * 100));
  const deg = $derived(START + SWEEP * angF.current);

  function setLocal(v) {
    const s = snap(v);
    if (s !== shown) {
      bump++;
      try { navigator.vibrate?.(6); } catch {}
    }
    local = s;
  }

  function commit() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (local == null) return;
      pendingUntil = Date.now() + 8000;
      onchange?.(local);
      setTimeout(() => {
        if (!dragging && !timer && Date.now() >= pendingUntil - 50) local = null;
      }, 8000);
    }, debounce);
  }

  /** @type {HTMLDivElement} */
  let el;
  let raw = 0;
  let lastAngle = 0;
  let moved = false;

  function angleOf(e) {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return { a: (Math.atan2(dy, dx) * 180) / Math.PI, d: Math.hypot(dx, dy) };
  }

  function down(e) {
    if (disabled || e.button > 0) return;
    e.preventDefault();
    clearTimeout(timer);
    timer = undefined;
    el.setPointerCapture?.(e.pointerId);
    dragging = true;
    moved = false;
    raw = shown ?? (min + max) / 2;
    lastAngle = angleOf(e).a;
  }
  function move(e) {
    if (!dragging) return;
    e.preventDefault();
    const { a, d } = angleOf(e);
    if (d < 14) return;
    let diff = a - lastAngle;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    lastAngle = a;
    raw = Math.min(max, Math.max(min, raw + (diff / SWEEP) * (max - min)));
    if (Math.abs(diff) > 0.2) moved = true;
    setLocal(raw);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (moved && local != null) commit();
  }

  function nudge(d) {
    if (disabled) return;
    setLocal((shown ?? (min + max) / 2) + d * step);
    commit();
  }
  function key(e) {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 4, PageDown: -4, '+': 1, '-': -1 };
    if (e.key in map) {
      e.preventDefault();
      nudge(map[e.key]);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setLocal(e.key === 'Home' ? min : max);
      commit();
    }
  }
</script>

<div class="knob-wrap no-swipe" class:off={!active} class:heating={heating && active} class:dragging class:disabled style="--mix:{mix}%">
  <div
    class="knob"
    bind:this={el}
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={shown ?? undefined}
    aria-valuetext={!active ? 'Uit' : shown != null ? `${fmt(shown)} graden` : undefined}
    aria-disabled={disabled}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onlostpointercapture={up}
    onkeydown={key}
  >
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="g-{uid}" gradientUnits="userSpaceOnUse" x1="12" y1="0" x2="188" y2="0">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="35%" stop-color="#818cf8" />
          <stop offset="62%" stop-color="#fbbf24" />
          <stop offset="82%" stop-color="#fb923c" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
        <filter id="f-{uid}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <path d={arcPath} class="track" />
      {#if heating && active}
        <path d={arcPath} class="glow" stroke="url(#g-{uid})" filter="url(#f-{uid})" pathLength="100" stroke-dasharray="{angF.current * 100} 100" />
      {/if}
      <path d={arcPath} class="value" stroke="url(#g-{uid})" pathLength="100" stroke-dasharray="{angF.current * 100} 100" />

      {#each ticks as t (t.t)}
        <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} class="tick" class:whole={t.whole} class:major={t.major} class:lit={active && shown != null && t.t <= shown + 1e-9} stroke={active && shown != null && t.t <= shown + 1e-9 ? `url(#g-${uid})` : undefined} />
      {/each}

      {#if curDot}
        <circle cx={curDot[0]} cy={curDot[1]} r="4.5" class="cur" />
      {/if}
    </svg>

    <div class="disc" style="transform: translate(-50%, -50%) rotate({deg}deg)">
      <span class="grip"></span>
    </div>

    <div class="center">
      <div class="state-ic">
        {#if !active}
          <Icon path={mdiPowerStandby} size={18} />
        {:else if heating}
          <span class="flame"><Icon path={mdiFire} size={20} /></span>
        {:else}
          <span class="tiny lbl">Doel</span>
        {/if}
      </div>
      <div class="temp num">
        {#if !active}
          <span class="uit">Uit</span>
        {:else if shown != null}
          {#key bump}<span class="val">{fmt(shown)}</span>{/key}<small>°</small>
        {:else}–{/if}
      </div>
      <div class="sub num">
        {#if valid(current)}Nu {fmt(/** @type {number} */ (current))}°{/if}
        {#if valid(humidity)}<span class="hum"><Icon path={mdiWaterPercent} size={13} />{Math.round(/** @type {number} */ (humidity))}%</span>{/if}
      </div>
    </div>
  </div>

  <button class="nb minus" aria-label="Kouder" disabled={disabled || (active && shown != null && shown <= min)} onclick={() => nudge(-1)}><Icon path={mdiMinus} size={20} /></button>
  <button class="nb plus" aria-label="Warmer" disabled={disabled || (active && shown != null && shown >= max)} onclick={() => nudge(1)}><Icon path={mdiPlus} size={20} /></button>
</div>

<style>
  .knob-wrap { position: relative; width: 100%; max-width: 250px; margin: 0 auto; }
  .knob {
    position: relative; width: 100%; aspect-ratio: 1; touch-action: none; user-select: none; -webkit-user-select: none;
    cursor: grab; outline: none; border-radius: 50%; container-type: inline-size;
  }
  .dragging .knob { cursor: grabbing; }
  .disabled .knob { cursor: default; opacity: 0.55; }
  .knob:focus-visible .disc { box-shadow: 0 0 0 3px var(--accent), var(--disc-shadow); }

  svg { width: 100%; height: 100%; overflow: visible; display: block; }
  .track { fill: none; stroke: var(--surface-3); stroke-width: 10; stroke-linecap: round; }
  .value { fill: none; stroke-width: 10; stroke-linecap: round; transition: opacity 0.4s, filter 0.4s; }
  .glow { fill: none; stroke-width: 16; stroke-linecap: round; }
  .off .value { opacity: 0.18; filter: grayscale(1); }
  .tick { stroke-width: 1; opacity: 0.3; stroke-linecap: round; transition: stroke 0.3s, opacity 0.3s; }
  .tick.whole { stroke-width: 1.5; opacity: 0.5; }
  .tick.major { stroke-width: 2.4; opacity: 0.8; }
  .tick.lit { opacity: 0.95; }
  .tick:not(.lit) { stroke: var(--text-3); }
  .cur { fill: var(--text); stroke: var(--surface-solid); stroke-width: 2.5; }

  .disc {
    --disc-shadow: 0 14px 28px -10px rgba(0, 0, 0, 0.35), inset 0 2px 1px rgba(255, 255, 255, 0.35), inset 0 -3px 8px rgba(0, 0, 0, 0.12);
    position: absolute; left: 50%; top: 50%; width: 64%; aspect-ratio: 1; border-radius: 50%;
    background:
      radial-gradient(circle at 50% 50%, var(--surface-solid) 0 74%, transparent 75%),
      repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--text) 10%, transparent) 0 2deg, transparent 2deg 6deg),
      linear-gradient(160deg, var(--surface-solid), var(--surface-3));
    border: 1px solid var(--border);
    box-shadow: var(--disc-shadow);
    transition: box-shadow 0.4s, scale 0.35s var(--spring);
  }
  .disc::before {
    content: ''; position: absolute; inset: 13%; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--surface-solid) 85%, white), var(--surface-solid) 60%, var(--surface-2));
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.12);
  }
  .grip {
    position: absolute; right: 4%; top: 50%; width: 11%; border: 2px solid var(--surface-solid); aspect-ratio: 1; border-radius: 50%; translate: 0 -50%;
    background: color-mix(in oklab, var(--cool), var(--heat) var(--mix));
    box-shadow: 0 0 0 3px color-mix(in srgb, color-mix(in oklab, var(--cool), var(--heat) var(--mix)) 25%, transparent), 0 0 10px color-mix(in oklab, var(--cool), var(--heat) var(--mix));
    transition: background 0.4s;
  }
  .off .grip { background: var(--text-3); box-shadow: none; }
  .dragging .disc { scale: 1.06; --disc-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4), inset 0 2px 1px rgba(255, 255, 255, 0.35), inset 0 -3px 8px rgba(0, 0, 0, 0.12); }
  .heating .disc { box-shadow: var(--disc-shadow), 0 0 34px -6px color-mix(in srgb, var(--heat) 65%, transparent); }

  .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
  .state-ic { height: 22px; display: grid; place-items: center; color: var(--text-3); }
  .lbl { text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .flame { color: var(--heat); display: block; transform-origin: 50% 90%; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--heat) 70%, transparent)); }
  .temp { font-size: clamp(1.7rem, 16cqw, 2.6rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1.05; color: var(--text); }
  .temp small { font-size: 0.45em; font-weight: 600; color: var(--text-2); vertical-align: top; margin-left: 1px; }
  .val { display: inline-block; animation: tick-pop 0.25s var(--spring); }
  .uit { font-size: 0.8em; color: var(--text-3); letter-spacing: -0.02em; }
  .sub { margin-top: 2px; font-size: 0.78rem; font-weight: 700; color: var(--text-2); display: flex; align-items: center; gap: 6px; }
  .hum { display: inline-flex; align-items: center; gap: 1px; color: var(--info); }

  .nb {
    position: absolute; bottom: -3%; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer;
    transition: transform 0.2s var(--spring), background 0.3s, opacity 0.3s;
  }
  .nb:active:not(:disabled) { transform: scale(0.88); background: var(--accent-soft); color: var(--accent); }
  .nb:disabled { opacity: 0.4; cursor: default; }
  .minus { left: 17%; }
  .plus { right: 17%; }

  @keyframes heat-pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.7; } }
  @keyframes disc-glow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.04); } }
  @keyframes tick-pop { from { transform: scale(1.12); } to { transform: scale(1); } }
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-2deg); }
    25% { transform: scale(1.12, 0.94) rotate(3deg); }
    50% { transform: scale(0.94, 1.1) rotate(-3deg); }
    75% { transform: scale(1.06) rotate(2deg); }
  }
</style>

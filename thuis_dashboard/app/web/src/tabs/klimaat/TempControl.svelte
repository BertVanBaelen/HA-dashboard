<script>
  import { mdiFire, mdiPowerStandby, mdiMinus, mdiPlus, mdiWaterPercent, mdiHeart } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ value?: number|null, min?: number, max?: number, step?: number, current?: number|null, humidity?: number|null, comfort?: number|null, off?: boolean, heating?: boolean, disabled?: boolean, label?: string, debounce?: number, onchange?: (v: number) => void }} */
  let { value = null, min = 10, max = 25, step = 0.5, current = null, humidity = null, comfort = null, off = false, heating = false, disabled = false, label = '', debounce = 700, onchange } = $props();

  const valid = (v) => v != null && Number.isFinite(v);
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const snap = (v) => clamp(Math.round(v / step) * step);
  const frac = (v) => (!valid(v) || max <= min ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min))));
  const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));
  const fmt1 = (v) => v.toFixed(1).replace('.', ',');

  let local = $state(/** @type {number|null} */ (null));
  let pendingUntil = 0;
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  let bump = $state(0);

  const shown = $derived(local ?? (valid(value) ? snap(/** @type {number} */ (value)) : null));
  const active = $derived(!off || local != null);
  const sending = $derived(local != null);

  $effect(() => {
    value;
    off;
    if (!timer && local != null && (Date.now() > pendingUntil || (valid(value) && Math.abs(/** @type {number} */ (value) - local) < 1e-6 && !off))) local = null;
  });
  $effect(() => () => clearTimeout(timer));

  const mix = $derived(Math.round(frac(shown) * 100));

  const chips = $derived.by(() => {
    const out = [];
    const add = (v, text, icon = null) => {
      if (!valid(v)) return;
      const s = snap(v);
      if (out.some((c) => Math.abs(c.v - s) < 1e-6)) return;
      out.push({ v: s, text, icon });
    };
    if (valid(comfort)) add(comfort, `Comfort ${fmt(snap(/** @type {number} */ (comfort)))}°`, mdiHeart);
    add(18, '18°');
    add(20, '20°');
    return out.sort((x, y) => x.v - y.v);
  });

  function setLocal(v) {
    const s = snap(v);
    if (s !== shown || !active) {
      bump++;
      try { navigator.vibrate?.(6); } catch {}
    }
    local = s;
  }

  function send() {
    clearTimeout(timer);
    timer = undefined;
    if (local == null) return;
    pendingUntil = Date.now() + 8000;
    onchange?.(local);
    setTimeout(() => {
      if (!timer && Date.now() >= pendingUntil - 50) local = null;
    }, 8000);
  }

  function commit(delay = debounce) {
    clearTimeout(timer);
    timer = setTimeout(send, delay);
  }

  function nudge(d) {
    if (disabled) return;
    const base = active && shown != null ? shown : valid(value) ? /** @type {number} */ (value) : (min + max) / 2;
    setLocal(active ? base + d * step : base);
    commit();
  }

  function pick(v) {
    if (disabled) return;
    setLocal(v);
    send();
  }
</script>

<div class="tc" class:off={!active} class:heating={heating && active} class:disabled style="--mix:{mix}%">
  <div class="row">
    <button class="nb" aria-label="Kouder" disabled={disabled || (active && shown != null && shown <= min)} onclick={() => nudge(-1)}>
      <Icon path={mdiMinus} size={26} />
    </button>

    <div class="display" role="status" aria-live="polite" aria-label={label}>
      <div class="state-ic">
        {#if !active}
          <Icon path={mdiPowerStandby} size={18} />
        {:else if heating}
          <span class="flame"><Icon path={mdiFire} size={20} /></span>
        {:else}
          <span class="tiny lbl">Doel</span>
        {/if}
      </div>
      <div class="temp num" class:pending={sending}>
        {#if !active}
          <span class="uit">Uit</span>
        {:else if shown != null}
          {#key bump}<span class="val">{fmt1(shown)}</span>{/key}<small>°</small>
        {:else}–{/if}
      </div>
      <div class="sub num">
        {#if valid(current)}<span>Nu {fmt1(/** @type {number} */ (current))}°</span>{/if}
        {#if valid(humidity)}<span class="hum"><Icon path={mdiWaterPercent} size={14} />{Math.round(/** @type {number} */ (humidity))}%</span>{/if}
      </div>
    </div>

    <button class="nb" aria-label="Warmer" disabled={disabled || (active && shown != null && shown >= max)} onclick={() => nudge(1)}>
      <Icon path={mdiPlus} size={26} />
    </button>
  </div>

  <div class="scale" aria-hidden="true">
    <span class="fill" style="clip-path: inset(0 {100 - (active ? mix : 0)}% 0 0 round 3px)"></span>
    {#if valid(current)}<span class="cur" style="left:{frac(current) * 100}%"></span>{/if}
  </div>

  <div class="chips">
    {#each chips as c (c.v)}
      <button class="chip" class:sel={active && shown != null && Math.abs(shown - c.v) < 1e-6} class:comfort={!!c.icon} {disabled} onclick={() => pick(c.v)}>
        {#if c.icon}<Icon path={c.icon} size={15} />{/if}
        <span>{c.text}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .tc {
    --tone: color-mix(in oklab, var(--cool), var(--heat) var(--mix));
    display: flex; flex-direction: column; gap: 12px; width: 100%;
    padding: 14px 12px 12px; border-radius: 22px; border: 1px solid var(--border);
    background:
      radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--tone) 14%, transparent), transparent 70%),
      var(--surface-2);
    transition: box-shadow 0.4s, background 0.4s;
  }
  .tc.off { --tone: var(--text-3); }
  .tc.heating { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--heat) 30%, transparent), 0 10px 34px -16px color-mix(in srgb, var(--heat) 70%, transparent); }
  .tc.disabled { opacity: 0.55; }

  .row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; }
  .nb {
    width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0;
    border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer;
    box-shadow: 0 6px 16px -10px rgba(0, 0, 0, 0.35);
    touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
    transition: transform 0.2s var(--spring), background 0.25s, color 0.25s, opacity 0.3s;
  }
  .nb:active:not(:disabled) { transform: scale(0.88); background: color-mix(in srgb, var(--tone) 18%, var(--surface)); color: var(--tone); }
  .nb:disabled { opacity: 0.4; cursor: default; }
  .nb:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

  .display { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; user-select: none; -webkit-user-select: none; }
  .state-ic { height: 22px; display: grid; place-items: center; color: var(--text-3); }
  .lbl { text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  .flame { color: var(--heat); display: block; transform-origin: 50% 90%; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--heat) 70%, transparent)); animation: flicker 1.6s ease-in-out infinite; }
  .temp { font-size: clamp(2.4rem, 11vw, 3.2rem); font-weight: 800; letter-spacing: -0.04em; line-height: 1.05; color: var(--text); transition: color 0.3s; }
  .temp.pending { color: var(--tone); }
  .temp small { font-size: 0.45em; font-weight: 600; color: var(--text-2); vertical-align: top; margin-left: 1px; }
  .val { display: inline-block; animation: tick-pop 0.25s var(--spring); }
  .uit { font-size: 0.75em; color: var(--text-3); letter-spacing: -0.02em; }
  .sub { margin-top: 2px; min-height: 1.2em; font-size: 0.82rem; font-weight: 700; color: var(--text-2); display: flex; align-items: center; gap: 8px; }
  .hum { display: inline-flex; align-items: center; gap: 1px; color: var(--info); }

  .scale { position: relative; height: 6px; margin: 0 6px; border-radius: 3px; background: var(--surface-3); }
  .fill {
    position: absolute; inset: 0; border-radius: 3px;
    background: linear-gradient(90deg, #38bdf8, #818cf8 35%, #fbbf24 62%, #fb923c 82%, #ef4444);
    transition: clip-path 0.6s var(--ease);
  }
  .heating .fill { animation: heat-pulse 2.4s ease-in-out infinite; }
  .cur { position: absolute; top: 50%; width: 10px; height: 10px; border-radius: 50%; translate: -50% -50%; background: var(--text); border: 2px solid var(--surface-solid); transition: left 0.6s var(--ease); }

  .chips { display: flex; gap: 8px; }
  .chip {
    flex: 1 1 0; min-width: 0; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 10px;
    border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2);
    font: inherit; font-weight: 700; font-size: 0.85rem; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    transition: transform 0.2s var(--spring), background 0.3s, color 0.3s, box-shadow 0.3s, border-color 0.3s;
  }
  .chip span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip.comfort { flex-grow: 1.6; }
  .chip.comfort :global(svg) { color: var(--heat); }
  .chip:active:not(:disabled) { transform: scale(0.94); }
  .chip:disabled { opacity: 0.6; cursor: default; }
  .chip.sel { background: var(--tone); color: #fff; border-color: transparent; box-shadow: 0 8px 20px -10px var(--tone); }
  .chip.sel :global(svg) { color: #fff; }

  @keyframes tick-pop { from { transform: scale(1.12); } to { transform: scale(1); } }
  @keyframes heat-pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-2deg); }
    25% { transform: scale(1.12, 0.94) rotate(3deg); }
    50% { transform: scale(0.94, 1.1) rotate(-3deg); }
    75% { transform: scale(1.06) rotate(2deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .flame, .heating .fill { animation: none; }
  }
</style>

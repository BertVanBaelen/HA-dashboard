<script>
  import { mdiFloorLamp, mdiFloorLampTorchiere, mdiTune } from '@mdi/js';
  import { states, callService, unavailable } from '../../lib/api.js';
  import Icon from '../../components/Icon.svelte';
  import Slider from '../../components/Slider.svelte';
  import { lampRgb, brightnessPct, supportsBrightness, css, kelvinToRgb } from './color.js';

  /** @type {{ light: {entity:string,name:string,room:string,sceneSelect:string|null}, onopen?: () => void }} */
  let { light, onopen } = $props();

  const s = $derived($states[light.entity]);
  const na = $derived(unavailable(s));
  const realOn = $derived(s?.state === 'on');
  let pending = $state(/** @type {boolean|null} */ (null));
  $effect(() => {
    realOn;
    pending = null;
  });
  const on = $derived(pending ?? realOn);
  const pct = $derived(brightnessPct(s));
  const rgb = $derived(lampRgb(s) ?? (on ? kelvinToRgb(2900) : null));
  const scene = $derived(light.sceneSelect ? $states[light.sceneSelect]?.state : s?.attributes?.effect);
  const icon = $derived(light.sceneSelect ? mdiFloorLampTorchiere : mdiFloorLamp);
  const glow = $derived(on ? 0.35 + (pct / 100) * 0.65 : 0);

  async function toggle() {
    if (na) return;
    const next = !on;
    pending = next;
    setTimeout(() => (pending = null), 4000);
    try {
      await callService('light', next ? 'turn_on' : 'turn_off', {}, light.entity);
    } catch {
      pending = null;
    }
  }
  function setBrightness(v) {
    callService('light', 'turn_on', { brightness_pct: v }, light.entity).catch(() => {});
  }
  function stop(e) {
    e.stopPropagation();
  }
</script>

<div
  class="lamp"
  class:on
  class:na
  style="--lamp:{css(rgb)};--lamp-soft:{css(rgb, 0.28)};--glow:{glow}"
  role="button"
  tabindex="0"
  aria-pressed={on}
  aria-label="{light.name} {on ? 'uitzetten' : 'aanzetten'}"
  onclick={toggle}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())}
>
  <span class="aura" aria-hidden="true"></span>
  <div class="top">
    <span class="orb"><Icon path={icon} size={30} /></span>
    <div class="txt grow">
      <strong class="ellipsis">{light.name}</strong>
      <span class="small muted ellipsis">
        {#if na}Niet bereikbaar{:else if on}Aan · {pct}%{#if scene && scene !== 'none'} · {scene}{/if}{:else}Uit{/if}
      </span>
    </div>
    {#if !na}
      <button class="btn icon soft tune" aria-label="Instellingen {light.name}" onclick={(e) => { stop(e); onopen?.(); }}><Icon path={mdiTune} size={20} /></button>
    {/if}
  </div>
  {#if on && !na && supportsBrightness(s)}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="bright no-swipe" onclick={stop} onpointerdown={stop}>
      <Slider value={pct} min={1} max={100} color={css(rgb)} onchange={setBrightness} />
    </div>
  {/if}
</div>

<style>
  .lamp {
    --lamp: transparent;
    position: relative; overflow: hidden; cursor: pointer; isolation: isolate;
    display: flex; flex-direction: column; gap: 14px; padding: 16px;
    border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow);
    backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4);
    transition: transform 0.25s var(--spring), border-color 0.5s, box-shadow 0.6s var(--ease), opacity 0.3s;
    min-height: 96px; outline: none;
  }
  .lamp:focus-visible { box-shadow: 0 0 0 3px var(--accent-soft); }
  .lamp:active { transform: scale(0.97); }
  .lamp.on {
    border-color: color-mix(in srgb, var(--lamp) 50%, transparent);
    box-shadow: var(--shadow), 0 14px 44px -14px var(--lamp);
  }
  .lamp.na { opacity: 0.55; cursor: default; }
  .aura {
    position: absolute; z-index: -1; width: 240px; height: 240px; left: -70px; top: -110px; border-radius: 50%;
    background: radial-gradient(circle, var(--lamp-soft), transparent 70%);
    opacity: 0; transform: scale(0.6); transition: opacity 0.6s var(--ease), transform 0.8s var(--spring);
    pointer-events: none;
  }
  .on .aura { opacity: var(--glow); transform: scale(1); animation: drift 9s ease-in-out infinite; }
  .top { display: flex; align-items: center; gap: 14px; }
  .txt { display: flex; flex-direction: column; min-width: 0; }
  .orb {
    width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0;
    background: var(--surface-2); color: var(--text-3);
    transition: background 0.5s var(--ease), color 0.4s, box-shadow 0.6s var(--ease), transform 0.4s var(--spring);
  }
  .on .orb {
    color: #fff;
    background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--lamp) 55%, #fff), var(--lamp) 70%);
    box-shadow: 0 0 calc(10px + 26px * var(--glow)) calc(2px * var(--glow)) var(--lamp), inset 0 -4px 10px rgba(0, 0, 0, 0.15);
    animation: breathe 3.8s ease-in-out infinite;
  }
  .on .orb :global(svg) { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35)); }
  .tune { flex-shrink: 0; }
  .bright { cursor: default; }
  @keyframes breathe {
    0%, 100% { box-shadow: 0 0 calc(10px + 26px * var(--glow)) calc(2px * var(--glow)) var(--lamp), inset 0 -4px 10px rgba(0, 0, 0, 0.15); }
    50% { box-shadow: 0 0 calc(18px + 40px * var(--glow)) calc(6px * var(--glow)) var(--lamp), inset 0 -4px 10px rgba(0, 0, 0, 0.15); }
  }
  @keyframes drift {
    0%, 100% { translate: 0 0; }
    50% { translate: 40px 24px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .on .orb, .on .aura { animation: none; }
  }
</style>

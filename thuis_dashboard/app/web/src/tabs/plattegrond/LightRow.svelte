<script>
  import { mdiFloorLamp, mdiLedStripVariant, mdiPalette } from '@mdi/js';
  import { states, callService, unavailable } from '../../lib/api.js';
  import Icon from '../../components/Icon.svelte';
  import Slider from '../../components/Slider.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import DeviceRow from './DeviceRow.svelte';
  import { lampRgb, brightnessPct, supportsBrightness, supportsColor, supportsTemp, css } from '../verlichting/color.js';

  /** @type {{ light: {entity:string,name:string,room:string,sceneSelect:string|null}, onmore?: () => void }} */
  let { light, onmore } = $props();

  const s = $derived($states[light.entity]);
  const na = $derived(unavailable(s));
  const on = $derived(s?.state === 'on');
  const pct = $derived(brightnessPct(s));
  const rgb = $derived(lampRgb(s));
  const canDim = $derived(supportsBrightness(s));
  const hasMore = $derived(supportsColor(s) || supportsTemp(s) || !!light.sceneSelect || (s?.attributes?.effect_list?.length ?? 0) > 0);
  let preview = $state(/** @type {number|null} */ (null));
  $effect(() => {
    if (preview != null && Math.abs(pct - preview) <= 2) preview = null;
  });

  const power = (v) => callService('light', v ? 'turn_on' : 'turn_off', {}, light.entity).catch(() => {});
  const bright = (v) => {
    preview = v;
    setTimeout(() => { if (preview === v) preview = null; }, 10000);
    callService('light', 'turn_on', { brightness_pct: v }, light.entity).catch(() => (preview = null));
  };
</script>

{#snippet dimmer()}
  <Slider value={pct} min={1} max={100} color={css(rgb)} format={(v) => `${v}%`} label="Helderheid" oninput={(v) => (preview = v)} onchange={bright} />
{/snippet}

<DeviceRow
  iconPath={/led/i.test(light.name) ? mdiLedStripVariant : mdiFloorLamp}
  label={light.name}
  sub={na ? 'Niet bereikbaar' : on ? `Aan · ${preview ?? pct}%` : 'Uit'}
  active={on}
  dim={na}
  color={rgb ? css(rgb) : 'var(--warn)'}
  below={on && canDim && !na ? dimmer : undefined}
>
  {#if hasMore && !na}
    <button class="btn icon ghost more" aria-label="Kleur en scènes" onclick={onmore}><Icon path={mdiPalette} size={20} /></button>
  {/if}
  <Toggle checked={on} disabled={na} label={light.name} color={rgb ? css(rgb) : ''} onchange={power} />
</DeviceRow>

<style>
  .more { width: 40px; height: 40px; color: var(--text-2); }
</style>

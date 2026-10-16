<script>
  import { LIGHTS } from '$shared/config.js';
  import { states, action } from '../lib/api.js';
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Slider from '../components/Slider.svelte';
  import Segmented from '../components/Segmented.svelte';

  /** @type {{ preset: any }} */
  let { preset = $bindable() } = $props();

  const ICONS = ['weatherSunset', 'book', 'weatherNight', 'power', 'star', 'heart', 'movie', 'sofa', 'bed', 'music'];

  const toHex = (rgb) => '#' + (rgb ?? [255, 255, 255]).map((v) => v.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  function upd(entity, patch) {
    preset.lights = { ...preset.lights, [entity]: { ...(preset.lights[entity] ?? { on: false }), ...patch } };
  }
  function setMode(entity, mode) {
    const cur = preset.lights[entity] ?? {};
    if (mode === 'temp') upd(entity, { rgb: undefined, colorTemp: cur.colorTemp ?? 3000 });
    else upd(entity, { colorTemp: undefined, rgb: cur.rgb ?? [255, 140, 60] });
  }
  async function capture() {
    preset.lights = await action('capturePreset', {}, 'Huidige stand overgenomen');
  }
</script>

<div class="col">
  <label class="field">Naam<input class="input" bind:value={preset.name} /></label>
  <div class="icons">
    {#each ICONS as ic (ic)}
      <button class="icn" class:sel={preset.icon === ic} onclick={() => (preset.icon = ic)} aria-label={ic}><Icon name={ic} size={20} /></button>
    {/each}
  </div>

  {#each LIGHTS as l (l.entity)}
    {@const cfg = preset.lights[l.entity] ?? { on: false }}
    {@const st = $states[l.entity]}
    <div class="lamp" class:off={!cfg.on}>
      <div class="spread">
        <strong>{l.name}</strong>
        <Toggle checked={cfg.on} onchange={(on) => upd(l.entity, on ? { on, brightness: cfg.brightness ?? 80, colorTemp: cfg.rgb ? undefined : (cfg.colorTemp ?? 3000) } : { on })} />
      </div>
      {#if cfg.on}
        <Slider label="Helderheid" value={cfg.brightness ?? 100} min={1} max={100} format={(v) => `${v}%`} onchange={(v) => upd(l.entity, { brightness: v })} />
        <Segmented size="sm" value={cfg.rgb ? 'rgb' : 'temp'} onchange={(m) => setMode(l.entity, m)} options={[{ value: 'temp', label: 'Wit' }, { value: 'rgb', label: 'Kleur' }]} />
        {#if cfg.rgb}
          <label class="row colorpick"><input type="color" value={toHex(cfg.rgb)} onchange={(e) => upd(l.entity, { rgb: fromHex(e.currentTarget.value) })} /><span class="muted small">Tik om de kleur te kiezen</span></label>
        {:else}
          <Slider
            label="Kleurtemperatuur"
            value={cfg.colorTemp ?? 3000}
            min={st?.attributes?.min_color_temp_kelvin ?? 2000}
            max={st?.attributes?.max_color_temp_kelvin ?? 6500}
            step={100}
            track="linear-gradient(90deg,#ff9a3c,#ffe3b0,#f4f8ff,#9cc3ff)"
            format={(v) => `${v} K`}
            onchange={(v) => upd(l.entity, { colorTemp: v })}
          />
        {/if}
        {#if l.sceneSelect}
          <label class="field">Scène
            <select class="input" value={cfg.scene ?? ''} onchange={(e) => upd(l.entity, { scene: e.currentTarget.value || undefined })}>
              <option value="">Geen</option>
              {#each $states[l.sceneSelect]?.attributes?.options ?? [] as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          </label>
        {/if}
      {/if}
    </div>
  {/each}
  <button class="btn soft" onclick={capture}><Icon name="camera" size={18} />Huidige stand overnemen</button>
</div>

<style>
  .icons { display: flex; flex-wrap: wrap; gap: 6px; }
  .icn { width: 42px; height: 42px; border-radius: 13px; border: 1px solid var(--border); background: var(--surface-2); display: grid; place-items: center; cursor: pointer; transition: all 0.25s var(--spring); }
  .icn.sel { background: var(--accent); color: #fff; transform: scale(1.08); }
  .lamp { background: var(--surface-2); border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 12px; transition: opacity 0.3s; }
  .lamp.off { opacity: 0.7; }
  .colorpick input { width: 52px; height: 40px; border: 0; padding: 0; background: none; cursor: pointer; }
</style>

<script>
  import { scale } from 'svelte/transition';
  import { mdiFloorLamp, mdiFloorLampTorchiere, mdiCreation, mdiPalette, mdiWhiteBalanceSunny } from '@mdi/js';
  import { states, callService, unavailable } from '../../lib/api.js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import Slider from '../../components/Slider.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import ColorWheel from './ColorWheel.svelte';
  import {
    lampRgb, brightnessPct, supportsBrightness, supportsColor, supportsTemp, isTempMode,
    kelvinToRgb, hsToRgb, rgbToHs, css, TEMP_TRACK, SWATCHES,
  } from './color.js';

  /** @type {{ light: {entity:string,name:string,room:string,sceneSelect:string|null}|null, open?: boolean }} */
  let { light, open = $bindable(false) } = $props();

  const s = $derived(light ? $states[light.entity] : null);
  const a = $derived(s?.attributes ?? {});
  const na = $derived(unavailable(s));
  const on = $derived(s?.state === 'on');
  const pct = $derived(brightnessPct(s));
  const canColor = $derived(supportsColor(s));
  const canTemp = $derived(supportsTemp(s));
  const canDim = $derived(supportsBrightness(s));
  let modePick = $state(/** @type {'temp'|'color'|null} */ (null));
  $effect(() => {
    light;
    modePick = null;
  });
  const mode = $derived(modePick ?? (canTemp && (isTempMode(s) || !canColor) ? 'temp' : 'color'));
  const minK = $derived(a.min_color_temp_kelvin ?? 2000);
  const maxK = $derived(a.max_color_temp_kelvin ?? 6500);
  const kelvin = $derived(a.color_temp_kelvin ?? 2900);
  let previewK = $state(/** @type {number|null} */ (null));
  let previewBright = $state(/** @type {number|null} */ (null));
  $effect(() => {
    kelvin;
    previewK = null;
  });
  $effect(() => {
    pct;
    previewBright = null;
  });
  const curRgb = $derived(Array.isArray(a.rgb_color) ? a.rgb_color : Array.isArray(a.hs_color) ? hsToRgb(a.hs_color[0], a.hs_color[1]) : null);
  const hs = $derived(!isTempMode(s) && curRgb ? rgbToHs(curRgb) : Array.isArray(a.hs_color) && !isTempMode(s) ? a.hs_color : null);
  const rgb = $derived(previewK != null ? kelvinToRgb(previewK) : lampRgb(s));
  const glow = $derived(on ? 0.3 + ((previewBright ?? pct) / 100) * 0.7 : 0);

  const sceneEntity = $derived(light?.sceneSelect ? $states[light.sceneSelect] : null);
  const scenes = $derived(
    sceneEntity && !unavailable(sceneEntity)
      ? { kind: 'select', options: sceneEntity.attributes?.options ?? [], current: sceneEntity.state }
      : Array.isArray(a.effect_list) && a.effect_list.length
        ? { kind: 'effect', options: a.effect_list, current: a.effect }
        : null,
  );

  const send = (data) => light && callService('light', 'turn_on', data, light.entity).catch(() => {});
  const withBright = (data) => ({ brightness_pct: pct, ...data });

  function power(v) {
    if (light) callService('light', v ? 'turn_on' : 'turn_off', {}, light.entity).catch(() => {});
  }
  function setRgb(c) {
    send(canDim ? withBright({ rgb_color: c }) : { rgb_color: c });
  }
  function setHs(v) {
    setRgb(hsToRgb(v[0], v[1]));
  }
  function setKelvin(k) {
    previewK = k;
    send(canDim ? withBright({ color_temp_kelvin: k }) : { color_temp_kelvin: k });
  }
  function setScene(o) {
    if (!light) return;
    if (scenes?.kind === 'select' && light.sceneSelect) {
      callService('select', 'select_option', { option: o }, light.sceneSelect, `Scène: ${o}`).catch(() => {});
    } else {
      send({ effect: o });
    }
  }
  const same = (x, y) => !!x && !!y && x.every((v, i) => Math.abs(v - y[i]) < 10);
</script>

<Sheet bind:open title={light?.name ?? ''}>
  {#if light && s}
    <div class="col sheet-body" style="--lamp:{rgb ? css(rgb) : 'var(--accent)'};--lamp-soft:{css(rgb, 0.35)};--glow:{glow}">
      <div class="hero" class:on>
        <div class="halo"></div>
        <span class="bulb"><Icon path={light.sceneSelect ? mdiFloorLampTorchiere : mdiFloorLamp} size={46} /></span>
        <div class="spread state">
          <div class="col" style="gap:2px">
            <span class="big num">{na ? '–' : on ? `${previewBright ?? pct}%` : 'Uit'}</span>
            <span class="small muted">{na ? 'Niet bereikbaar' : light.room}</span>
          </div>
          <Toggle checked={on} disabled={na} onchange={power} color={on ? css(rgb) : ''} />
        </div>
      </div>

      {#if na}
        <p class="muted small center">Deze lamp is momenteel niet bereikbaar.</p>
      {:else}
        {#if canDim}
          <Slider
            label="Helderheid"
            value={on ? pct : 1}
            min={1}
            max={100}
            color={on ? css(rgb) : ''}
            format={(v) => `${v}%`}
            oninput={(v) => (previewBright = v)}
            onchange={(v) => send({ brightness_pct: v })}
          />
        {/if}

        {#if canColor && canTemp}
          <Segmented
            value={mode}
            onchange={(m) => (modePick = m)}
            options={[
              { value: 'temp', label: 'Wit', iconPath: mdiWhiteBalanceSunny, color: '#f5a442' },
              { value: 'color', label: 'Kleur', iconPath: mdiPalette },
            ]}
          />
        {/if}

        {#if canTemp && mode === 'temp'}
          <div in:scale={{ start: 0.96, duration: 250 }}>
            <Slider
              label="Kleurtemperatuur"
              value={Math.min(maxK, Math.max(minK, kelvin))}
              min={minK}
              max={maxK}
              step={50}
              track={TEMP_TRACK}
              format={(v) => `${v} K · ${v < 3000 ? 'warm' : v < 4500 ? 'neutraal' : 'koel'}`}
              oninput={(v) => (previewK = v)}
              onchange={setKelvin}
            />
            <div class="spread tiny faint temp-labels"><span>Warm</span><span>Koel</span></div>
            <div class="swatches">
              {#each [2200, 2700, 3000, 4000, 5000, 6500].filter((k) => k >= minK && k <= maxK) as k (k)}
                <button
                  class="sw"
                  class:sel={isTempMode(s) && Math.abs(kelvin - k) < 60}
                  style="--c:{css(kelvinToRgb(k))}"
                  aria-label="{k} K"
                  onclick={() => setKelvin(k)}
                ></button>
              {/each}
            </div>
          </div>
        {:else if canColor}
          <div class="col" style="gap:16px" in:scale={{ start: 0.96, duration: 250 }}>
            <ColorWheel {hs} onchange={setHs} />
            <div class="swatches">
              {#each SWATCHES as c (c.join())}
                <button class="sw" class:sel={!isTempMode(s) && same(curRgb, c)} style="--c:{css(c)}" aria-label="Kleur" onclick={() => setRgb(c)}></button>
              {/each}
            </div>
          </div>
        {/if}

        {#if scenes && scenes.options.length}
          <div class="col" style="gap:8px">
            <span class="small muted row" style="gap:6px"><Icon path={mdiCreation} size={16} />{scenes.kind === 'select' ? 'Scène' : 'Effect'}</span>
            <div class="scenes">
              {#each scenes.options as o (o)}
                <button class="scene" class:sel={scenes.current === o} onclick={() => setScene(o)}>{o}</button>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .sheet-body { gap: 18px; padding-bottom: 8px; }
  .hero {
    position: relative; overflow: hidden; isolation: isolate; border-radius: var(--radius);
    background: var(--surface-2); padding: 18px; display: flex; align-items: center; gap: 16px;
    transition: background 0.5s;
  }
  .halo {
    position: absolute; z-index: -1; inset: -60%; opacity: 0; pointer-events: none;
    background: radial-gradient(circle at 25% 50%, var(--lamp-soft), transparent 45%);
    transition: opacity 0.6s var(--ease);
  }
  .hero.on .halo { opacity: calc(0.5 + var(--glow) * 0.5); animation: sway 8s ease-in-out infinite; }
  .bulb {
    width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0;
    background: var(--surface-3); color: var(--text-3);
    transition: background 0.5s var(--ease), box-shadow 0.6s var(--ease), color 0.4s;
  }
  .on .bulb {
    color: #fff;
    background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--lamp) 50%, #fff), var(--lamp) 72%);
    box-shadow: 0 0 calc(16px + 40px * var(--glow)) calc(4px * var(--glow)) var(--lamp);
    animation: pulse-glow 3.6s ease-in-out infinite;
  }
  .on .bulb :global(svg) { filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35)); }
  .state { flex: 1; min-width: 0; }
  .center { text-align: center; }
  .temp-labels { margin-top: 4px; padding: 0 4px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 12px; }
  .sw {
    width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--surface-solid); cursor: pointer;
    background: var(--c); box-shadow: 0 0 0 1px var(--border), 0 4px 14px -4px var(--c);
    transition: transform 0.25s var(--spring), box-shadow 0.3s;
  }
  .sw:hover { transform: scale(1.1); }
  .sw:active { transform: scale(0.9); }
  .sw.sel { box-shadow: 0 0 0 3px var(--c), 0 0 18px var(--c); transform: scale(1.08); }
  .scenes { display: flex; flex-wrap: wrap; gap: 8px; }
  .scene {
    padding: 10px 16px; min-height: 44px; border-radius: 999px; border: 1px solid var(--border); cursor: pointer;
    background: var(--surface-2); color: var(--text); font-weight: 600;
    transition: transform 0.2s var(--spring), background 0.3s, color 0.3s, box-shadow 0.3s;
  }
  .scene:active { transform: scale(0.94); }
  .scene.sel { background: var(--lamp, var(--accent)); color: #fff; box-shadow: 0 6px 20px -6px var(--lamp); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 calc(16px + 40px * var(--glow)) calc(4px * var(--glow)) var(--lamp); }
    50% { box-shadow: 0 0 calc(26px + 56px * var(--glow)) calc(10px * var(--glow)) var(--lamp); }
  }
  @keyframes sway {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(8%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .on .bulb, .hero.on .halo { animation: none; }
  }
</style>

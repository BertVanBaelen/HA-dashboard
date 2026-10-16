<script>
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { mdiLightbulbGroup, mdiLightbulbGroupOff, mdiContentSavePlus } from '@mdi/js';
  import { LIGHTS } from '$shared/config.js';
  import { states, household, action, callService, saveHousehold, toast, unavailable } from '../lib/api.js';
  import { openSettings } from '../lib/nav.js';
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Sheet from '../components/Sheet.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import PresetEditor from '../settings/PresetEditor.svelte';
  import LampCard from './verlichting/LampCard.svelte';
  import LampSheet from './verlichting/LampSheet.svelte';
  import { lampRgb, presetRgb, presetMatches, css } from './verlichting/color.js';

  const lamps = $derived(LIGHTS.filter((l) => $states[l.entity]));
  const rooms = $derived(
    [...new Set(lamps.map((l) => l.room))].map((room) => ({ room, lamps: lamps.filter((l) => l.room === room) })),
  );
  const onLamps = $derived(lamps.filter((l) => $states[l.entity]?.state === 'on'));
  const reachable = $derived(lamps.filter((l) => !unavailable($states[l.entity])));
  const anyOn = $derived(onLamps.length > 0);
  const heroColors = $derived(onLamps.map((l) => lampRgb($states[l.entity])).filter(Boolean));
  const presets = $derived($household?.presets ?? []);

  let busyPreset = $state(/** @type {string|null} */ (null));
  let busyAll = $state(false);
  let sheetLight = $state(/** @type {any} */ (null));
  let sheetOpen = $state(false);
  let editing = $state(/** @type {any} */ (null));
  let editorOpen = $state(false);

  async function applyPreset(p) {
    busyPreset = p.id;
    try {
      const r = await action('applyPreset', { id: p.id }, null);
      if (r?.failed?.length) toast(`Niet gelukt: ${r.failed.join(', ')}`, 'error', 6000);
      else toast(`${p.name} toegepast`, 'ok');
    } catch {
    } finally {
      busyPreset = null;
    }
  }

  async function setAll(on) {
    const ids = reachable.map((l) => l.entity);
    if (!ids.length) return;
    busyAll = true;
    try {
      await callService('light', on ? 'turn_on' : 'turn_off', {}, ids, on ? 'Lampen aan' : 'Lampen uit');
    } catch {
    } finally {
      busyAll = false;
    }
  }

  function roomOff(list) {
    const ids = list.filter((l) => $states[l.entity]?.state === 'on').map((l) => l.entity);
    if (ids.length) callService('light', 'turn_off', {}, ids, 'Lampen uit').catch(() => {});
  }

  function openLamp(l) {
    sheetLight = l;
    sheetOpen = true;
  }

  async function newPreset() {
    try {
      const lights = await action('capturePreset');
      editing = { id: `p${Date.now().toString(36)}`, name: 'Nieuwe preset', icon: 'star', lights };
      editorOpen = true;
    } catch {}
  }

  function savePreset() {
    if (!editing) return;
    const clean = $state.snapshot(editing);
    if (!clean.name?.trim()) return toast('Geef de preset een naam', 'error');
    saveHousehold({ presets: [...presets, clean] });
    toast(`Preset "${clean.name}" opgeslagen`, 'ok');
    editorOpen = false;
  }

  function presetStyle(p) {
    const cols = LIGHTS.map((l) => presetRgb(p.lights?.[l.entity])).filter(Boolean);
    const c1 = cols[0] ? css(cols[0]) : 'var(--surface-3)';
    const c2 = cols[1] ? css(cols[1]) : cols[0] ? css(cols[0], 0.5) : 'var(--surface-3)';
    const dim = Math.max(0, ...LIGHTS.map((l) => (p.lights?.[l.entity]?.on ? p.lights[l.entity].brightness ?? 100 : 0))) / 100;
    return `--p1:${c1};--p2:${c2};--pglow:${cols.length ? 0.35 + dim * 0.65 : 0}`;
  }
</script>

<div class="stagger col" style="gap:var(--gap)">
  <section
    class="hero"
    class:on={anyOn}
    style="--h1:{heroColors[0] ? css(heroColors[0], 0.45) : 'transparent'};--h2:{heroColors[1] ? css(heroColors[1], 0.4) : heroColors[0] ? css(heroColors[0], 0.25) : 'transparent'}"
  >
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="row hero-row">
      <span class="hero-ic"><Icon path={anyOn ? mdiLightbulbGroup : mdiLightbulbGroupOff} size={30} /></span>
      <div class="grow col" style="gap:2px">
        <h2>Alle lampen</h2>
        <span class="small muted">
          {#if !lamps.length}Geen lampen gevonden{:else if anyOn}{onLamps.length} van {lamps.length} aan{:else}Alles is uit{/if}
        </span>
      </div>
      <Toggle checked={anyOn} disabled={!reachable.length || busyAll} onchange={(v) => setAll(v)} />
    </div>
    {#if anyOn}
      <button class="btn soft block" transition:fly={{ y: -6, duration: 250 }} onclick={() => setAll(false)} disabled={busyAll}>
        <Icon name="power" size={18} />Alle lampen uit
      </button>
    {/if}
  </section>

  <div>
    <div class="spread section-head">
      <h4 class="section-title">Presets</h4>
      <button class="btn ghost sm" onclick={openSettings}><Icon name="pencil" size={16} />Beheren</button>
    </div>
    <div class="presets no-swipe">
      {#each presets as p (p.id)}
        {@const active = presetMatches(p, $states)}
        <button
          class="preset"
          class:active
          animate:flip={{ duration: 300 }}
          style={presetStyle(p)}
          disabled={!!busyPreset}
          onclick={() => applyPreset(p)}
        >
          <span class="swatch">
            <span class="blob b1"></span>
            <span class="blob b2"></span>
            <span class="pic">
              {#if busyPreset === p.id}<span class="spinner"></span>{:else}<Icon name={p.icon ?? 'star'} size={22} />{/if}
            </span>
          </span>
          <span class="pname ellipsis">{p.name}</span>
          <span class="tiny pstate">{active ? 'Actief' : 'Toepassen'}</span>
        </button>
      {/each}
      <button class="preset add" onclick={newPreset}>
        <span class="swatch"><span class="pic"><Icon path={mdiContentSavePlus} size={22} /></span></span>
        <span class="pname">Opslaan</span>
        <span class="tiny pstate">Huidige stand</span>
      </button>
    </div>
  </div>

  {#if !lamps.length}
    <EmptyState icon="lightbulb" title="Geen lampen" text="Er zijn geen lampen beschikbaar." />
  {/if}

  {#each rooms as r (r.room)}
    {@const roomOn = r.lamps.filter((l) => $states[l.entity]?.state === 'on').length}
    <div>
      <div class="spread section-head">
        <h4 class="section-title">{r.room} <span class="faint">· {roomOn ? `${roomOn} aan` : 'uit'}</span></h4>
        {#if roomOn}
          <button class="btn ghost sm" transition:fly={{ x: 10, duration: 200 }} onclick={() => roomOff(r.lamps)}>
            <Icon name="power" size={16} />Alles uit
          </button>
        {/if}
      </div>
      <div class="grid">
        {#each r.lamps as l (l.entity)}
          <LampCard light={l} onopen={() => openLamp(l)} />
        {/each}
      </div>
    </div>
  {/each}
</div>

<LampSheet light={sheetLight} bind:open={sheetOpen} />

<Sheet bind:open={editorOpen} title="Nieuwe preset">
  {#if editing}
    <PresetEditor bind:preset={editing} />
  {/if}
  {#snippet footer()}
    <button class="btn ghost" onclick={() => (editorOpen = false)}>Annuleren</button>
    <button class="btn primary" onclick={savePreset}><Icon name="check" size={18} />Opslaan</button>
  {/snippet}
</Sheet>

<style>
  .hero {
    position: relative; overflow: hidden; isolation: isolate; padding: 18px; display: flex; flex-direction: column; gap: 14px;
    border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow);
    backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4);
    transition: border-color 0.5s, box-shadow 0.6s;
  }
  .hero.on { border-color: color-mix(in srgb, var(--h1) 60%, var(--border)); box-shadow: var(--shadow), 0 16px 50px -20px var(--h1); }
  .hero-bg {
    position: absolute; inset: -40%; z-index: -1; pointer-events: none; opacity: 0; transition: opacity 0.8s var(--ease);
    background: radial-gradient(circle at 20% 30%, var(--h1), transparent 40%), radial-gradient(circle at 80% 70%, var(--h2), transparent 40%);
  }
  .hero.on .hero-bg { opacity: 1; animation: swirl 14s linear infinite; }
  .hero-row { gap: 14px; }
  .hero h2 { font-size: 1.15rem; }
  .hero-ic {
    width: 52px; height: 52px; border-radius: 17px; display: grid; place-items: center; flex-shrink: 0;
    background: var(--surface-2); color: var(--text-3); transition: all 0.5s var(--ease);
  }
  .on .hero-ic { background: var(--gradient); color: #fff; box-shadow: 0 8px 24px -8px var(--accent); transform: rotate(-6deg); }

  .section-head { align-items: center; }
  .section-head .section-title { margin-bottom: 10px; }
  .section-head .btn { margin-top: 12px; }

  .presets {
    display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x proximity; padding: 4px 4px 14px; margin: 0 -4px;
    scrollbar-width: none;
  }
  .presets::-webkit-scrollbar { display: none; }
  .preset {
    --p1: var(--surface-3); --p2: var(--surface-3); --pglow: 0;
    flex: 0 0 auto; width: 118px; scroll-snap-align: start; cursor: pointer;
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 10px 12px;
    border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow);
    color: var(--text); text-align: left;
    transition: transform 0.22s var(--spring), border-color 0.4s, box-shadow 0.4s;
  }
  .preset:active { transform: scale(0.94); }
  .preset:disabled { cursor: progress; }
  .preset.active { border-color: color-mix(in srgb, var(--p1) 60%, transparent); box-shadow: var(--shadow), 0 10px 30px -10px var(--p1); }
  .swatch {
    position: relative; overflow: hidden; width: 100%; height: 64px; border-radius: 16px; margin-bottom: 8px;
    background: var(--surface-2); display: grid; place-items: center;
  }
  .blob {
    position: absolute; width: 70px; height: 70px; border-radius: 50%; filter: blur(14px); opacity: calc(0.4 + var(--pglow) * 0.6);
    transition: transform 0.6s var(--spring);
  }
  .b1 { background: var(--p1); left: -8px; top: -10px; }
  .b2 { background: var(--p2); right: -10px; bottom: -14px; }
  .preset:hover .b1, .preset.active .b1 { transform: translate(8px, 6px) scale(1.1); }
  .preset:hover .b2, .preset.active .b2 { transform: translate(-8px, -4px) scale(1.1); }
  .preset.active .blob { animation: breathe 3.5s ease-in-out infinite; }
  .pic {
    position: relative; width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center;
    background: color-mix(in srgb, var(--surface-solid) 70%, transparent); color: var(--text);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); box-shadow: 0 4px 12px -6px rgba(0, 0, 0, 0.4);
  }
  .pname { font-weight: 700; width: 100%; }
  .pstate { color: var(--text-3); }
  .active .pstate { color: var(--ok); font-weight: 700; }
  .preset.add { border-style: dashed; background: transparent; box-shadow: none; }
  .preset.add .pic { background: var(--accent-soft); color: var(--accent-text); }
  .spinner { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; }

  @keyframes swirl { to { transform: rotate(360deg); } }
  @keyframes breathe { 0%, 100% { opacity: calc(0.4 + var(--pglow) * 0.6); } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .hero.on .hero-bg, .preset.active .blob { animation: none; }
  }
</style>

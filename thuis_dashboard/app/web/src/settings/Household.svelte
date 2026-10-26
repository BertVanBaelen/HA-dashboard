<script>
  import { slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { CAR_FLAGS, DEFAULT_COMFORT_TEMP } from '$shared/config.js';
  import { household, states, topology, isAdmin, saveHousehold, action, name } from '../lib/api.js';
  import { allClimates, allLights, allOpenings } from '../lib/rooms.js';
  import LayoutEditor from './LayoutEditor.svelte';
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Stepper from '../components/Stepper.svelte';
  import Sheet from '../components/Sheet.svelte';
  import PresetEditor from './PresetEditor.svelte';

  const byDomain = (d) => Object.values($states).filter((s) => s.entity_id.startsWith(d + '.')).sort((a, b) => name(a).localeCompare(name(b)));
  const calendars = $derived(byDomain('calendar'));
  const todos = $derived(byDomain('todo'));
  const ROOMS = $derived(allClimates($topology));
  const LIGHTS = $derived(allLights($topology));
  const OPENINGS = $derived(allOpenings($topology));
  let layoutOpen = $state(false);

  function toggleIn(key, id, on) {
    const set = new Set($household[key]);
    on ? set.add(id) : set.delete(id);
    saveHousehold({ [key]: [...set] });
  }

  // Presets
  let editing = $state(null);
  let editorOpen = $state(false);
  function editPreset(p) {
    editing = structuredClone($state.snapshot(p));
    editorOpen = true;
  }
  async function newPreset() {
    const lights = await action('capturePreset');
    editing = { id: `p${Date.now().toString(36)}`, name: 'Nieuwe preset', icon: 'star', lights, isNew: true };
    editorOpen = true;
  }
  function savePreset(p) {
    const { isNew, ...clean } = p;
    const list = isNew ? [...$household.presets, clean] : $household.presets.map((x) => (x.id === clean.id ? clean : x));
    saveHousehold({ presets: list });
    editorOpen = false;
  }
  function deletePreset(p) {
    if (!confirm(`Preset "${p.name}" verwijderen?`)) return;
    saveHousehold({ presets: $household.presets.filter((x) => x.id !== p.id) });
    editorOpen = false;
  }

  // Radios
  function removeRadio(id) {
    saveHousehold({ radios: $household.radios.filter((r) => r.id !== id) });
  }
  function moveRadio(i, d) {
    const arr = [...$household.radios];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    saveHousehold({ radios: arr });
  }
</script>

<h4 class="section-title">Gedeelde agenda's <span class="faint">(nieuwe afspraken)</span></h4>
<div class="group list">
  {#each calendars as c (c.entity_id)}
    <div class="row item">
      <span class="tic"><Icon name="calendar" size={20} /></span>
      <span class="grow ellipsis">{name(c)}</span>
      <Toggle checked={$household.sharedCalendars.includes(c.entity_id)} onchange={(v) => toggleIn('sharedCalendars', c.entity_id, v)} />
    </div>
  {/each}
</div>

<h4 class="section-title">Lijsten</h4>
<div class="group list">
  {#each todos as t (t.entity_id)}
    <div class="row item">
      <span class="tic"><Icon name="list" size={20} /></span>
      <span class="grow ellipsis">{name(t)}</span>
      <Toggle checked={$household.lists.includes(t.entity_id)} onchange={(v) => toggleIn('lists', t.entity_id, v)} />
    </div>
  {/each}
</div>

<h4 class="section-title">Lichtpresets</h4>
<div class="presets">
  {#each $household.presets as p (p.id)}
    <button class="preset" animate:flip={{ duration: 300 }} onclick={() => editPreset(p)}>
      <span class="tic"><Icon name={p.icon ?? 'star'} size={20} /></span>
      <span class="ellipsis">{p.name}</span>
      <Icon name="pencil" size={16} class="faint" />
    </button>
  {/each}
  <button class="preset add" onclick={newPreset}><Icon name="plus" size={20} /><span>Huidige stand opslaan</span></button>
</div>

<h4 class="section-title">Comforttemperatuur <span class="faint">(thuiskomst)</span></h4>
<div class="group">
  {#each ROOMS as r (r.key)}
    <div class="spread">
      <span>{r.name}</span>
      <div style="width:200px"><Stepper value={$household.comfort[r.key] ?? DEFAULT_COMFORT_TEMP} min={5} max={25} onchange={(v) => saveHousehold({ comfort: { ...$household.comfort, [r.key]: v } })} debounce={500} /></div>
    </div>
  {/each}
</div>

<h4 class="section-title">Raam- en deursensoren</h4>
<div class="group">
  {#each OPENINGS as d (d.entity)}
    <label class="field">
      <span class="tiny faint">{d.entity} · {d.room}</span>
      <input class="input" value={$household.sensorLabels[d.entity] ?? d.name} onchange={(e) => saveHousehold({ sensorLabels: { ...$household.sensorLabels, [d.entity]: e.currentTarget.value } })} />
    </label>
  {/each}
</div>

{#if $isAdmin}
  <h4 class="section-title">Plattegrond <span class="faint">(beheerder)</span></h4>
  <button class="preset add" onclick={() => (layoutOpen = true)}><Icon name="pencil" size={20} /><span>Plattegrond bewerken</span></button>
  <p class="muted small" style="margin-top:8px">Welke lampen, sensoren en toestellen bij een kamer horen, stel je in Home Assistant in via Areas. Verbergen kan met het label dashboard_verbergen.</p>
{/if}

<h4 class="section-title">Radiozenders</h4>
<div class="group list">
  {#each $household.radios as r, i (r.id)}
    <div class="row item" animate:flip={{ duration: 300 }} transition:slide={{ duration: 250 }}>
      <span class="tic"><Icon name="radio" size={20} /></span>
      <span class="grow ellipsis">{r.name}</span>
      <button class="btn icon ghost sm" disabled={i === 0} onclick={() => moveRadio(i, -1)} aria-label="Omhoog"><Icon name="chevronUp" size={18} /></button>
      <button class="btn icon ghost sm" onclick={() => removeRadio(r.id)} aria-label="Verwijderen"><Icon name="delete" size={18} /></button>
    </div>
  {/each}
</div>
<p class="muted small" style="margin-top:8px">Zenders toevoegen doe je in de Media-tab: Stereo → Andere radio (Net Radio van de stereo), tik op de ster.</p>

<h4 class="section-title">Auto – functies</h4>
<div class="group list">
  {#each CAR_FLAGS as f (f.key)}
    <div class="row item">
      <span class="grow">{f.label}</span>
      <Toggle checked={$household.carFlags[f.key]} onchange={(v) => saveHousehold({ carFlags: { ...$household.carFlags, [f.key]: v } })} />
    </div>
  {/each}
</div>

<h4 class="section-title">"Alles uit" schakelt uit</h4>
<div class="group small muted">
  <span>💡 {LIGHTS.map((l) => l.name).join(', ')}</span>
  <span>📺 TV / stereo (via scripts) en Chromecast</span>
  <span>🌀 Ventilator</span>
  <span>🔥 Verwarming op afwezig: {ROOMS.map((r) => r.name).join(', ')}</span>
</div>

{#if $isAdmin}
  <LayoutEditor bind:open={layoutOpen} />
{/if}

<Sheet bind:open={editorOpen} title={editing?.isNew ? 'Nieuwe preset' : 'Preset bewerken'}>
  {#if editing}
    <PresetEditor bind:preset={editing} />
  {/if}
  {#snippet footer()}
    {#if editing && !editing.isNew}<button class="btn danger" onclick={() => deletePreset(editing)}><Icon name="delete" size={18} />Verwijderen</button>{/if}
    <span class="grow"></span>
    <button class="btn primary" onclick={() => savePreset(editing)}><Icon name="check" size={18} />Opslaan</button>
  {/snippet}
</Sheet>

<style>
  .group { background: var(--surface-2); border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .list { gap: 2px; padding: 6px; }
  .item { padding: 6px 8px; }
  .tic { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
  .btn.sm.icon { padding: 6px; }
  .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .preset { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; font-weight: 600; text-align: left; transition: transform 0.2s var(--spring); }
  .preset:active { transform: scale(0.95); }
  .preset .ellipsis { flex: 1; }
  .preset.add { border-style: dashed; color: var(--accent-text); justify-content: center; }
</style>

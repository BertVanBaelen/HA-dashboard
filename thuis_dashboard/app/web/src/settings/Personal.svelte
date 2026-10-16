<script>
  import { flip } from 'svelte/animate';
  import { TABS, ACCENTS, PEOPLE, MEDIA } from '$shared/config.js';
  import { prefs, household, states, savePrefs, action, user, name } from '../lib/api.js';
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Row from './Row.svelte';

  const calendars = $derived(Object.values($states).filter((s) => s.entity_id.startsWith('calendar.')).sort((a, b) => name(a).localeCompare(name(b))));
  const tabs = $derived($prefs.tabs.map((t) => ({ ...t, meta: TABS.find((x) => x.id === t.id) })).filter((t) => t.meta));

  function setTheme(patch) {
    savePrefs({ theme: { ...$prefs.theme, ...patch } });
  }
  function toggleTab(id, visible) {
    savePrefs({ tabs: $prefs.tabs.map((t) => (t.id === id ? { ...t, visible } : t)) });
  }
  function move(i, d) {
    const arr = [...$prefs.tabs];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    savePrefs({ tabs: arr });
  }
  function toggleCalendar(id, on) {
    const set = new Set($prefs.calendars);
    on ? set.add(id) : set.delete(id);
    savePrefs({ calendars: [...set] });
  }
  function setWelcome(patch) {
    savePrefs({ welcome: { ...$prefs.welcome, ...patch } });
  }
  function setWelcomeStereo(patch) {
    setWelcome({ stereo: { ...$prefs.welcome.stereo, ...patch } });
  }
  const stereoChoice = $derived($prefs.welcome.stereo.radio ? `radio:${$prefs.welcome.stereo.radio}` : $prefs.welcome.stereo.source ? `src:${$prefs.welcome.stereo.source}` : '');
  function setStereoChoice(v) {
    if (v.startsWith('radio:')) setWelcomeStereo({ radio: v.slice(6), source: null });
    else if (v.startsWith('src:')) setWelcomeStereo({ source: v.slice(4), radio: null });
    else setWelcomeStereo({ source: null, radio: null });
  }
  const autoNotify = $derived(PEOPLE.find((p) => p.person === $user?.person)?.notify ?? null);
</script>

<h4 class="section-title">Thema</h4>
<div class="group">
  <Segmented
    value={$prefs.theme.mode}
    onchange={(mode) => setTheme({ mode })}
    options={[
      { value: 'auto', label: 'Auto', icon: 'themeAuto' },
      { value: 'light', label: 'Licht', icon: 'themeLight' },
      { value: 'dark', label: 'Donker', icon: 'themeDark' },
    ]}
  />
  <div class="accents">
    {#each ACCENTS as a (a.key)}
      <button class="swatch" class:sel={$prefs.theme.accent === a.key} style="--c:{a.color}" onclick={() => setTheme({ accent: a.key })} aria-label={a.label}>
        <span class="circle">{#if $prefs.theme.accent === a.key}<Icon name="check" size={22} />{/if}</span>
        <span class="small">{a.label}</span>
      </button>
    {/each}
  </div>
</div>

<h4 class="section-title">Tabbladen</h4>
<div class="group list">
  {#each tabs as t, i (t.id)}
    <div class="tabrow" animate:flip={{ duration: 350 }} class:hidden={!t.visible}>
      <span class="tic"><Icon name={t.meta.icon} size={20} /></span>
      <span class="grow">{t.meta.label}</span>
      <button class="btn icon ghost sm" disabled={i === 0} onclick={() => move(i, -1)} aria-label="Omhoog"><Icon name="chevronUp" size={20} /></button>
      <button class="btn icon ghost sm" disabled={i === tabs.length - 1} onclick={() => move(i, 1)} aria-label="Omlaag"><Icon name="chevronDown" size={20} /></button>
      <Toggle checked={t.visible} onchange={(v) => toggleTab(t.id, v)} label={t.meta.label} />
    </div>
  {/each}
</div>
<Row label="Starttabblad">
  <select class="input" value={$prefs.startTab} onchange={(e) => savePrefs({ startTab: e.currentTarget.value })}>
    {#each tabs.filter((t) => t.visible) as t (t.id)}<option value={t.id}>{t.meta.label}</option>{/each}
  </select>
</Row>

<h4 class="section-title">Mijn agenda's</h4>
<div class="group list">
  {#each calendars as c (c.entity_id)}
    <div class="tabrow">
      <span class="tic"><Icon name="calendar" size={20} /></span>
      <span class="grow ellipsis">{name(c)}</span>
      <Toggle checked={$prefs.calendars.includes(c.entity_id)} onchange={(v) => toggleCalendar(c.entity_id, v)} />
    </div>
  {:else}
    <p class="muted small">Geen agenda's gevonden.</p>
  {/each}
</div>

<h4 class="section-title">Welkom thuis</h4>
<div class="group col">
  <Row label="Verlichting">
    <select class="input" value={$prefs.welcome.preset ?? ''} onchange={(e) => setWelcome({ preset: e.currentTarget.value || null })}>
      <option value="">Niets</option>
      {#each $household.presets as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
    </select>
  </Row>
  <div class="spread">
    <span>Stereo aanzetten</span>
    <Toggle checked={$prefs.welcome.stereo.enabled} onchange={(enabled) => setWelcomeStereo({ enabled })} />
  </div>
  {#if $prefs.welcome.stereo.enabled}
    <Row label="Afspelen">
      <select class="input" value={stereoChoice} onchange={(e) => setStereoChoice(e.currentTarget.value)}>
        <option value="">Laatste bron</option>
        <optgroup label="Bron">
          {#each MEDIA.stereoSources as s (s.key)}<option value="src:{s.key}">{s.label}</option>{/each}
        </optgroup>
        <optgroup label="Radio">
          {#each $household.radios as r (r.id)}<option value="radio:{r.id}">{r.name}</option>{/each}
        </optgroup>
      </select>
    </Row>
  {/if}
</div>

<h4 class="section-title">Thuiskomst</h4>
<div class="group col">
  <div class="spread">
    <span>Stuur mij een melding bij thuiskomst om te verwarmen</span>
    <Toggle checked={$prefs.arrivalNotify} onchange={(arrivalNotify) => savePrefs({ arrivalNotify })} />
  </div>
  <Row label="Meldingen naar">
    <select class="input" value={$prefs.notifyService ?? ''} onchange={(e) => savePrefs({ notifyService: e.currentTarget.value || null })}>
      <option value="">Automatisch{autoNotify ? ` (${autoNotify.replace('mobile_app_', '')})` : ''}</option>
      {#each PEOPLE as p (p.key)}<option value={p.notify}>{p.notify.replace('mobile_app_', '')}</option>{/each}
    </select>
  </Row>
  {#if $prefs.arrivalNotify}
    <button class="btn soft" onclick={() => action('testArrival', {}, 'Testmelding verstuurd')}><Icon name="bell" size={18} />Testmelding sturen</button>
  {/if}
  {#if !$user?.person}
    <p class="small warn">Je HA-gebruiker is niet gekoppeld aan een persoon. Koppel dit in HA → Instellingen → Personen.</p>
  {/if}
</div>

<style>
  .group { background: var(--surface-2); border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .list { gap: 2px; padding: 6px; }
  .tabrow { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 12px; transition: opacity 0.3s; }
  .tabrow.hidden { opacity: 0.55; }
  .tic { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
  .btn.sm.icon { padding: 6px; }
  .accents { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .swatch { border: 0; background: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px; border-radius: 16px; font-weight: 600; }
  .circle { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--c) 60%, #fff), var(--c)); box-shadow: 0 6px 18px -6px var(--c); transition: transform 0.4s var(--spring), box-shadow 0.3s; }
  .swatch:hover .circle { transform: scale(1.06); }
  .swatch.sel .circle { transform: scale(1.12); box-shadow: 0 0 0 4px var(--surface-solid), 0 0 0 6px var(--c), 0 10px 26px -6px var(--c); }
  .swatch.sel .circle :global(svg) { animation: pop 0.4s var(--spring); }
</style>

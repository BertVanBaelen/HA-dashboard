<script>
  import { fly, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { mdiFan, mdiRadiator, mdiHomeAccount, mdiHomeExportOutline, mdiCrosshairsGps, mdiWeatherSunny, mdiThermometer, mdiMapMarkerRadius, mdiWindowOpenVariant, mdiDoorOpen, mdiRobotOutline } from '@mdi/js';
  import { HOME, ROOMS, DOOR_SENSORS, DEFAULT_COMFORT } from '$shared/config.js';
  import { states, household, callService, action, isOn, unavailable, num, toast } from '../lib/api.js';
  import { relTime } from '../lib/format.js';
  import Card from '../components/Card.svelte';
  import Icon from '../components/Icon.svelte';
  import Tile from '../components/Tile.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Badge from '../components/Badge.svelte';
  import RoomCard from './klimaat/RoomCard.svelte';

  const warnings = $derived.by(() => {
    const out = [];
    for (const d of DOOR_SENSORS) {
      const s = $states[d.entity];
      if (!isOn(s)) continue;
      const label = $household?.sensorLabels?.[d.entity] || d.defaultLabel;
      out.push({ key: d.entity, kind: d.kind, text: `${d.kind === 'door' ? '🚪' : '🪟'} ${label} staat open`, since: s.last_changed });
    }
    for (const r of ROOMS) {
      const s = $states[r.window];
      if (!isOn(s)) continue;
      out.push({ key: r.window, kind: 'window', text: `Tado: raam open gedetecteerd in ${r.name}`, since: s.last_changed });
    }
    return out;
  });

  const tadoMode = $derived($states[HOME.tadoMode]);
  const firstClimate = $derived(ROOMS.map((r) => $states[r.climate]).find((s) => !unavailable(s)));
  const presetModes = $derived(/** @type {string[]} */ (firstClimate?.attributes?.preset_modes ?? []));
  let pendingPresence = $state(/** @type {string|null} */ (null));
  const presence = $derived.by(() => {
    if (pendingPresence) return pendingPresence;
    const p = firstClimate?.attributes?.preset_mode;
    if (p && ['home', 'away', 'auto'].includes(p)) return p;
    const t = String(tadoMode?.state ?? '').toUpperCase();
    return t === 'AWAY' ? 'away' : t === 'HOME' ? 'home' : null;
  });
  const presenceOptions = $derived(
    [
      { value: 'home', label: 'Thuis', iconPath: mdiHomeAccount, color: 'var(--ok)' },
      { value: 'away', label: 'Weg', iconPath: mdiHomeExportOutline, color: '#64748b' },
      { value: 'auto', label: 'Geofencing', iconPath: mdiCrosshairsGps, color: 'var(--accent)' },
    ].filter((o) => presetModes.includes(o.value)),
  );
  const tadoLabel = $derived.by(() => {
    const t = String(tadoMode?.state ?? '').toUpperCase();
    return t === 'HOME' ? 'Thuis' : t === 'AWAY' ? 'Weg' : t === 'SLEEP' ? 'Slapen' : (tadoMode?.state ?? '–');
  });
  const climatePreset = $derived(firstClimate?.attributes?.preset_mode ?? null);
  const tadoState = $derived(tadoMode?.state ?? null);
  $effect(() => {
    climatePreset;
    tadoState;
    pendingPresence = null;
  });

  async function setPresence(p) {
    pendingPresence = p;
    const t = setTimeout(() => (pendingPresence = null), 8000);
    try {
      const label = p === 'home' ? 'Tado staat op Thuis' : p === 'away' ? 'Tado staat op Weg' : 'Tado volgt geofencing';
      await callService('climate', 'set_preset_mode', { preset_mode: p }, ROOMS.map((r) => r.climate).filter((id) => $states[id]), label);
    } catch {
      clearTimeout(t);
      pendingPresence = null;
    }
  }

  const yesNo = (s) => {
    const v = String(s?.state ?? '').toLowerCase();
    if (unavailable(s)) return '–';
    if (['true', 'on', 'enabled', 'aan'].includes(v)) return 'Aan';
    if (['false', 'off', 'disabled', 'uit'].includes(v)) return 'Uit';
    return s.state;
  };
  const geoLabel = (s) => {
    const v = String(s?.state ?? '').toLowerCase();
    if (unavailable(s)) return '–';
    return v === 'home' ? 'Thuis' : v === 'away' ? 'Weg' : v === 'auto' ? 'Automatisch' : s.state;
  };

  const outdoor = $derived($states[HOME.outdoorTemperature]);
  const solar = $derived($states[HOME.solar]);
  const solarPct = $derived(Math.max(0, Math.min(100, Number(solar?.state) || 0)));

  const fan = $derived($states[HOME.fan]);
  const fanOn = $derived(isOn(fan));
  let fanBusy = $state(false);
  async function toggleFan() {
    fanBusy = true;
    try {
      await callService('switch', fanOn ? 'turn_off' : 'turn_on', {}, HOME.fan, fanOn ? 'Ventilator uit' : 'Ventilator aan');
    } catch {
    } finally {
      fanBusy = false;
    }
  }

  const bath = ROOMS.find((r) => r.key === 'badkamer');
  const bathScript = $derived($states[HOME.bathroomHeatScript]);
  const bathRunning = $derived(bathScript?.state === 'on');
  const bathTemp = $derived(bath ? $states[bath.temperature] : null);
  const bathComfort = $derived(Number($household?.comfort?.badkamer ?? DEFAULT_COMFORT.badkamer));
  let bathBusy = $state(false);
  async function heatBathroom() {
    bathBusy = true;
    try {
      if (bathScript && !unavailable(bathScript)) await callService('script', 'turn_on', {}, HOME.bathroomHeatScript, 'Badkamer wordt verwarmd 🔥');
      else {
        const r = await action('heatRoom', { room: 'badkamer' });
        toast(`Badkamer verwarmt naar ${String(r?.temperature ?? bathComfort).replace('.', ',')}° 🔥`, 'ok');
      }
    } catch {
    } finally {
      bathBusy = false;
    }
  }

  const auto = $derived($states[HOME.windowAutomation]);
  const autoOn = $derived(isOn(auto));
  async function toggleAuto(v) {
    try {
      await callService('automation', v ? 'turn_on' : 'turn_off', {}, HOME.windowAutomation, v ? 'Automatisatie ingeschakeld' : 'Automatisatie uitgeschakeld');
    } catch {}
  }
</script>

<div class="klimaat stagger col">
  {#if warnings.length}
    <div class="warnings" transition:slide>
      {#each warnings as w (w.key)}
        <div class="warn-item" animate:flip={{ duration: 300 }} in:fly={{ x: -20, duration: 350 }} out:fly={{ x: 20, duration: 250 }}>
          <span class="w-ic"><Icon path={w.kind === 'door' ? mdiDoorOpen : mdiWindowOpenVariant} size={20} /></span>
          <span class="grow">
            <b>{w.text}</b>
            <span class="tiny w-since">sinds {relTime(w.since)}</span>
          </span>
        </div>
      {/each}
    </div>
  {/if}

  <Card title="Tado" iconPath={mdiHomeAccount} subtitle="Thuisstatus en buitenomstandigheden">
    {#snippet actions()}
      {#if tadoMode}<Badge kind={tadoLabel === 'Thuis' ? 'ok' : 'neutral'} pulse={tadoLabel === 'Thuis'} text={tadoLabel} />{/if}
    {/snippet}
    <div class="col" style="gap:14px">
      {#if presenceOptions.length > 1}
        <Segmented options={presenceOptions} value={presence} onchange={setPresence} />
      {/if}
      <div class="status-grid">
        <div class="st">
          <span class="st-ic cool"><Icon path={mdiThermometer} size={20} /></span>
          <span class="st-val num">{outdoor && !unavailable(outdoor) ? `${num(outdoor)}°` : '–'}</span>
          <span class="tiny muted">Buiten</span>
        </div>
        <div class="st">
          <span class="st-ic sun" style="--sun:{0.35 + solarPct / 150}"><Icon path={mdiWeatherSunny} size={20} /></span>
          <span class="st-val num">{solar && !unavailable(solar) ? `${Math.round(solarPct)}%` : '–'}</span>
          <span class="tiny muted">Zon</span>
        </div>
        <div class="st">
          <span class="st-ic geo"><Icon path={mdiMapMarkerRadius} size={20} /></span>
          <span class="st-val">{geoLabel($states[HOME.geofencingMode])}</span>
          <span class="tiny muted">Geofencing</span>
        </div>
        <div class="st">
          <span class="st-ic geo"><Icon path={mdiCrosshairsGps} size={20} /></span>
          <span class="st-val">{yesNo($states[HOME.automaticGeofencing])}</span>
          <span class="tiny muted">Auto-geofencing</span>
        </div>
      </div>
    </div>
  </Card>

  <div class="section-title">Kamers</div>
  <div class="grid">
    {#each ROOMS as room (room.key)}
      {#if $states[room.climate]}
        <RoomCard {room} />
      {:else}
        <Card title={room.name} icon="thermostat">
          <p class="muted small">Niet beschikbaar</p>
        </Card>
      {/if}
    {/each}
  </div>

  <div class="section-title">Extra</div>
  <div class="grid-2">
    <div class="fan-tile" class:on={fanOn}>
      <Tile
        label="Ventilator"
        sub={unavailable(fan) ? 'Niet beschikbaar' : fanOn ? 'Draait' : 'Uit'}
        iconPath={mdiFan}
        active={fanOn}
        color="#06b6d4"
        busy={fanBusy}
        disabled={unavailable(fan)}
        onclick={toggleFan}
      />
    </div>
    <div class="bath-tile" class:on={bathRunning}>
      <Tile
        label="Badkamer verwarmen"
        sub={bathRunning ? 'Bezig…' : `${bathTemp && !unavailable(bathTemp) ? `Nu ${num(bathTemp)}° · ` : ''}naar ${String(bathComfort).replace('.', ',')}°`}
        iconPath={mdiRadiator}
        active={bathRunning}
        color="var(--heat)"
        busy={bathBusy}
        onclick={heatBathroom}
      />
    </div>
  </div>

  <Card pad={false}>
    <div class="auto-row">
      <span class="auto-ic" class:on={autoOn}><Icon path={mdiRobotOutline} size={22} /></span>
      <div class="grow" style="min-width:0">
        <div class="auto-title">Verwarming uit bij raam open</div>
        <div class="tiny muted">{unavailable(auto) ? 'Niet beschikbaar' : autoOn ? 'Actief – verwarming stopt wanneer een raam opengaat' : 'Uitgeschakeld'}</div>
      </div>
      <Toggle checked={autoOn} disabled={unavailable(auto)} onchange={toggleAuto} label="Verwarming uit bij raam open" />
    </div>
  </Card>
</div>

<style>
  .klimaat { gap: var(--gap); padding-bottom: 10px; }

  .warnings { display: flex; flex-direction: column; gap: 8px; }
  .warn-item {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--danger) 13%, var(--surface)); border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
    color: var(--text); box-shadow: 0 10px 30px -18px var(--danger);
  }
  .warn-item .grow { display: flex; flex-direction: column; }
  .w-since { color: var(--text-2); }
  .w-ic {
    width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0;
    background: var(--danger); color: #fff; --pulse: var(--danger); animation: pulse-ring 1.8s infinite;
  }

  .status-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .st { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border-radius: 16px; background: var(--surface-2); text-align: center; min-width: 0; }
  .st-val { font-weight: 800; font-size: 1rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st-ic { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; }
  .st-ic.cool { color: var(--cool); background: color-mix(in srgb, var(--cool) 15%, transparent); }
  .st-ic.geo { color: var(--accent); background: var(--accent-soft); }
  .st-ic.sun { color: #f59e0b; background: color-mix(in srgb, #f59e0b 15%, transparent); }
  .st-ic.sun :global(svg) { animation: spin 14s linear infinite; opacity: var(--sun); filter: drop-shadow(0 0 calc(var(--sun) * 8px) #fbbf24); }

  .fan-tile.on :global(.ic .icon) { animation: spin 0.9s linear infinite; }
  .bath-tile.on :global(.ic .icon) { animation: pulse-heat 1.2s ease-in-out infinite; }
  @keyframes pulse-heat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }

  .auto-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .auto-title { font-weight: 700; }
  .auto-ic { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0; background: var(--surface-2); color: var(--text-3); transition: background 0.35s, color 0.35s; }
  .auto-ic.on { background: var(--accent-soft); color: var(--accent); }

  @media (max-width: 420px) {
    .status-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>

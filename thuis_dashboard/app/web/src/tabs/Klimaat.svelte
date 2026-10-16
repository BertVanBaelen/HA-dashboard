<script>
  import { fly, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { mdiFan, mdiRadiator, mdiWindowOpenVariant, mdiDoorOpen, mdiRobotOutline } from '@mdi/js';
  import { HOME, ROOMS, DOOR_SENSORS, DEFAULT_COMFORT } from '$shared/config.js';
  import { states, household, callService, action, isOn, unavailable, num, toast } from '../lib/api.js';
  import { relTime } from '../lib/format.js';
  import Card from '../components/Card.svelte';
  import Icon from '../components/Icon.svelte';
  import Tile from '../components/Tile.svelte';
  import Toggle from '../components/Toggle.svelte';
  import RoomCard from './klimaat/RoomCard.svelte';
  import HouseScene from './klimaat/HouseScene.svelte';

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
      out.push({ key: r.window, kind: 'window', text: `🪟 Raam open in ${r.name}`, since: s.last_changed });
    }
    return out;
  });

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
  <Card pad={false} class="house-card">
    <HouseScene />
  </Card>

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

  :global(.card.house-card) { overflow: hidden; }

  .fan-tile.on :global(.ic .icon) { animation: spin 0.9s linear infinite; }
  .bath-tile.on :global(.ic .icon) { animation: pulse-heat 1.2s ease-in-out infinite; }
  @keyframes pulse-heat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }

  .auto-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .auto-title { font-weight: 700; }
  .auto-ic { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0; background: var(--surface-2); color: var(--text-3); transition: background 0.35s, color 0.35s; }
  .auto-ic.on { background: var(--accent-soft); color: var(--accent); }

</style>

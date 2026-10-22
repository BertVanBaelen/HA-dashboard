<script>
  import {
    mdiThermometer, mdiWaterPercent, mdiWindowOpenVariant, mdiWindowClosedVariant, mdiDoorOpen, mdiDoorClosed,
    mdiPlayCircleOutline, mdiFire, mdiLightbulbOn, mdiLightbulbOutline,
  } from '@mdi/js';
  import { LIGHTS } from '$shared/config.js';
  import { states, household, callService, unavailable, num, attr } from '../../lib/api.js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import LampSheet from '../verlichting/LampSheet.svelte';
  import ClimateSection from './ClimateSection.svelte';
  import LightRow from './LightRow.svelte';
  import MediaSection from './MediaSection.svelte';
  import DeviceRow from './DeviceRow.svelte';
  import { planIcon } from './icons.js';
  import { summarize, climateRoom, fmt } from './summary.js';
  import { css } from '../verlichting/color.js';

  /** @type {{ room: import('./summary.js').PlanRoom | null, open?: boolean }} */
  let { room, open = $bindable(false) } = $props();

  const sum = $derived(room ? summarize(room, $states, $household) : null);
  const cr = $derived(room ? climateRoom(room) : null);
  const lights = $derived(
    (room?.lights ?? []).map((id) => LIGHTS.find((l) => l.entity === id) ?? { entity: id, name: attr($states[id], 'friendly_name') ?? id, room: room?.name ?? '', sceneSelect: null }),
  );
  const empty = $derived(!!sum && sum.deviceCount === 0);

  let lamp = $state(/** @type {any} */ (null));
  let lampOpen = $state(false);
  function openLamp(l) {
    lamp = l;
    lampOpen = true;
  }

  let running = $state(/** @type {string|null} */ (null));
  async function runScript(sc) {
    running = sc.entity;
    try {
      await callService('script', 'turn_on', {}, sc.entity, `${sc.label} gestart`);
    } catch {
    } finally {
      setTimeout(() => (running = null), 1200);
    }
  }
  const toggleSwitch = (id, v) => callService('switch', v ? 'turn_on' : 'turn_off', {}, id).catch(() => {});
  const sensorIcon = (id) => (/humidity/.test(id) ? mdiWaterPercent : mdiThermometer);
  const unit = (s) => attr(s, 'unit_of_measurement') ?? '';
</script>

<Sheet bind:open title={room?.name ?? ''}>
  {#if room && sum}
    <div class="col body" style="--lamp:{sum.lampColor ? css(sum.lampColor) : 'var(--accent)'};--lvl:{sum.lampLevel}">
      <div class="hero" class:lit={sum.lightsOn > 0} class:heating={sum.heating}>
        <span class="hero-ic"><Icon path={planIcon(room.icon)} size={30} /></span>
        <div class="grow col" style="gap:6px">
          {#if sum.temp != null}
            <span class="big num">{fmt(sum.temp)}°{#if sum.humidity != null}<span class="hum"> · {fmt(sum.humidity, 0)}%</span>{/if}</span>
          {:else}
            <span class="muted">{empty ? 'Geen apparaten' : `${sum.deviceCount} apparaten`}</span>
          {/if}
          {#if !empty}
            <div class="chips">
              {#if sum.heating}<span class="chip heat"><Icon path={mdiFire} size={14} />Verwarmt</span>{/if}
              {#if sum.lightCount}
                <span class="chip" class:lamp={sum.lightsOn > 0}>
                  <Icon path={sum.lightsOn ? mdiLightbulbOn : mdiLightbulbOutline} size={14} />{sum.lightsOn ? `${sum.lightsOn} aan` : 'Licht uit'}
                </span>
              {/if}
              {#if sum.mediaOn}<span class="chip media"><Icon path={planIcon(sum.mediaKind)} size={14} />{sum.mediaPlaying ? 'Speelt' : 'Aan'}</span>{/if}
              {#if sum.openCount}<span class="chip danger"><Icon path={sum.openKind === 'door' ? mdiDoorOpen : mdiWindowOpenVariant} size={14} />Open</span>{/if}
            </div>
          {/if}
        </div>
      </div>

      {#if empty}
        <EmptyState iconPath={planIcon(room.icon)} title="Geen apparaten" text="In deze ruimte zijn (nog) geen apparaten gekoppeld." />
      {/if}

      {#if cr}
        <section>
          <h3 class="section-title">Klimaat</h3>
          <ClimateSection room={cr} />
        </section>
      {/if}

      {#if lights.length}
        <section class="col">
          <h3 class="section-title">Verlichting</h3>
          {#each lights as l (l.entity)}
            <LightRow light={l} onmore={() => openLamp(l)} />
          {/each}
        </section>
      {/if}

      {#if room.media?.length}
        <section class="col">
          <h3 class="section-title">Media</h3>
          <MediaSection items={room.media} />
        </section>
      {/if}

      {#if room.switches?.length || room.scripts?.length}
        <section class="col">
          <h3 class="section-title">Apparaten</h3>
          {#each room.switches ?? [] as sw (sw.entity)}
            {@const s = $states[sw.entity]}
            {@const on = s?.state === 'on'}
            <DeviceRow
              iconPath={planIcon(sw.icon)}
              label={sw.label}
              sub={unavailable(s) ? 'Niet bereikbaar' : on ? 'Aan' : 'Uit'}
              active={on}
              dim={unavailable(s)}
              spin={sw.icon === 'fan'}
              color={sw.icon === 'fan' ? 'var(--info)' : 'var(--accent)'}
            >
              <Toggle checked={on} disabled={unavailable(s)} label={sw.label} onchange={(v) => toggleSwitch(sw.entity, v)} />
            </DeviceRow>
          {/each}
          {#each room.scripts ?? [] as sc (sc.entity)}
            {@const s = $states[sc.entity]}
            {@const active = s?.state === 'on' || running === sc.entity}
            <DeviceRow iconPath={planIcon(sc.icon)} label={sc.label} sub={active ? 'Bezig…' : 'Script'} {active} color="var(--heat)" dim={!s}>
              <button class="btn soft sm" disabled={!s || active} onclick={() => runScript(sc)}>
                <Icon path={mdiPlayCircleOutline} size={18} />Start
              </button>
            </DeviceRow>
          {/each}
        </section>
      {/if}

      {#if room.sensors?.length || sum.openings.length}
        <section>
          <h3 class="section-title">Sensoren</h3>
          <div class="sensors">
            {#each room.sensors ?? [] as se (se.entity)}
              {@const s = $states[se.entity]}
              <div class="sensor">
                <Icon path={sensorIcon(se.entity)} size={20} />
                <span class="grow small muted ellipsis">{se.label}</span>
                <strong class="num">{unavailable(s) ? '–' : `${num(s, /humidity/.test(se.entity) ? 0 : 1)}${unit(s)}`}</strong>
              </div>
            {/each}
            {#each sum.openings as o (o.entity)}
              {@const s = $states[o.entity]}
              <div class="sensor" class:open={o.open}>
                <Icon path={o.kind === 'door' ? (o.open ? mdiDoorOpen : mdiDoorClosed) : o.open ? mdiWindowOpenVariant : mdiWindowClosedVariant} size={20} />
                <span class="grow small muted ellipsis">{o.label}</span>
                <strong>{unavailable(s) ? '–' : o.open ? 'Open' : 'Dicht'}</strong>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/if}
</Sheet>

<LampSheet light={lamp} bind:open={lampOpen} />

<style>
  .body { gap: 6px; padding-bottom: 8px; }
  section { display: flex; flex-direction: column; gap: 10px; }
  section .section-title { margin: 14px 4px 0; }
  .hero {
    position: relative; overflow: hidden; isolation: isolate; display: flex; align-items: center; gap: 16px;
    padding: 16px; border-radius: var(--radius); background: var(--surface-2); border: 1px solid var(--border);
  }
  .hero::before {
    content: ''; position: absolute; inset: -50%; z-index: -1; opacity: 0; transition: opacity 0.6s var(--ease);
    background: radial-gradient(circle at 25% 50%, color-mix(in srgb, var(--lamp) 45%, transparent), transparent 40%);
  }
  .hero.lit::before { opacity: calc(0.45 + var(--lvl) * 0.55); }
  .hero-ic {
    width: 60px; height: 60px; border-radius: 20px; display: grid; place-items: center; flex-shrink: 0;
    background: var(--surface-3); color: var(--text-2); transition: all 0.5s var(--ease);
  }
  .lit .hero-ic { background: var(--lamp); color: #fff; box-shadow: 0 0 26px -4px var(--lamp); }
  .heating:not(.lit) .hero-ic { background: var(--heat); color: #fff; box-shadow: 0 0 26px -6px var(--heat); }
  .hum { font-size: 1rem; font-weight: 600; color: var(--text-2); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px;
    font-size: 0.78rem; font-weight: 600; background: var(--surface-3); color: var(--text-2);
  }
  .chip.heat { background: color-mix(in srgb, var(--heat) 18%, transparent); color: var(--heat); }
  .chip.lamp { background: color-mix(in srgb, var(--lamp) 22%, transparent); color: var(--text); }
  .chip.media { background: color-mix(in srgb, #6366f1 18%, transparent); color: #818cf8; }
  .chip.danger { background: color-mix(in srgb, var(--danger) 16%, transparent); color: var(--danger); }
  .sensors { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); gap: 8px; }
  .sensor {
    display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--radius-sm);
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text-3);
  }
  .sensor strong { color: var(--text); }
  .sensor.open { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); color: var(--danger); }
  .sensor.open strong { color: var(--danger); }
</style>

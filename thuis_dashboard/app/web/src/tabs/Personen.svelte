<script>
  import { onMount, tick } from 'svelte';
  import { mdiFitToScreenOutline, mdiAccountGroup } from '@mdi/js';
  import { PEOPLE, HOME } from '$shared/config.js';
  import { states } from '../lib/api.js';
  import { PERSON_COLORS } from '../lib/colors.js';
  import Card from '../components/Card.svelte';
  import Icon from '../components/Icon.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import PersonMap from './personen/PersonMap.svelte';
  import PersonCard from './personen/PersonCard.svelte';
  import { coords, haversine, isAbsoluteUrl } from './personen/geo.js';

  let now = $state(new Date());
  let selected = $state(/** @type {string|null} */ (null));
  /** @type {PersonMap|undefined} */
  let mapRef = $state();

  onMount(() => {
    const t = setInterval(() => (now = new Date()), 30e3);
    return () => clearInterval(t);
  });

  const zoneState = $derived($states[HOME.zone]);
  const homePos = $derived(coords(zoneState));
  const zone = $derived(homePos ? { ...homePos, radius: Number(zoneState?.attributes?.radius) || 100 } : null);

  const first = (...ids) => ids.map((id) => $states[id]).find(Boolean) ?? null;

  const people = $derived(
    PEOPLE.map((cfg) => {
      const person = $states[cfg.person] ?? null;
      const tracker = $states[cfg.tracker] ?? null;
      const pre = cfg.tracker.split('.')[1];
      const pos = coords(person, tracker);
      const pic = person?.attributes?.entity_picture;
      const accuracy = Number(tracker?.attributes?.gps_accuracy ?? person?.attributes?.gps_accuracy) || 0;
      return {
        key: cfg.key,
        name: cfg.name,
        color: PERSON_COLORS[cfg.key] ?? 'var(--accent)',
        person,
        tracker,
        battery: $states[cfg.battery] ?? null,
        batteryState: cfg.batteryState ? ($states[cfg.batteryState] ?? null) : null,
        charger: cfg.charger ? ($states[cfg.charger] ?? null) : null,
        geocoded: cfg.geocoded ? ($states[cfg.geocoded] ?? null) : null,
        hasGeocoded: !!(cfg.geocoded && $states[cfg.geocoded]),
        steps: first(`sensor.${pre}_steps_sensor`, `sensor.${pre}_steps`),
        activity: first(`sensor.${pre}_detected_activity`, `sensor.${pre}_activity`),
        pos,
        distance: pos && homePos ? haversine(homePos, pos) : null,
        picture: isAbsoluteUrl(pic) ? pic : null,
        accuracy: Math.min(accuracy, 2000),
      };
    }).filter((p) => p.person || p.tracker),
  );

  const markers = $derived(
    people
      .filter((p) => p.pos)
      .map((p) => ({ key: p.key, name: p.name, color: p.color, picture: p.picture, lat: p.pos.lat, lon: p.pos.lon, home: p.person?.state === 'home', accuracy: p.accuracy })),
  );

  const homeCount = $derived(people.filter((p) => p.person?.state === 'home').length);
  const summary = $derived(
    !people.length ? '' : homeCount === people.length ? 'Iedereen is thuis' : homeCount === 0 ? 'Niemand is thuis' : `${people.filter((p) => p.person?.state === 'home').map((p) => p.name).join(' & ')} is thuis`,
  );

  function select(key) {
    if (selected === key) {
      selected = null;
      mapRef?.fitAll();
    } else {
      selected = key;
      mapRef?.focus(key);
    }
  }

  async function fromMarker(key) {
    selected = key;
    mapRef?.focus(key);
    await tick();
    document.getElementById(`persoon-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showAll() {
    selected = null;
    mapRef?.fitAll();
  }
</script>

<div class="stagger col personen" style="gap:var(--gap)">
  {#if !people.length}
    <EmptyState icon="account" title="Geen personen" text="De personen zijn niet beschikbaar in Home Assistant" />
  {:else}
    <Card pad={false} class="mapcard">
      <div class="mapwrap">
        {#if markers.length}
          <PersonMap bind:this={mapRef} people={markers} {zone} {selected} onselect={fromMarker} height="clamp(260px, 42vh, 440px)" />
        {:else}
          <div class="nomap"><EmptyState icon="mapMarker" title="Geen locatie" text="Er is geen locatie beschikbaar" /></div>
        {/if}
        <div class="overlay top">
          <span class="summary"><Icon path={mdiAccountGroup} size={16} />{summary}</span>
        </div>
        {#if markers.length}
          <div class="overlay bottom">
            <div class="chips">
              {#each people as p (p.key)}
                <button class="pchip" class:on={selected === p.key} style="--pc:{p.color}" disabled={!p.pos} onclick={() => select(p.key)}>
                  <span class="mini">{#if p.picture}<img src={p.picture} alt="" />{:else}{p.name[0]}{/if}</span>
                  {p.name}
                </button>
              {/each}
            </div>
            <button class="btn icon fit" title="Iedereen tonen" aria-label="Iedereen tonen" onclick={showAll}>
              <Icon path={mdiFitToScreenOutline} size={20} />
            </button>
          </div>
        {/if}
      </div>
    </Card>

    <div class="grid">
      {#each people as p (p.key)}
        <div id="persoon-{p.key}" class="slot">
          <PersonCard {p} {now} selected={selected === p.key} onclick={() => select(p.key)} />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .personen { padding-bottom: 10px; }
  .mapwrap { position: relative; border-radius: var(--radius); overflow: hidden; }
  .nomap { min-height: 220px; display: grid; place-items: center; }
  .overlay { position: absolute; left: 10px; right: 10px; z-index: 500; display: flex; align-items: center; gap: 8px; pointer-events: none; }
  .overlay > * { pointer-events: auto; }
  .overlay.top { top: 10px; }
  .overlay.bottom { bottom: 22px; justify-content: space-between; }
  .summary {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 700;
    background: color-mix(in srgb, var(--surface-solid) 82%, transparent); backdrop-filter: blur(10px); box-shadow: var(--shadow); color: var(--text);
    animation: fade-up 0.5s var(--ease);
  }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .pchip {
    display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 4px 12px 4px 4px; border: none; border-radius: 999px; cursor: pointer;
    font: inherit; font-size: 0.85rem; font-weight: 700; color: var(--text);
    background: color-mix(in srgb, var(--surface-solid) 82%, transparent); backdrop-filter: blur(10px); box-shadow: var(--shadow);
    transition: background 0.3s, color 0.3s, transform 0.3s var(--spring);
  }
  .pchip:active { transform: scale(0.94); }
  .pchip.on { background: var(--pc); color: #fff; box-shadow: 0 8px 20px -8px var(--pc); }
  .pchip:disabled { opacity: 0.5; cursor: default; }
  .mini { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--pc); color: #fff; font-weight: 800; border: 2px solid var(--surface-solid); }
  .mini img { width: 100%; height: 100%; object-fit: cover; }
  .fit { background: color-mix(in srgb, var(--surface-solid) 82%, transparent); backdrop-filter: blur(10px); box-shadow: var(--shadow); }
</style>

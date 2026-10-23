<script>
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { HOME, ROOMS, PEOPLE, FLOORPLAN_ROOMS } from '$shared/config.js';
  import { states, user, prefs, household, action, callServiceResponse, num, name, toast } from '../lib/api.js';
  import { icons, weatherLabels } from '../lib/icons.js';
  import { fmtTime, fmtDay, greeting, isSameDay, startOfDay } from '../lib/format.js';
  import { fetchEvents } from '../lib/calendar.js';
  import { goTab, openSettings, openRoom } from '../lib/nav.js';
  import { PERSON_COLORS, colorFor } from '../lib/colors.js';
  import { mdiHanger } from '@mdi/js';
  import RainChart from './home/RainChart.svelte';
  import RainRadar from './home/RainRadar.svelte';
  import Outfit from './home/Outfit.svelte';
  import Card from '../components/Card.svelte';
  import Icon from '../components/Icon.svelte';
  import Tile from '../components/Tile.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  const weather = $derived($states[HOME.weather]);
  const outdoor = $derived($states[HOME.outdoorTemperature]);
  let hourly = $state([]);
  let daily = $state([]);
  let events = $state(/** @type {any[]|null} */ (null));
  let busy = $state(/** @type {string|null} */ (null));
  let now = $state(new Date());
  let forecastReady = $state(false);
  let radarOpen = $state(false);

  async function loadForecast() {
    try {
      const [h, d] = await Promise.all([
        callServiceResponse('weather', 'get_forecasts', { type: 'hourly' }, HOME.weather),
        callServiceResponse('weather', 'get_forecasts', { type: 'daily' }, HOME.weather),
      ]);
      hourly = (h?.[HOME.weather]?.forecast ?? []).filter((f) => new Date(f.datetime) > new Date(Date.now() - 3600e3)).slice(0, 12);
      daily = (d?.[HOME.weather]?.forecast ?? []).slice(0, 5);
    } catch {
    } finally {
      forecastReady = true;
    }
  }

  async function loadEvents() {
    const cals = $prefs.calendars;
    if (!cals.length) return (events = []);
    const end = startOfDay();
    end.setDate(end.getDate() + 2);
    try {
      const all = await fetchEvents(cals, new Date(), end);
      events = all.filter((e) => e.end > new Date()).slice(0, 3);
    } catch {
      events = [];
    }
  }

  onMount(() => {
    loadForecast();
    const t1 = setInterval(loadForecast, 30 * 60e3);
    const t2 = setInterval(() => (now = new Date()), 30e3);
    const t3 = setInterval(loadEvents, 5 * 60e3);
    return () => [t1, t2, t3].forEach(clearInterval);
  });
  $effect(() => {
    $prefs.calendars;
    loadEvents();
  });

  const people = $derived(PEOPLE.map((p) => ({ ...p, state: $states[p.person] })).filter((p) => p.state));
  const lists = $derived($household.lists.map((id) => $states[id]).filter((s) => s && Number(s.state) > 0));
  const welcomeSet = $derived(!!$prefs.welcome.preset || $prefs.welcome.stereo.enabled);
  const firstName = $derived(($user?.displayName ?? '').split(' ')[0]);

  async function run(name, okText) {
    busy = name;
    try {
      const r = await action(name, {}, null);
      if (r?.failed?.length) toast(`Niet gelukt: ${r.failed.join(', ')}`, 'error', 6000);
      else toast(okText, 'ok');
    } catch {
    } finally {
      busy = null;
    }
  }

  function personLabel(s) {
    if (s.state === 'home') return 'Thuis';
    if (s.state === 'not_home') return 'Weg';
    return s.state;
  }

  const listIcon = (id) => (id.includes('shopping') ? 'cart' : id.includes('clean') ? 'broom' : 'list');
  const cond = $derived(weather?.state ?? 'cloudy');
  const isNight = $derived($states['sun.sun']?.state === 'below_horizon');
  const next5 = $derived(hourly.slice(0, 5));
  const today = $derived(daily.find((d) => isSameDay(new Date(d.datetime), now)) ?? null);
  const nowTemp = $derived.by(() => {
    const o = Number(outdoor?.state);
    if (outdoor && !Number.isNaN(o)) return o;
    return weather?.attributes.temperature ?? null;
  });
</script>

<div class="home stagger">
  <!-- H-01 greeting -->
  <div class="greet">
    <h2>{greeting(now)}, <span class="gradient-text">{firstName}</span> <span class="wave">👋</span></h2>
    <p class="muted">{now.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
  </div>

  <!-- H-07 / H-08 actions -->
  <div class="grid-2">
    <Tile label="Alles uit" sub="Licht, media, verwarming" icon="power" color="#ef4444" busy={busy === 'allesUit'} onclick={() => run('allesUit', 'Alles uitgeschakeld')} />
    {#if welcomeSet}
      <Tile label="Welkom thuis" sub="Jouw sfeer" icon="welcome" color="var(--accent)" active busy={busy === 'welkomThuis'} onclick={() => run('welkomThuis', 'Welkom thuis! 🏠')} />
    {:else}
      <Tile label="Welkom thuis" sub="Stel Welkom thuis in" icon="welcome" onclick={openSettings} />
    {/if}
  </div>

  <!-- H-02 weather -->
  <Card class="weather {cond} {isNight ? 'night' : ''}" pad={false}>
    <div class="wx">
      <div class="wx-main">
        <div class="wx-icon" class:night={isNight}><Icon path={icons[cond]} size={84} /></div>
        <div>
          <div class="huge num">{weather ? Math.round(weather.attributes.temperature) : '–'}°</div>
          <div class="muted">{weatherLabels[cond] ?? cond}</div>
        </div>
      </div>
      <div class="wx-meta small">
        {#if weather?.attributes.apparent_temperature != null}<span>Voelt als <b>{Math.round(weather.attributes.apparent_temperature)}°</b></span>{/if}
        {#if outdoor}<span>Buiten <b>{num(outdoor)}°</b></span>{/if}
        {#if weather?.attributes.humidity != null}<span><Icon name="water" size={14} />{weather.attributes.humidity}%</span>{/if}
        {#if weather?.attributes.wind_speed != null}<span>💨 {Math.round(weather.attributes.wind_speed)} {weather.attributes.wind_speed_unit ?? 'km/h'}</span>{/if}
        {#if $states[HOME.sunRising]}<span>🌅 {fmtTime($states[HOME.sunRising].state)}</span>{/if}
        {#if $states[HOME.sunSetting]}<span>🌇 {fmtTime($states[HOME.sunSetting].state)}</span>{/if}
      </div>
    </div>
    {#if hourly.length}
      <div class="hours no-swipe">
        {#each hourly as h, i (h.datetime)}
          <div class="hour" in:fly={{ x: 20, delay: i * 30, duration: 300 }}>
            <span class="tiny muted">{i === 0 ? 'Nu' : fmtTime(h.datetime).slice(0, 2) + 'u'}</span>
            <Icon path={icons[h.condition]} size={22} />
            <b class="num">{Math.round(h.temperature)}°</b>
            {#if h.precipitation_probability}<span class="tiny rain">{h.precipitation_probability}%</span>{/if}
          </div>
        {/each}
      </div>
    {/if}
    {#if next5.length}
      <RainChart hours={next5} onclick={() => (radarOpen = true)} />
    {/if}
    {#if daily.length}
      <div class="days">
        {#each daily as d, i (d.datetime)}
          <div class="day">
            <span class="dname">{i === 0 ? 'Vandaag' : fmtDay(d.datetime)}</span>
            <Icon path={icons[d.condition]} size={20} />
            <span class="tiny rain">{d.precipitation_probability ? `${d.precipitation_probability}%` : ''}</span>
            <span class="num faint">{Math.round(d.templow ?? 0)}°</span>
            <span class="bar"><span style="--a:{(Math.round(d.templow ?? 0) + 5) * 2.5}%;--b:{(Math.round(d.temperature) + 5) * 2.5}%"></span></span>
            <b class="num">{Math.round(d.temperature)}°</b>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  {#if nowTemp != null && forecastReady}
    <Card title="Wat trek je aan?" iconPath={mdiHanger}>
      <Outfit
        temp={nowTemp}
        feel={weather?.attributes.apparent_temperature ?? null}
        min={today?.templow ?? null}
        max={today?.temperature ?? null}
        rainMm={next5.reduce((a, h) => a + (Number(h.precipitation) || 0), 0)}
        rainProb={Math.max(0, ...next5.map((h) => Number(h.precipitation_probability) || 0))}
        wind={weather?.attributes.wind_speed ?? null}
        uv={weather?.attributes.uv_index ?? null}
        {cond}
      />
    </Card>
  {/if}

  <div class="grid">
    <!-- H-03 who is home -->
    <Card title="Wie is er thuis" icon="account" onclick={() => goTab('personen')}>
      <div class="people">
        {#each people as p (p.key)}
          {@const home = p.state.state === 'home'}
          <div class="person" class:home style="--pc:{PERSON_COLORS[p.key] ?? 'var(--accent)'}">
            <span class="avatar">
              {#if p.state.attributes.entity_picture}<img src={p.state.attributes.entity_picture} alt="" />{:else}{p.name[0]}{/if}
              <span class="status"></span>
            </span>
            <span class="pname">{p.name}</span>
            <span class="small muted">{personLabel(p.state)}</span>
          </div>
        {/each}
      </div>
    </Card>

    <!-- H-04 temperatures -->
    <Card title="Binnen" icon="thermostat" onclick={() => goTab('klimaat')}>
      <div class="rooms">
        {#each ROOMS as r (r.key)}
          {@const heating = Number($states[r.heating]?.state) > 0}
          {@const plan = FLOORPLAN_ROOMS.find((p) => p.climate === r.key)}
          <button
            class="room"
            class:heating
            aria-label="{r.name} openen in Huisje"
            onclick={(e) => {
              e.stopPropagation();
              plan ? openRoom(plan.id) : goTab('plattegrond');
            }}
            onkeydown={(e) => e.stopPropagation()}
          >
            <span class="rname">{r.name}{#if heating}<span class="flame" title="Verwarmt">🔥</span>{/if}</span>
            <span class="big num">{num($states[r.temperature])}°</span>
            <span class="small muted"><Icon name="water" size={13} style="display:inline;vertical-align:-2px" />{num($states[r.humidity], 0)}%</span>
          </button>
        {/each}
      </div>
    </Card>

    <!-- H-05 events -->
    <Card title="Komende activiteiten" icon="calendar" onclick={() => goTab('agenda')}>
      {#if !$prefs.calendars.length}
        <EmptyState icon="calendar" text="Kies je agenda's in Instellingen">
          <button class="btn soft sm" onclick={(e) => { e.stopPropagation(); openSettings(); }}>Instellingen</button>
        </EmptyState>
      {:else if events === null}
        <div class="skeleton" style="height:80px"></div>
      {:else if events.length === 0}
        <EmptyState icon="calendar" text="Geen activiteiten vandaag of morgen" />
      {:else}
        <div class="events">
          {#each events as e, i (e.calendar + e.start + e.summary)}
            <div class="event" style="--ec:{colorFor(e.calendar, $household)}" in:fly={{ y: 10, delay: i * 60 }}>
              <span class="when small">
                <b>{isSameDay(e.start, now) ? 'Vandaag' : 'Morgen'}</b>
                <span class="muted">{e.allDay ? 'Hele dag' : fmtTime(e.start)}</span>
              </span>
              <span class="grow ellipsis">{e.summary}</span>
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    <!-- H-06 lists -->
    {#if lists.length}
      <Card title="Lijsten" icon="list" onclick={() => goTab('agenda')}>
        <div class="lists">
          {#each lists as l (l.entity_id)}
            <div class="listrow" in:scale={{ start: 0.9 }}>
              <span class="lic"><Icon name={listIcon(l.entity_id)} size={20} /></span>
              <span class="grow">{name(l)}</span>
              <span class="count num">{l.state}</span>
            </div>
          {/each}
        </div>
      </Card>
    {/if}
  </div>
</div>

<RainRadar bind:open={radarOpen} />

<style>
  .home { display: flex; flex-direction: column; gap: var(--gap); padding-bottom: 10px; }
  .greet h2 { font-size: 1.45rem; }
  .greet p { margin: 2px 0 0; text-transform: capitalize; }
  .wave { display: inline-block; animation: wiggle 1.2s ease-in-out 0.4s 2; transform-origin: 70% 70%; }

  :global(.card.weather) { --card-accent: #38bdf8; }
  :global(.card.weather.sunny) { --card-accent: #f59e0b; }
  :global(.card.weather.rainy), :global(.card.weather.pouring) { --card-accent: #3b82f6; }
  :global(.card.weather.night) { --card-accent: #8b5cf6; }
  .wx { padding: 18px 18px 8px; display: flex; flex-direction: column; gap: 12px; }
  .wx-main { display: flex; align-items: center; gap: 16px; }
  .wx-icon { color: #f59e0b; filter: drop-shadow(0 8px 18px color-mix(in srgb, #f59e0b 45%, transparent)); }
  .wx-icon.night { color: #a5b4fc; filter: drop-shadow(0 8px 18px rgba(165, 180, 252, 0.4)); }
  .wx-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--text-2); }
  .wx-meta span { display: inline-flex; align-items: center; gap: 4px; }
  .hours { display: flex; gap: 6px; overflow-x: auto; padding: 6px 14px 12px; scrollbar-width: none; scroll-snap-type: x mandatory; }
  .hour { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 54px; padding: 10px 4px; border-radius: 16px; background: var(--surface-2); scroll-snap-align: start; }
  .hour:first-child { background: var(--accent-soft); }
  .rain { color: var(--info); font-weight: 600; }
  .days { display: flex; flex-direction: column; padding: 4px 16px 14px; gap: 4px; border-top: 1px solid var(--border); }
  .day { display: grid; grid-template-columns: 70px 26px 36px 30px 1fr 30px; align-items: center; gap: 6px; padding: 5px 0; }
  .dname { font-weight: 600; text-transform: capitalize; }
  .bar { height: 6px; border-radius: 3px; background: var(--surface-3); position: relative; overflow: hidden; }
  .bar span { position: absolute; top: 0; bottom: 0; left: clamp(0%, var(--a), 100%); right: calc(100% - clamp(0%, var(--b), 100%)); border-radius: 3px; background: linear-gradient(90deg, #38bdf8, #fbbf24, #f97316); animation: fade-up 0.8s var(--ease); }

  .people { display: flex; gap: 12px; justify-content: space-around; }
  .person { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .avatar { position: relative; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 1.6rem; font-weight: 800; color: #fff; background: var(--pc); filter: grayscale(0.7) opacity(0.6); transition: filter 0.4s, transform 0.4s var(--spring); }
  .avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .person.home .avatar { filter: none; box-shadow: 0 0 0 3px var(--surface-solid), 0 0 0 5px var(--pc), 0 10px 24px -8px var(--pc); }
  .status { position: absolute; right: 2px; bottom: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--text-3); border: 3px solid var(--surface-solid); }
  .home .status { background: var(--ok); --pulse: var(--ok); }
  .pname { font-weight: 700; }

  .rooms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .room { display: flex; flex-direction: column; gap: 2px; padding: 12px; border-radius: 16px; background: var(--surface-2); transition: background 0.4s, transform 0.18s var(--spring); border: 0; margin: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .room:active { transform: scale(0.96); }
  .room:hover { background: var(--surface-3); }
  .room.heating { background: color-mix(in srgb, var(--heat) 14%, transparent); }
  .rname { font-size: 0.8rem; font-weight: 600; color: var(--text-2); display: flex; gap: 4px; }
  .flame { display: inline-block; }

  .events { display: flex; flex-direction: column; gap: 8px; }
  .event { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); border-left: 4px solid var(--ec); }
  .when { display: flex; flex-direction: column; min-width: 64px; }

  .lists { display: flex; flex-direction: column; gap: 6px; }
  .listrow { display: flex; align-items: center; gap: 12px; padding: 6px; }
  .lic { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
  .count { min-width: 32px; height: 32px; padding: 0 10px; border-radius: 999px; display: grid; place-items: center; background: var(--gradient); color: #fff; font-weight: 800; animation: pop 0.5s var(--spring); }
</style>

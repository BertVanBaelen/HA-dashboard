<script>
  import { onMount } from 'svelte';
  import {
    mdiLightningBolt, mdiLeaf, mdiRefresh, mdiInformationOutline, mdiSpeedometer, mdiCarOff, mdiAlertCircleOutline,
    mdiCarElectric, mdiCalendarRange, mdiTimerOutline, mdiTrophyOutline, mdiMapOutline, mdiChevronDown, mdiRoadVariant, mdiCounter,
  } from '@mdi/js';
  import { fmtDate, fmtTime, fmtDuration, fmtDay, isSameDay, startOfDay } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import RouteMap from './RouteMap.svelte';
  import SocBar from './SocBar.svelte';
  import { loadCarHistory, detectRides, fmt, dayLabel, HISTORY_DAYS, zoneAt } from './carHistory.js';
  import { places, placeLabel, want } from './places.js';
  import './views.css';

  /** @typedef {import('./carHistory.js').Ride} Ride */

  /** @type {Ride[]} */
  let rides = $state([]);
  /** @type {import('./carHistory.js').Zone[]} */
  let zones = $state([]);
  let loading = $state(true);
  let error = $state('');
  /** @type {number|null} */
  let open = $state(null);

  async function load(force = false) {
    loading = true;
    error = '';
    try {
      const h = await loadCarHistory(force);
      rides = detectRides(h);
      zones = h.zones;
      for (const r of rides) for (const p of [r.from, r.to]) if (p && !zoneAt(p, zones)) want(p);
    } catch (e) {
      error = e?.message ?? 'Laden mislukt';
    } finally {
      loading = false;
    }
  }
  onMount(() => load());

  const mins = (/** @type {Ride} */ r) => Math.max(1, Math.round((r.end - r.start) / 60e3));
  const hasMap = (/** @type {Ride} */ r) => !!(r.from || r.to);
  const effColor = (/** @type {number|null} */ v) => (v == null ? 'var(--text-3)' : v < 16 ? '#22c55e' : v < 20 ? '#f59e0b' : '#ef4444');
  const homeZones = $derived(zones.filter((z) => z.home));

  const totals = $derived.by(() => {
    const km = rides.reduce((s, r) => s + r.km, 0);
    const withE = rides.filter((r) => r.kwh != null);
    const kwh = withE.reduce((s, r) => s + (r.kwh ?? 0), 0);
    const kmE = withE.reduce((s, r) => s + r.km, 0);
    const min = rides.reduce((s, r) => s + mins(r), 0);
    const longest = rides.reduce((m, r) => Math.max(m, r.km), 0);
    const top = rides.reduce((m, r) => Math.max(m, r.maxSpeed ?? 0), 0);
    return { km, min, longest, top: top || null, kwh: withE.length ? kwh : null, kwh100: kmE > 0 ? (kwh / kmE) * 100 : null };
  });

  const perDay = $derived.by(() => {
    const today = startOfDay().getTime();
    const days = Array.from({ length: HISTORY_DAYS }, (_, i) => {
      const t = new Date(today);
      t.setDate(t.getDate() - (HISTORY_DAYS - 1 - i));
      return { t: t.getTime(), km: 0 };
    });
    for (const r of rides) {
      const d = days.find((x) => isSameDay(x.t, r.start));
      if (d) d.km += r.km;
    }
    const max = Math.max(1, ...days.map((d) => d.km));
    return days.map((d) => ({ ...d, h: (d.km / max) * 100 }));
  });

  const groups = $derived.by(() => {
    /** @type {{ key:string, label:string, km:number, rides:Ride[] }[]} */
    const out = [];
    for (const r of rides) {
      const key = startOfDay(new Date(r.start)).toISOString();
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = { key, label: dayLabel(r.start), km: 0, rides: [] };
        out.push(g);
      }
      g.km += r.km;
      g.rides.push(r);
    }
    return out;
  });

  const overview = $derived(
    rides
      .filter((r) => r.path.length >= 2)
      .map((r) => ({ id: r.start, path: r.path, faded: open != null && open !== r.start, color: open === r.start ? '#f97316' : '#6366f1' })),
  );
  const openRide = $derived(rides.find((r) => r.start === open) ?? null);

  /** @param {Ride|null} r @returns {{lat:number,lon:number,kind:'start'|'end'}[]} */
  function pins(r) {
    /** @type {{lat:number,lon:number,kind:'start'|'end'}[]} */
    const out = [];
    if (r?.from) out.push({ lat: r.from[0], lon: r.from[1], kind: 'start' });
    if (r?.to) out.push({ lat: r.to[0], lon: r.to[1], kind: 'end' });
    return out;
  }

  const kpis = $derived([
    { label: 'Langste rit', icon: mdiTrophyOutline, c: '#a855f7', v: fmt(totals.longest || null, 1), unit: 'km' },
    { label: 'Rijtijd', icon: mdiTimerOutline, c: '#14b8a6', v: totals.min ? fmtDuration(totals.min) : '—', unit: '' },
    { label: 'Topsnelheid', icon: mdiSpeedometer, c: '#ef4444', v: fmt(totals.top, 0), unit: 'km/u' },
    { label: 'Gem. per rit', icon: mdiCounter, c: '#3b82f6', v: fmt(rides.length ? totals.km / rides.length : null, 1), unit: 'km' },
  ]);
</script>

<div class="av">
  <section class="av-hero" style="--hero: linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #a855f7 100%); --hero-glow:#6366f1">
    <div class="art"><Icon path={mdiCarElectric} size={84} /></div>
    <div class="eyebrow"><Icon path={mdiCalendarRange} size={15} /> Laatste {HISTORY_DAYS} dagen</div>
    <div class="big num">{loading && !rides.length ? '…' : fmt(totals.km, 0)}<small>km</small></div>
    <div class="sub">{rides.length} ritten · {totals.min ? fmtDuration(totals.min) : '—'} onderweg</div>
    <div class="pills">
      <span class="pill"><Icon path={mdiLightningBolt} size={15} /> {fmt(totals.kwh, 1)} kWh</span>
      <span class="pill"><Icon path={mdiLeaf} size={15} /> {fmt(totals.kwh100, 1)} kWh/100km</span>
    </div>
    <div class="bars" aria-hidden="true">
      {#each perDay as d, i (d.t)}
        <div title="{fmtDate(d.t)}: {fmt(d.km, 1)} km">
          <i class:dim={!d.km} style="height:{Math.max(d.h, 4)}%; animation-delay:{i * 40}ms"></i>
          <span>{fmtDay(d.t).slice(0, 2)}</span>
        </div>
      {/each}
    </div>
    <button class="btn icon ghost sm refresh" aria-label="Vernieuwen" disabled={loading} onclick={() => load(true)}>
      <Icon path={mdiRefresh} size={18} class={loading ? 'spin' : ''} />
    </button>
  </section>

  {#if rides.length}
    <div class="av-kpis stagger">
      {#each kpis as k (k.label)}
        <div class="av-kpi" style="--c:{k.c}">
          <span class="ic"><Icon path={k.icon} size={20} /></span>
          <span class="lbl">{k.label}</span>
          <b class="num">{k.v}{#if k.unit && k.v !== '—'}<small>&nbsp;{k.unit}</small>{/if}</b>
        </div>
      {/each}
    </div>
  {/if}

  {#if overview.length}
    <Card
      title="Kaart"
      iconPath={mdiMapOutline}
      accent="#6366f1"
      subtitle={openRide ? `Rit van ${fmtDate(openRide.start)} om ${fmtTime(openRide.start)}` : `${overview.length} routes · tik een rit om ze uit te lichten`}
    >
      <RouteMap routes={overview} markers={pins(openRide)} zones={homeZones} height="280px" fitKey={open} />
    </Card>
  {/if}

  {#if loading && !rides.length}
    <div class="av-center"><span class="spinner"></span></div>
  {:else if error}
    <Card><EmptyState iconPath={mdiAlertCircleOutline} title="Kon geschiedenis niet laden" text={error} /></Card>
  {:else if !rides.length}
    <Card><EmptyState iconPath={mdiCarOff} title="Geen ritten gevonden" text="Er zijn geen ritten in de beschikbare geschiedenis." /></Card>
  {:else}
    {#each groups as g (g.key)}
      <div class="av-day"><h3>{g.label}</h3><span>{g.rides.length} {g.rides.length === 1 ? 'rit' : 'ritten'} · {fmt(g.km, 1)} km</span></div>
      <div class="av-grid">
        {#each g.rides as r (r.start)}
          {@const from = placeLabel(r.from, zones, $places)}
          {@const to = placeLabel(r.to, zones, $places)}
          {@const isOpen = open === r.start}
          <article class="av-item ride" class:open={isOpen}>
            <div class="thumb" class:art={!hasMap(r)}>
              {#if hasMap(r)}
                {#key isOpen}
                  <RouteMap
                    routes={[{ id: r.start, path: r.path, color: '#6366f1' }]}
                    markers={pins(r)}
                    zones={homeZones}
                    height="100%"
                    interactive={isOpen}
                    lazy={!isOpen}
                    rounded={false}
                  />
                {/key}
              {:else}
                <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M-5 48 C 40 48, 60 12, 100 30 S 160 10, 205 14" /></svg>
              {/if}
              <span class="km-badge num"><Icon path={mdiRoadVariant} size={14} />{fmt(r.km, 1)} km</span>
            </div>
            <button class="hit" onclick={() => (open = isOpen ? null : r.start)} aria-expanded={isOpen}>
              <div class="trip">
                <div class="stop">
                  <span class="dot start"></span>
                  <b class="ellipsis" title={from.long}>{from.short}</b>
                  <time class="num">{fmtTime(r.start)}</time>
                </div>
                <div class="stop">
                  <span class="dot end"></span>
                  <b class="ellipsis" title={to.long}>{to.short}</b>
                  <time class="num">{fmtTime(r.end)}</time>
                </div>
              </div>
              <div class="av-chips">
                <span class="av-chip" style="--c:#14b8a6"><Icon path={mdiTimerOutline} size={15} /><b>{fmtDuration(mins(r))}</b></span>
                <span class="av-chip" style="--c:#f59e0b"><Icon path={mdiLightningBolt} size={15} /><b>{fmt(r.kwh, 1)}</b><small>kWh</small></span>
                <span class="av-chip" style="--c:{effColor(r.kwh100)}"><Icon path={mdiLeaf} size={15} /><b>{fmt(r.kwh100, 1)}</b><small>kWh/100km</small></span>
                {#if r.avgSpeed != null || r.maxSpeed != null}
                  <span class="av-chip" style="--c:#ef4444" title="Gemiddelde / maximum snelheid"><Icon path={mdiSpeedometer} size={15} /><b>{fmt(r.avgSpeed, 0)} / {fmt(r.maxSpeed, 0)}</b><small>km/u</small></span>
                {/if}
              </div>
              <SocBar before={r.socBefore} after={r.socAfter} mode="drain" />
              {#if hasMap(r)}<span class="more"><Icon path={mdiChevronDown} size={18} /></span>{/if}
            </button>
          </article>
        {/each}
      </div>
    {/each}
  {/if}

  <div class="av-note">
    <Icon path={mdiInformationOutline} size={15} />
    <span>Berekend uit de Home Assistant-geschiedenis (laatste ~{HISTORY_DAYS} dagen). Routes komen van de GPS-tracker van de auto, plaatsnamen van OpenStreetMap. Energie is een schatting.</span>
  </div>
</div>

<style>
  .thumb { position: relative; height: 150px; background: linear-gradient(135deg, var(--surface-2), var(--surface-3)); transition: height 0.35s var(--ease); }
  .ride.open .thumb { height: 320px; }
  .thumb.art { height: 92px; background: linear-gradient(135deg, color-mix(in srgb, #6366f1 18%, var(--surface-2)), color-mix(in srgb, #0ea5e9 14%, var(--surface-2))); }
  .thumb.art svg { position: absolute; left: 0; top: 12px; width: 100%; height: calc(100% - 24px); }
  .thumb.art path { fill: none; stroke: #6366f1; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 2 10; opacity: 0.7; vector-effect: non-scaling-stroke; }
  .km-badge {
    position: absolute; left: 10px; bottom: 10px; z-index: 500; display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 0.85rem; color: #fff; pointer-events: none;
    background: linear-gradient(135deg, #6366f1, #a855f7); box-shadow: 0 6px 16px -6px #6366f1;
  }
  .hit { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 14px; position: relative; }
  .hit:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; border-radius: var(--radius); }
  .trip { display: flex; flex-direction: column; gap: 6px; position: relative; padding-right: 24px; }
  .trip::before { content: ''; position: absolute; left: 5px; top: 13px; bottom: 13px; border-left: 2px dashed var(--border); }
  .stop { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
  .stop b { font-size: 0.95rem; }
  .stop time { font-size: 0.8rem; color: var(--text-2); }
  .dot { width: 12px; height: 12px; border-radius: 50%; position: relative; }
  .dot.start { background: #22c55e; box-shadow: 0 0 0 3px color-mix(in srgb, #22c55e 25%, transparent); }
  .dot.end { background: var(--text); border-radius: 3px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--text) 15%, transparent); }
  .more { position: absolute; right: 10px; top: 12px; color: var(--text-3); transition: transform 0.3s var(--ease); }
  .ride.open .more { transform: rotate(180deg); }
  .ride.open { grid-column: 1 / -1; }
</style>

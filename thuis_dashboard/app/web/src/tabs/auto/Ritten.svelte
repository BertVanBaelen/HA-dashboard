<script>
  import { onMount } from 'svelte';
  import { mdiMapMarkerPath, mdiLightningBolt, mdiLeaf, mdiRefresh, mdiInformationOutline, mdiSpeedometer, mdiBatteryArrowDown, mdiCarOff, mdiAlertCircleOutline } from '@mdi/js';
  import { fmtDate, fmtTime, fmtDuration } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { loadCarHistory, detectRides, fmt, HISTORY_DAYS } from './carHistory.js';

  /** @type {import('./carHistory.js').Ride[]} */
  let rides = $state([]);
  let loading = $state(true);
  let error = $state('');

  async function load(force = false) {
    loading = true;
    error = '';
    try {
      rides = detectRides(await loadCarHistory(force));
    } catch (e) {
      error = e?.message ?? 'Laden mislukt';
    } finally {
      loading = false;
    }
  }
  onMount(() => load());

  const totals = $derived.by(() => {
    const km = rides.reduce((s, r) => s + r.km, 0);
    const withE = rides.filter((r) => r.kwh != null);
    const kwh = withE.reduce((s, r) => s + (r.kwh ?? 0), 0);
    const kmE = withE.reduce((s, r) => s + r.km, 0);
    return { km, kwh: withE.length ? kwh : null, kwh100: kmE > 0 ? (kwh / kmE) * 100 : null };
  });
  const kpis = $derived([
    { label: 'Ritten', icon: mdiMapMarkerPath, v: rides.length, d: 0, unit: '' },
    { label: 'Afstand', icon: mdiMapMarkerPath, v: totals.km, d: 1, unit: 'km' },
    { label: 'Energie', icon: mdiLightningBolt, v: totals.kwh, d: 1, unit: 'kWh' },
    { label: 'Gem. verbruik', icon: mdiLeaf, v: totals.kwh100, d: 1, unit: 'kWh/100km' },
  ]);
</script>

<div class="ritten col">
  <div class="kpis">
    {#each kpis as k (k.label)}
      <div class="kpi">
        <span class="kpi-ic"><Icon path={k.icon} size={18} /></span>
        <span class="tiny muted ellipsis">{k.label}</span>
        <b class="num">{loading ? '…' : fmt(k.v, k.d)}{#if !loading && k.v != null && k.unit}<small>&nbsp;{k.unit}</small>{/if}</b>
      </div>
    {/each}
  </div>

  <div class="note tiny muted row">
    <Icon path={mdiInformationOutline} size={16} />
    <span class="grow">Berekend uit de Home Assistant-geschiedenis: enkel de laatste ~{HISTORY_DAYS} dagen zijn beschikbaar. Energie is een schatting op basis van laadniveau.</span>
    <button class="btn icon ghost sm" aria-label="Vernieuwen" disabled={loading} onclick={() => load(true)}>
      <Icon path={mdiRefresh} size={18} class={loading ? 'spin' : ''} />
    </button>
  </div>

  <Card title="Ritten" iconPath={mdiMapMarkerPath} accent="var(--accent-2)" subtitle={loading ? 'Laden…' : `${rides.length} ritten`}>
    {#if loading && !rides.length}
      <div class="center"><span class="spinner"></span></div>
    {:else if error}
      <EmptyState iconPath={mdiAlertCircleOutline} title="Kon geschiedenis niet laden" text={error} />
    {:else if !rides.length}
      <EmptyState iconPath={mdiCarOff} title="Geen ritten gevonden" text="Er zijn geen ritten in de beschikbare geschiedenis." />
    {:else}
      <ul class="list">
        {#each rides as r (r.start)}
          <li>
            <div class="spread head">
              <b>{fmtDate(r.start)} · {fmtTime(r.start)}–{fmtTime(r.end)}</b>
              <span class="tiny muted">{fmtDuration(Math.max(1, Math.round((r.end - r.start) / 60e3)))}</span>
            </div>
            <div class="stats">
              <span><Icon path={mdiMapMarkerPath} size={15} /><b class="num">{fmt(r.km, 1)}</b><small>km</small></span>
              <span><Icon path={mdiLightningBolt} size={15} /><b class="num">{fmt(r.kwh, 1)}</b><small>kWh</small></span>
              <span><Icon path={mdiLeaf} size={15} /><b class="num">{fmt(r.kwh100, 1)}</b><small>kWh/100km</small></span>
              <span><Icon path={mdiBatteryArrowDown} size={15} /><b class="num">{fmt(r.socBefore, 0)} → {fmt(r.socAfter, 0)}</b><small>%</small></span>
              <span title="Maximum / gemiddelde snelheid"><Icon path={mdiSpeedometer} size={15} /><b class="num">{fmt(r.maxSpeed, 0)} / {fmt(r.avgSpeed, 0)}</b><small>km/u</small></span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
</div>

<style>
  .ritten { gap: var(--gap); }
  .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
  .kpi { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow); min-width: 0; }
  .kpi-ic { grid-row: 1 / 3; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-text, var(--accent)); }
  .kpi b { font-size: 1.15rem; line-height: 1.2; min-width: 0; overflow-wrap: anywhere; }
  .kpi small, .stats small { font-size: 0.75em; color: var(--text-2); font-weight: 600; }
  .note { gap: 8px; align-items: center; }
  .center { display: grid; place-items: center; padding: 24px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .list li { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid var(--border); }
  .list li:last-child { border-bottom: 0; }
  .head { gap: 8px; }
  .stats { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--text-2); }
  .stats span { display: inline-flex; align-items: center; gap: 4px; }
  .stats b { color: var(--text); }
</style>

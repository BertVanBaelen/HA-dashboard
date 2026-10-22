<script>
  import { onMount } from 'svelte';
  import { mdiEvStation, mdiLightningBolt, mdiCurrencyEur, mdiRefresh, mdiInformationOutline, mdiTimerOutline, mdiBatteryArrowUp, mdiFlash, mdiRoadVariant, mdiAlertCircleOutline, mdiPowerPlugOff } from '@mdi/js';
  import { CAR_CHARGE_PRICES as PRICES } from '$shared/config.js';
  import { fmtDate, fmtTime, fmtDuration } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { loadCarHistory, detectCharges, detectRides, fmt, eur, HISTORY_DAYS } from './carHistory.js';

  /** @type {import('./carHistory.js').Charge[]} */
  let charges = $state([]);
  let rideKm = $state(0);
  let loading = $state(true);
  let error = $state('');

  async function load(force = false) {
    loading = true;
    error = '';
    try {
      const h = await loadCarHistory(force);
      charges = detectCharges(h);
      rideKm = detectRides(h).reduce((s, r) => s + r.km, 0);
    } catch (e) {
      error = e?.message ?? 'Laden mislukt';
    } finally {
      loading = false;
    }
  }
  onMount(() => load());

  const totals = $derived.by(() => {
    const kwh = charges.reduce((s, c) => s + (c.kwh ?? 0), 0);
    const cost = charges.reduce((s, c) => s + (c.cost ?? 0), 0);
    return { kwh, cost, per100: rideKm > 0 && cost > 0 ? (cost / rideKm) * 100 : null };
  });
  const SOURCE = { auto: 'volgens auto', vermogen: 'uit laadvermogen', soc: 'uit laadniveau' };
  const kpis = $derived([
    { label: 'Laadbeurten', icon: mdiEvStation, text: String(charges.length) },
    { label: 'Geladen', icon: mdiLightningBolt, text: fmt(totals.kwh, 1), unit: 'kWh' },
    { label: 'Kosten', icon: mdiCurrencyEur, text: eur(totals.cost) },
    { label: 'Kosten per 100 km', icon: mdiRoadVariant, text: totals.per100 != null ? eur(totals.per100) : '—' },
  ]);
  const price = (/** @type {number} */ v) => v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
</script>

<div class="kosten col">
  <div class="kpis">
    {#each kpis as k (k.label)}
      <div class="kpi">
        <span class="kpi-ic"><Icon path={k.icon} size={18} /></span>
        <span class="tiny muted ellipsis">{k.label}</span>
        <b class="num">{loading ? '…' : k.text}{#if !loading && k.unit}<small>&nbsp;{k.unit}</small>{/if}</b>
      </div>
    {/each}
  </div>

  <div class="note tiny muted row">
    <Icon path={mdiInformationOutline} size={16} />
    <span class="grow">
      AC (&lt; {PRICES.dcThresholdKw} kW): {price(PRICES.acPerKwh)}/kWh · DC (&gt; {PRICES.dcThresholdKw} kW): {price(PRICES.dcPerKwh)}/kWh.
      Enkel de laatste ~{HISTORY_DAYS} dagen geschiedenis zijn beschikbaar.
    </span>
    <button class="btn icon ghost sm" aria-label="Vernieuwen" disabled={loading} onclick={() => load(true)}>
      <Icon path={mdiRefresh} size={18} class={loading ? 'spin' : ''} />
    </button>
  </div>

  <Card title="Laadbeurten" iconPath={mdiEvStation} accent="var(--ok)" subtitle={loading ? 'Laden…' : `${charges.length} laadbeurten`}>
    {#if loading && !charges.length}
      <div class="center"><span class="spinner"></span></div>
    {:else if error}
      <EmptyState iconPath={mdiAlertCircleOutline} title="Kon geschiedenis niet laden" text={error} />
    {:else if !charges.length}
      <EmptyState iconPath={mdiPowerPlugOff} title="Geen laadbeurten gevonden" text="Er zijn geen laadbeurten in de beschikbare geschiedenis." />
    {:else}
      <ul class="list">
        {#each charges as c (c.start)}
          <li>
            <div class="spread head">
              <b>{fmtDate(c.start)} · {fmtTime(c.start)}–{fmtTime(c.end)}</b>
              <span class="row cost">
                <Badge kind={c.dc ? 'warn' : 'ok'} text={c.dc ? 'DC' : 'AC'} />
                <b class="num">{c.cost != null ? eur(c.cost) : '—'}</b>
              </span>
            </div>
            <div class="stats">
              <span><Icon path={mdiTimerOutline} size={15} /><b class="num">{fmtDuration(Math.max(1, Math.round((c.end - c.start) / 60e3)))}</b></span>
              <span title={c.source ? SOURCE[c.source] : ''}><Icon path={mdiLightningBolt} size={15} /><b class="num">{fmt(c.kwh, 1)}</b><small>kWh</small></span>
              <span title="Maximum / gemiddeld vermogen"><Icon path={mdiFlash} size={15} /><b class="num">{fmt(c.maxKw, 1)} / {fmt(c.avgKw, 1)}</b><small>kW</small></span>
              <span><Icon path={mdiBatteryArrowUp} size={15} /><b class="num">{fmt(c.socBefore, 0)} → {fmt(c.socAfter, 0)}</b><small>%</small></span>
              <span class="faint">{price(c.price)}/kWh</span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
</div>

<style>
  .kosten { gap: var(--gap); }
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
  .cost { gap: 8px; align-items: center; }
  .stats { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--text-2); }
  .stats span { display: inline-flex; align-items: center; gap: 4px; }
  .stats b { color: var(--text); }
</style>

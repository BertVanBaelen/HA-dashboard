<script>
  import { onMount } from 'svelte';
  import {
    mdiEvStation, mdiLightningBolt, mdiRefresh, mdiInformationOutline, mdiTimerOutline, mdiFlash, mdiRoadVariant, mdiAlertCircleOutline,
    mdiPowerPlugOff, mdiHomeLightningBolt, mdiCalendarRange, mdiCashMultiple, mdiTagOutline, mdiReceiptTextOutline, mdiEvPlugType2, mdiMapMarker,
  } from '@mdi/js';
  import { CAR_CHARGE_PRICES as PRICES } from '$shared/config.js';
  import { fmtDate, fmtTime, fmtDuration, fmtDay, isSameDay, startOfDay } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import RouteMap from './RouteMap.svelte';
  import SocBar from './SocBar.svelte';
  import { loadCarHistory, detectCharges, detectRides, fmt, eur, dayLabel, HISTORY_DAYS, zoneAt } from './carHistory.js';
  import { places, placeLabel, want } from './places.js';
  import './views.css';

  /** @typedef {import('./carHistory.js').Charge} Charge */

  /** @type {Charge[]} */
  let charges = $state([]);
  /** @type {import('./carHistory.js').Zone[]} */
  let zones = $state([]);
  let rideKm = $state(0);
  let loading = $state(true);
  let error = $state('');

  async function load(force = false) {
    loading = true;
    error = '';
    try {
      const h = await loadCarHistory(force);
      charges = detectCharges(h);
      zones = h.zones;
      rideKm = detectRides(h).reduce((s, r) => s + r.km, 0);
      for (const c of charges) if (c.pos && !zoneAt(c.pos, zones)) want(c.pos);
    } catch (e) {
      error = e?.message ?? 'Laden mislukt';
    } finally {
      loading = false;
    }
  }
  onMount(() => load());

  const mins = (/** @type {Charge} */ c) => Math.max(1, Math.round((c.end - c.start) / 60e3));
  const price = (/** @type {number} */ v) => v.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  const SOURCE = { auto: 'volgens de auto', vermogen: 'berekend uit laadvermogen', soc: 'berekend uit laadniveau' };

  const totals = $derived.by(() => {
    const sum = (/** @type {Charge[]} */ l, /** @type {'kwh'|'cost'} */ k) => l.reduce((s, c) => s + (c[k] ?? 0), 0);
    const ac = charges.filter((c) => !c.dc);
    const dc = charges.filter((c) => c.dc);
    const kwh = sum(charges, 'kwh');
    const cost = sum(charges, 'cost');
    return {
      kwh,
      cost,
      min: charges.reduce((s, c) => s + mins(c), 0),
      ac: { kwh: sum(ac, 'kwh'), cost: sum(ac, 'cost'), n: ac.length },
      dc: { kwh: sum(dc, 'kwh'), cost: sum(dc, 'cost'), n: dc.length },
      per100: rideKm > 0 && cost > 0 ? (cost / rideKm) * 100 : null,
      perKwh: kwh > 0 ? cost / kwh : null,
      perCharge: charges.length ? cost / charges.length : null,
    };
  });
  const dcShare = $derived(totals.cost > 0 ? (totals.dc.cost / totals.cost) * 100 : 0);

  const perDay = $derived.by(() => {
    const today = startOfDay().getTime();
    const days = Array.from({ length: HISTORY_DAYS }, (_, i) => {
      const t = new Date(today);
      t.setDate(t.getDate() - (HISTORY_DAYS - 1 - i));
      return { t: t.getTime(), ac: 0, dc: 0 };
    });
    for (const c of charges) {
      const d = days.find((x) => isSameDay(x.t, c.start));
      if (d) d[c.dc ? 'dc' : 'ac'] += c.cost ?? 0;
    }
    const max = Math.max(0.01, ...days.map((d) => d.ac + d.dc));
    return days.map((d) => ({ ...d, hAc: (d.ac / max) * 100, hDc: (d.dc / max) * 100 }));
  });

  const groups = $derived.by(() => {
    /** @type {{ key:string, label:string, cost:number, list:Charge[] }[]} */
    const out = [];
    for (const c of charges) {
      const key = startOfDay(new Date(c.start)).toISOString();
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = { key, label: dayLabel(c.start), cost: 0, list: [] };
        out.push(g);
      }
      g.cost += c.cost ?? 0;
      g.list.push(c);
    }
    return out;
  });

  const kpis = $derived([
    { label: 'Per 100 km', icon: mdiRoadVariant, c: '#6366f1', v: totals.per100 != null ? eur(totals.per100) : '—' },
    { label: 'Gem. per kWh', icon: mdiTagOutline, c: '#f59e0b', v: totals.perKwh != null ? price(totals.perKwh) : '—' },
    { label: 'Per laadbeurt', icon: mdiReceiptTextOutline, c: '#ec4899', v: totals.perCharge != null ? eur(totals.perCharge) : '—' },
    { label: 'Laadtijd', icon: mdiTimerOutline, c: '#14b8a6', v: totals.min ? fmtDuration(totals.min) : '—' },
  ]);
</script>

<div class="av">
  <section class="av-hero" style="--hero: linear-gradient(135deg, #059669 0%, #10b981 45%, #0ea5e9 100%); --hero-glow:#10b981">
    <div class="art"><Icon path={mdiEvStation} size={80} /></div>
    <div class="eyebrow"><Icon path={mdiCalendarRange} size={15} /> Laadkosten · laatste {HISTORY_DAYS} dagen</div>
    <div class="big num">{loading && !charges.length ? '…' : eur(totals.cost)}</div>
    <div class="sub">{fmt(totals.kwh, 1)} kWh geladen in {charges.length} {charges.length === 1 ? 'laadbeurt' : 'laadbeurten'}</div>

    {#if totals.cost > 0}
      <div class="split" aria-label="Verdeling AC / DC">
        <i class="ac" style="width:{100 - dcShare}%"></i>
        <i class="dc" style="width:{dcShare}%"></i>
      </div>
      <div class="legend">
        <span><i class="ac"></i><Icon path={mdiHomeLightningBolt} size={15} /> AC {eur(totals.ac.cost)} <small>· {fmt(totals.ac.kwh, 0)} kWh</small></span>
        <span><i class="dc"></i><Icon path={mdiLightningBolt} size={15} /> DC {eur(totals.dc.cost)} <small>· {fmt(totals.dc.kwh, 0)} kWh</small></span>
      </div>
    {/if}

    <div class="bars" aria-hidden="true">
      {#each perDay as d, i (d.t)}
        <div title="{fmtDate(d.t)}: AC {eur(d.ac)} · DC {eur(d.dc)}">
          <span class="stack" style="height:{Math.max(d.hAc + d.hDc, 4)}%">
            {#if d.hDc}<i class="dcbar" style="flex:{d.hDc}; animation-delay:{i * 40}ms"></i>{/if}
            {#if d.hAc || !d.hDc}<i class:dim={!d.ac} style="flex:{d.hAc || 1}; animation-delay:{i * 40}ms"></i>{/if}
          </span>
          <span>{fmtDay(d.t).slice(0, 2)}</span>
        </div>
      {/each}
    </div>
    <button class="btn icon ghost sm refresh" aria-label="Vernieuwen" disabled={loading} onclick={() => load(true)}>
      <Icon path={mdiRefresh} size={18} class={loading ? 'spin' : ''} />
    </button>
  </section>

  {#if charges.length}
    <div class="av-kpis stagger">
      {#each kpis as k (k.label)}
        <div class="av-kpi" style="--c:{k.c}">
          <span class="ic"><Icon path={k.icon} size={20} /></span>
          <span class="lbl">{k.label}</span>
          <b class="num">{k.v}</b>
        </div>
      {/each}
    </div>
  {/if}

  {#if loading && !charges.length}
    <div class="av-center"><span class="spinner"></span></div>
  {:else if error}
    <Card><EmptyState iconPath={mdiAlertCircleOutline} title="Kon geschiedenis niet laden" text={error} /></Card>
  {:else if !charges.length}
    <Card><EmptyState iconPath={mdiPowerPlugOff} title="Geen laadbeurten gevonden" text="Er zijn geen laadbeurten in de beschikbare geschiedenis." /></Card>
  {:else}
    {#each groups as g (g.key)}
      <div class="av-day"><h3>{g.label}</h3><span>{g.list.length} {g.list.length === 1 ? 'laadbeurt' : 'laadbeurten'} · {eur(g.cost)}</span></div>
      <div class="av-grid">
        {#each g.list as c (c.start)}
          {@const place = placeLabel(c.pos, zones, $places)}
          {@const home = !!place.zone?.home}
          {@const showMap = !!c.pos && !home}
          <article class="av-item charge" class:dc={c.dc}>
            {#if showMap && c.pos}
              <div class="thumb">
                <RouteMap markers={[{ lat: c.pos[0], lon: c.pos[1], kind: c.dc ? 'dc' : 'ac' }]} height="100%" interactive={false} lazy rounded={false} />
                <span class="where"><Icon path={mdiMapMarker} size={14} />{place.long}</span>
              </div>
            {/if}
            <div class="body">
              <div class="head">
                <span class="kind"><Icon path={c.dc ? mdiLightningBolt : home ? mdiHomeLightningBolt : mdiEvPlugType2} size={24} /></span>
                <div class="grow">
                  <b class="ellipsis">{c.dc ? 'Snelladen (DC)' : home ? 'Thuis laden' : 'Laden (AC)'}</b>
                  <div class="small muted ellipsis">{fmtTime(c.start)} – {fmtTime(c.end)}{#if !showMap && c.pos && !home} · {place.short}{/if}</div>
                </div>
                <div class="cost">
                  <b class="num">{c.cost != null ? eur(c.cost) : '—'}</b>
                  <small class="num">{price(c.price)}/kWh</small>
                </div>
              </div>
              <SocBar before={c.socBefore} after={c.socAfter} mode="charge" />
              <div class="av-chips">
                <span class="av-chip" style="--c:#14b8a6"><Icon path={mdiTimerOutline} size={15} /><b>{fmtDuration(mins(c))}</b></span>
                <span class="av-chip" style="--c:#f59e0b" title={c.source ? SOURCE[c.source] : ''}><Icon path={mdiLightningBolt} size={15} /><b>{fmt(c.kwh, 1)}</b><small>kWh</small></span>
                {#if c.maxKw != null}
                  <span class="av-chip" style="--c:{c.dc ? '#ef4444' : '#22c55e'}" title="Maximum / gemiddeld vermogen"><Icon path={mdiFlash} size={15} /><b>{fmt(c.maxKw, 1)} / {fmt(c.avgKw, 1)}</b><small>kW</small></span>
                {/if}
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/each}
  {/if}

  <div class="av-note">
    <Icon path={mdiInformationOutline} size={15} />
    <span>
      AC (&lt; {PRICES.dcThresholdKw} kW): {price(PRICES.acPerKwh)}/kWh · DC (&gt; {PRICES.dcThresholdKw} kW): {price(PRICES.dcPerKwh)}/kWh.
      Berekend uit de Home Assistant-geschiedenis (laatste ~{HISTORY_DAYS} dagen); locaties van de GPS-tracker van de auto.
    </span>
  </div>
</div>

<style>
  .split { display: flex; height: 10px; border-radius: 999px; overflow: hidden; margin-top: 14px; background: rgb(255 255 255 / 0.2); }
  .split i { display: block; height: 100%; transition: width 0.6s var(--ease); }
  .split .ac, .legend i.ac { background: #fff; }
  .split .dc, .legend i.dc { background: linear-gradient(90deg, #fbbf24, #f97316); }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: 0.82rem; font-weight: 600; }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .legend small { opacity: 0.8; font-weight: 500; }
  .av-hero .stack { display: flex; flex-direction: column; width: 100%; max-width: 26px; gap: 2px; }
  .av-hero .stack i { min-height: 0; border-radius: 4px; }
  .av-hero .stack i:first-child { border-radius: 6px 6px 3px 3px; }
  .av-hero .stack .dcbar { background: linear-gradient(180deg, #fde047, #f97316); }

  .thumb { position: relative; height: 120px; }
  .where {
    position: absolute; left: 10px; bottom: 10px; right: 10px; z-index: 500; display: inline-flex; align-items: center; gap: 4px; width: max-content; max-width: calc(100% - 20px);
    padding: 4px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; color: var(--text); pointer-events: none;
    background: color-mix(in srgb, var(--surface-solid) 85%, transparent); box-shadow: var(--shadow); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; }
  .kind {
    width: 46px; height: 46px; border-radius: 15px; display: grid; place-items: center; color: #fff;
    background: linear-gradient(135deg, #22c55e, #059669); box-shadow: 0 8px 18px -8px #16a34a;
  }
  .charge.dc .kind { background: linear-gradient(135deg, #fbbf24, #f97316 55%, #ef4444); box-shadow: 0 8px 18px -8px #f97316; }
  .head b { display: block; font-size: 0.98rem; }
  .cost { text-align: right; display: flex; flex-direction: column; }
  .cost b { font-size: 1.2rem; font-weight: 800; }
  .cost small { font-size: 0.7rem; color: var(--text-3); }
  .charge.dc { border-color: color-mix(in srgb, #f97316 30%, var(--border)); }
</style>

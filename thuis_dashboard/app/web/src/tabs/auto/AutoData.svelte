<script>
  import { mdiChartLine, mdiFormatListBulleted, mdiMagnify, mdiClose, mdiCarWrench, mdiRoadVariant, mdiCounter, mdiLeaf, mdiBatteryHigh } from '@mdi/js';
  import { CAR_ENTITIES } from '$shared/config.js';
  import { states, name } from '../../lib/api.js';
  import { relTime } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import ChartCard from '../grafieken/ChartCard.svelte';
  import { autoCharts } from '../grafieken/charts.js';
  import { GROUPS, ICON_FALLBACK, HIDDEN, formatValue } from './carInfo.js';
  import { stateKwh100 } from './carHistory.js';

  const charts = autoCharts();
  const P = CAR_ENTITIES.soc.replace(/^sensor\./, '').replace(/_state_of_charge$/, '');
  const known = new Set(GROUPS.flatMap((g) => g.items.map((i) => i.id)));
  const SKIP = new Set(['button', 'script']);

  let query = $state('');

  /** @param {string} id */
  const val = (id) => {
    const v = Number($states[id]?.state);
    return $states[id] && Number.isFinite(v) && $states[id].state !== '' ? v : null;
  };
  const effId = `sensor.${P}_efficiency_since_last_charge`;
  const range = $derived(val(CAR_ENTITIES.range));
  const soc = $derived(val(CAR_ENTITIES.soc));
  const fullRange = $derived(range != null && soc ? (range / soc) * 100 : null);
  const kpis = $derived([
    { label: 'Bereik', icon: mdiRoadVariant, v: range, d: 0, unit: 'km' },
    { label: 'Bereik bij 100%', icon: mdiBatteryHigh, v: fullRange, d: 0, unit: 'km' },
    { label: 'Kilometerstand', icon: mdiCounter, v: val(CAR_ENTITIES.mileage), d: 0, unit: 'km' },
    { label: 'Verbruik sinds laden', icon: mdiLeaf, v: stateKwh100($states[effId]), d: 1, unit: 'kWh/100km' },
    { label: 'Verbruik vorige rit', icon: mdiLeaf, v: stateKwh100($states[`sensor.${P}_last_trip_efficiency`]), d: 1, unit: 'kWh/100km' },
  ]);

  const extra = $derived(
    Object.keys($states)
      .filter((id) => id.split('.')[1]?.startsWith(`${P}_`) && !known.has(id) && !HIDDEN.has(id) && !SKIP.has(id.split('.')[0]))
      .sort()
      .map((id) => ({ id, label: name($states[id]).replace(/^MG\s*MG4\s*Electric\s*/i, '') || id, icon: ICON_FALLBACK })),
  );

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const all = extra.length ? [...GROUPS, { key: 'extra', title: 'Overige', icon: mdiCarWrench, accent: '', items: extra }] : GROUPS;
    return all
      .map((g) => ({
        ...g,
        items: g.items
          .filter((i) => $states[i.id] || g.key !== 'extra')
          .map((i) => ({ ...i, st: $states[i.id], f: formatValue($states[i.id], i) }))
          .filter((i) => !q || i.label.toLowerCase().includes(q) || i.f.text.toLowerCase().includes(q) || g.title.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length);
  });
</script>

<div class="data col">
  <div class="kpis">
    {#each kpis as k (k.label)}
      <div class="kpi">
        <span class="kpi-ic"><Icon path={k.icon} size={18} /></span>
        <span class="tiny muted ellipsis">{k.label}</span>
        <b class="num">{k.v != null ? k.v.toLocaleString('nl-BE', { minimumFractionDigits: k.d, maximumFractionDigits: k.d }) : '—'}{#if k.v != null && k.unit}<small>&nbsp;{k.unit}</small>{/if}</b>
      </div>
    {/each}
  </div>

  <div class="section-title row"><Icon path={mdiChartLine} size={16} />Grafieken</div>
  <div class="grid">
    {#each charts as def (def.id)}
      <ChartCard {def} />
    {/each}
  </div>

  <div class="section-title row"><Icon path={mdiFormatListBulleted} size={16} />Alle info</div>
  <label class="search">
    <Icon path={mdiMagnify} size={20} />
    <input class="input" type="search" placeholder="Zoeken…" bind:value={query} aria-label="Zoek in auto-info" />
    {#if query}<button class="btn icon ghost sm" aria-label="Wissen" onclick={() => (query = '')}><Icon path={mdiClose} size={18} /></button>{/if}
  </label>

  {#if !groups.length}
    <div class="muted small empty">Niets gevonden voor “{query}”.</div>
  {/if}
  <div class="grid">
    {#each groups as g (g.key)}
      <Card title={g.title} iconPath={g.icon} accent={g.accent ?? ''} subtitle="{g.items.length} items">
        <ul class="list">
          {#each g.items as i (i.id)}
            <li class:na={i.f.na} title={i.id}>
              <span class="li-ic"><Icon path={i.icon} size={18} /></span>
              <span class="li-lbl col">
                <span class="ellipsis">{i.label}</span>
                {#if i.f.sub}<span class="tiny muted ellipsis">{i.f.sub}</span>{/if}
              </span>
              <span class="li-val col">
                <b class="num {i.f.tone ?? ''}" title={i.f.title}>{i.f.text}{#if i.f.unit}<small>&nbsp;{i.f.unit}</small>{/if}</b>
                {#if i.st && !i.f.na && !i.f.title}<span class="tiny faint">{relTime(i.st.last_changed)}</span>{/if}
              </span>
            </li>
          {/each}
        </ul>
      </Card>
    {/each}
  </div>
</div>

<style>
  .data { gap: var(--gap); }
  .section-title.row { gap: 6px; align-items: center; margin-top: 4px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
  .kpi { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow); min-width: 0; }
  .kpi-ic { grid-row: 1 / 3; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-text, var(--accent)); }
  .kpi b { font-size: 1.15rem; line-height: 1.2; min-width: 0; overflow-wrap: anywhere; }
  .kpi small, .li-val small { font-size: 0.75em; color: var(--text-2); font-weight: 600; }
  .search { display: flex; align-items: center; gap: 8px; padding: 0 6px 0 14px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); color: var(--text-2); max-width: 520px; width: 100%; }
  .search input { flex: 1; min-width: 0; border: 0; background: transparent; box-shadow: none; padding-left: 0; min-height: 44px; }
  .search input:focus { outline: none; }
  .empty { text-align: center; padding: 12px; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .list li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); min-height: 44px; }
  .list li:last-child { border-bottom: 0; }
  .li-ic { width: 32px; height: 32px; flex: none; border-radius: 10px; display: grid; place-items: center; background: var(--surface-2); color: var(--text-2); }
  .li-lbl { flex: 1; min-width: 0; gap: 1px; }
  .li-val { align-items: flex-end; text-align: right; gap: 1px; flex: none; max-width: 55%; }
  .li-val b { overflow-wrap: anywhere; }
  .li-val b.ok { color: var(--ok); }
  .li-val b.warn { color: var(--warn); }
  .li-val b.danger { color: var(--danger); }
  .na .li-val b { color: var(--text-3); font-weight: 600; }
  .na .li-ic { opacity: 0.55; }
</style>

<script>
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { mdiThermometer, mdiCarElectric, mdiBatteryHigh } from '@mdi/js';
  import { DOOR_SENSORS } from '$shared/config.js';
  import { states, household, name } from '../lib/api.js';
  import Segmented from '../components/Segmented.svelte';
  import ChartCard from './grafieken/ChartCard.svelte';
  import { klimaatCharts, autoCharts, batterijCharts, extraBatterySensors } from './grafieken/charts.js';

  const VIEWS = [
    { value: 'klimaat', label: 'Klimaat', iconPath: mdiThermometer },
    { value: 'auto', label: 'Auto', iconPath: mdiCarElectric, color: 'var(--ok)' },
    { value: 'batterijen', label: 'Batterijen', iconPath: mdiBatteryHigh, color: 'var(--accent-2)' },
  ];

  const stored = sessionStorage.getItem('grafieken.view');
  let view = $state(VIEWS.some((v) => v.value === stored) ? stored : 'klimaat');

  function setView(v) {
    view = v;
    sessionStorage.setItem('grafieken.view', v);
  }

  const labelKey = $derived(JSON.stringify(DOOR_SENSORS.map((d) => $household?.sensorLabels?.[d.entity] ?? d.defaultLabel)));
  const klimaat = klimaatCharts();
  const auto = autoCharts();
  const extraKey = $derived(JSON.stringify(extraBatterySensors($states)));
  const batterijen = $derived.by(() => {
    labelKey;
    const extra = JSON.parse(extraKey);
    return untrack(() => batterijCharts($household?.sensorLabels ?? {}, (id) => ($states[id] ? name($states[id]) : undefined), extra));
  });

  const charts = $derived(view === 'klimaat' ? klimaat : view === 'auto' ? auto : batterijen);
</script>

<div class="col" style="gap:var(--gap)">
  <div class="views">
    <Segmented options={VIEWS} value={view} onchange={setView} />
  </div>

  {#key view}
    <div class="grid stagger" in:fly={{ y: 12, duration: 320 }}>
      {#each charts as def (def.id)}
        <ChartCard {def} />
      {/each}
    </div>
  {/key}
</div>

<style>
  .views { max-width: 520px; width: 100%; margin: 0 auto; }
</style>

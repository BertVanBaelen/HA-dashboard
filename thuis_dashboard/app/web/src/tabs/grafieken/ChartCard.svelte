<script>
  import { onMount, untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { mdiRefresh } from '@mdi/js';
  import { states, num } from '../../lib/api.js';
  import Card from '../../components/Card.svelte';
  import Chip from '../../components/Chip.svelte';
  import Icon from '../../components/Icon.svelte';
  import Chart from './Chart.svelte';
  import { RANGES, loadChart } from './data.js';

  /** @type {{ def: import('./data.js').ChartDef }} */
  let { def } = $props();

  const ranges = $derived(def.ranges ?? Object.keys(RANGES));
  let range = $state(untrack(() => def.defaultRange));
  let data = $state(/** @type {import('./data.js').ChartData|null} */ (null));
  let loading = $state(false);
  let error = $state('');
  let visible = $state(false);
  let hidden = $state(/** @type {number[]} */ ([]));
  /** @type {HTMLDivElement} */
  let root;
  let token = 0;

  const availKey = $derived(def.series.filter((s) => $states[s.entity]).map((s) => `${s.entity}|${s.attr ?? ''}|${s.stat ?? ''}`).join(','));
  const series = $derived.by(() => {
    availKey;
    return untrack(() =>
      def.series
        .filter((s) => $states[s.entity])
        .map((s) => ({ ...s, unit: s.unit ?? (s.attr ? '' : $states[s.entity]?.attributes?.unit_of_measurement ?? '') })),
    );
  });

  const primary = $derived(def.series.find((s) => !s.attr && $states[s.entity]));
  const current = $derived(primary ? $states[primary.entity] : null);

  async function load() {
    const my = ++token;
    loading = true;
    error = '';
    try {
      const d = await loadChart({ ...def, series }, range);
      if (my === token) data = d;
    } catch (e) {
      if (my === token) error = e?.message ?? 'Laden mislukt';
    } finally {
      if (my === token) loading = false;
    }
  }

  $effect(() => {
    if (!visible || !series.length) return;
    range;
    untrack(load);
  });

  onMount(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          visible = true;
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(root);
    const t = setInterval(() => visible && !document.hidden && !loading && load(), 5 * 60e3);
    return () => {
      io.disconnect();
      clearInterval(t);
    };
  });

  function setRange(r) {
    if (r === range) return;
    range = r;
  }

  function toggle(i) {
    hidden = hidden.includes(i) ? hidden.filter((x) => x !== i) : [...hidden, i];
  }

  const empty = $derived(data && (!data.x.length || data.raw.every((a) => a.every((v) => v == null))));
  const height = $derived(def.height ?? 220);
</script>

<div bind:this={root} class="chart-card">
  <Card title={def.title} iconPath={def.iconPath} accent={def.accent ?? ''}>
    {#snippet actions()}
      {#if current && primary}
        <span class="now num">{primary.map ? (Number.isFinite(Number(current.state)) ? num({ state: primary.map(Number(current.state)) }, primary.digits ?? 1) : '–') : num(current, primary.digits ?? 1)}<small>{series.find((s) => s.entity === primary.entity)?.unit ?? ''}</small></span>
      {/if}
      <button class="btn icon ghost sm" aria-label="Vernieuwen" disabled={loading || !visible} onclick={load}>
        <Icon path={mdiRefresh} size={18} class={loading ? 'spin' : ''} />
      </button>
    {/snippet}

    {#if !series.length}
      <div class="muted small na">Niet beschikbaar</div>
    {:else}
      {#if ranges.length > 1}
        <div class="row ranges">
          {#each ranges as r (r)}
            <Chip label={RANGES[r].label} active={r === range} color={def.accent ?? ''} onclick={() => setRange(r)} />
          {/each}
        </div>
      {/if}

      <div class="body" style="min-height:{height}px">
        {#if data && !empty}
          <div class="chart-holder" class:dim={loading}>
            <Chart {data} {series} axes={def.axes} stacked={def.stacked} {hidden} {height} />
          </div>
        {/if}
        {#if loading && (!data || empty)}
          <div class="skeleton sk" style="height:{height}px" transition:fade={{ duration: 200 }}></div>
        {:else if error && !data}
          <div class="center muted small" style="height:{height}px">Kon gegevens niet laden</div>
        {:else if empty && !loading}
          <div class="center muted small" style="height:{height}px">Geen gegevens in deze periode</div>
        {:else if !data}
          <div class="skeleton sk" style="height:{height}px"></div>
        {/if}
      </div>

      {#if series.length > 1}
        <div class="row wrap legend">
          {#each series as s, i (s.entity + (s.attr ?? '') + (s.stat ?? ''))}
            <button class="leg" class:off={hidden.includes(i)} onclick={() => toggle(i)} style="--c:{s.color.startsWith('--') ? `var(${s.color})` : s.color}">
              <span class="swatch" class:dash={s.dash}></span>
              {s.label}
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </Card>
</div>

<style>
  .chart-card { min-width: 0; }
  .ranges { gap: 6px; margin-bottom: 10px; overflow-x: auto; scrollbar-width: none; }
  .body { position: relative; }
  .chart-holder { transition: opacity 0.3s var(--ease); }
  .chart-holder.dim { opacity: 0.45; }
  .sk { border-radius: var(--radius-sm); }
  .center { display: grid; place-items: center; text-align: center; }
  .na { padding: 12px 0; }
  .now { font-weight: 700; font-size: 1.05rem; }
  .now small { font-size: 0.72rem; color: var(--text-2); margin-left: 2px; font-weight: 600; }
  .legend { gap: 6px; margin-top: 10px; }
  .leg {
    display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 4px 12px;
    border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2);
    font-size: 0.8rem; font-weight: 600; cursor: pointer; color: var(--text);
    transition: opacity 0.25s, transform 0.18s var(--spring), background 0.25s;
  }
  .leg:active { transform: scale(0.94); }
  .leg.off { opacity: 0.45; }
  .leg.off .swatch { background: transparent; }
  .swatch { width: 14px; height: 4px; border-radius: 4px; background: var(--c); border: 1.5px solid var(--c); box-sizing: content-box; transition: background 0.25s; }
  .swatch.dash { background: repeating-linear-gradient(90deg, var(--c) 0 4px, transparent 4px 7px); border: 0; height: 3px; }
</style>

<script>
  import { scale } from 'svelte/transition';

  /** @type {{ tyres: {label:string, value:number|null, unit:string}[] }} */
  let { tyres } = $props();

  const status = (v) => (v == null ? 'na' : v < 2.0 || v > 3.2 ? 'bad' : v < 2.2 || v > 3.0 ? 'warn' : 'ok');
  const fmt = (v) => (v == null ? '–' : v.toFixed(1).replace('.', ','));
</script>

<div class="tyres">
  {#each tyres as t, i (t.label)}
    <div class="p p{i} {status(t.value)}" in:scale={{ start: 0.8, delay: 80 * i, duration: 350 }}>
      <span class="v num">{fmt(t.value)}<small>{t.unit}</small></span>
      <span class="tiny muted">{t.label}</span>
    </div>
  {/each}
  <svg class="car" viewBox="0 0 100 180" aria-hidden="true">
    {#each [[6, 34], [82, 34], [6, 122], [82, 122]] as [x, y], i}
      <rect class="wheel {status(tyres[i]?.value)}" {x} {y} width="12" height="28" rx="5" />
    {/each}
    <rect class="body" x="14" y="8" width="72" height="164" rx="30" />
    <path class="glass" d="M24 56 Q50 44 76 56 L72 78 Q50 72 28 78 Z" />
    <path class="glass" d="M27 132 Q50 138 73 132 L75 148 Q50 156 25 148 Z" />
    <rect class="roof" x="28" y="82" width="44" height="46" rx="10" />
  </svg>
</div>

<style>
  .tyres { display: grid; grid-template-columns: 1fr 90px 1fr; grid-template-rows: 1fr 1fr; gap: 10px 12px; align-items: center; }
  .car { grid-column: 2; grid-row: 1 / 3; width: 90px; height: 160px; justify-self: center; }
  .body { fill: var(--surface-2); stroke: var(--border); stroke-width: 2; }
  .roof { fill: var(--surface-3); }
  .glass { fill: color-mix(in srgb, var(--accent) 25%, var(--surface-3)); }
  .wheel { fill: var(--text-3); transition: fill 0.4s; }
  .wheel.ok { fill: var(--ok); }
  .wheel.warn { fill: var(--warn); }
  .wheel.bad { fill: var(--danger); animation: blink 1.2s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: 0.35; } }
  .p { --c: var(--text-3); display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 16px; background: color-mix(in srgb, var(--c) 12%, var(--surface-2)); border: 1px solid color-mix(in srgb, var(--c) 30%, transparent); }
  .p.ok { --c: var(--ok); } .p.warn { --c: var(--warn); } .p.bad { --c: var(--danger); }
  .p0 { grid-column: 1; grid-row: 1; text-align: right; align-items: flex-end; }
  .p1 { grid-column: 3; grid-row: 1; }
  .p2 { grid-column: 1; grid-row: 2; text-align: right; align-items: flex-end; }
  .p3 { grid-column: 3; grid-row: 2; }
  .v { font-size: 1.35rem; font-weight: 800; color: var(--c); }
  .p.ok .v, .p.na .v { color: var(--text); }
  .v small { font-size: 0.6em; font-weight: 600; color: var(--text-2); margin-left: 3px; }
</style>

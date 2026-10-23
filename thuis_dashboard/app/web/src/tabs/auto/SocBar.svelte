<script>
  /**
   * Battery level bar showing the change during a ride (drain) or charge session.
   * @type {{ before:number|null, after:number|null, mode?:'drain'|'charge' }}
   */
  let { before, after, mode = 'drain' } = $props();

  const ok = $derived(before != null && after != null);
  const lo = $derived(ok ? Math.max(0, Math.min(100, Math.min(/** @type {number} */ (before), /** @type {number} */ (after)))) : 0);
  const hi = $derived(ok ? Math.max(0, Math.min(100, Math.max(/** @type {number} */ (before), /** @type {number} */ (after)))) : 0);
  const delta = $derived(ok ? Math.round(/** @type {number} */ (after) - /** @type {number} */ (before)) : 0);
</script>

{#if ok}
  <div class="soc {mode}" title="Batterij {Math.round(before ?? 0)}% → {Math.round(after ?? 0)}%">
    <div class="bar">
      <i class="base" style="width:{lo}%"></i>
      <i class="delta" style="left:{lo}%; width:{Math.max(hi - lo, 0.8)}%"></i>
      <span class="cap"></span>
    </div>
    <div class="lbl">
      <span class="num">{Math.round(before ?? 0)}%</span>
      <b class="num">{delta > 0 ? '+' : ''}{delta}%</b>
      <span class="num">{Math.round(after ?? 0)}%</span>
    </div>
  </div>
{/if}

<style>
  .soc { display: flex; flex-direction: column; gap: 4px; }
  .bar {
    position: relative; height: 12px; border-radius: 5px; background: var(--surface-3, var(--surface-2));
    border: 1.5px solid var(--border); overflow: visible; margin-right: 5px;
  }
  .bar i { position: absolute; top: 0; bottom: 0; border-radius: 3px; animation: fill 0.8s var(--ease) both; transform-origin: left; }
  .base { left: 0; background: linear-gradient(90deg, #22c55e, #4ade80); }
  .drain .delta { background: repeating-linear-gradient(-45deg, #f97316 0 4px, #fb923c 4px 8px); opacity: 0.85; }
  .charge .delta { background: linear-gradient(90deg, #22d3ee, #3b82f6); box-shadow: 0 0 10px -1px #38bdf8; }
  .cap { position: absolute; right: -6px; top: 50%; translate: 0 -50%; width: 3px; height: 6px; border-radius: 0 2px 2px 0; background: var(--border); }
  .lbl { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-3); }
  .lbl b { font-size: 0.75rem; color: var(--text-2); }
  .drain .lbl b { color: #f97316; }
  .charge .lbl b { color: #0ea5e9; }
  @keyframes fill { from { transform: scaleX(0); } }
</style>

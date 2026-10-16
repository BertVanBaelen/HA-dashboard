<script>
  import { states, household, name } from '../../lib/api.js';
  import { colorFor } from '../../lib/colors.js';
  import { fmtTime } from '../../lib/format.js';

  /** @type {{ e: any, onclick?: () => void }} */
  let { e, onclick } = $props();
  const cal = $derived(name($states[e.calendar]) || e.calendar);
</script>

<button class="ev" style="--c:{colorFor(e.calendar, $household)}" {onclick}>
  <span class="bar"></span>
  <span class="time num">
    {#if e.allDay}<span class="small">Hele dag</span>{:else}<b>{fmtTime(e.start)}</b><span class="tiny faint">{fmtTime(e.end)}</span>{/if}
  </span>
  <span class="txt">
    <b class="ellipsis">{e.summary}</b>
    <span class="tiny muted ellipsis"><i class="dot"></i>{cal}{e.location ? ` · ${e.location}` : ''}</span>
  </span>
</button>

<style>
  .ev {
    display: flex; align-items: stretch; gap: 12px; width: 100%; text-align: left; border: 0; cursor: pointer;
    background: color-mix(in srgb, var(--c) 9%, var(--surface-2)); border-radius: var(--radius-sm);
    padding: 10px 12px 10px 10px; min-height: 52px; transition: transform 0.18s var(--spring), background 0.2s;
  }
  .ev:hover { background: color-mix(in srgb, var(--c) 16%, var(--surface-2)); }
  .ev:active { transform: scale(0.97); }
  .bar { width: 4px; border-radius: 4px; background: var(--c); flex-shrink: 0; box-shadow: 0 0 10px -2px var(--c); }
  .time { display: flex; flex-direction: column; justify-content: center; min-width: 48px; line-height: 1.2; }
  .txt { display: flex; flex-direction: column; justify-content: center; min-width: 0; gap: 2px; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--c); margin-right: 5px; vertical-align: 1px; }
</style>

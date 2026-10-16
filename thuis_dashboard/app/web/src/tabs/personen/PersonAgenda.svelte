<script>
  import { fade, slide } from 'svelte/transition';
  import { mdiCalendarClock, mdiMapMarkerOutline } from '@mdi/js';
  import { household } from '../../lib/api.js';
  import { colorFor } from '../../lib/colors.js';
  import { fmtTime, isSameDay, fmtDate } from '../../lib/format.js';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ active: any[], next: any[], now: Date }} */
  let { active = [], next = [], now } = $props();

  const key = (e) => `${e.calendar}|${e.uid ?? ''}|${e.summary}|${e.start.getTime()}`;
  const until = (e) => {
    if (e.allDay) {
      const last = new Date(e.end.getTime() - 1);
      return isSameDay(last, now) ? 'Hele dag' : `Hele dag · t/m ${fmtDate(last)}`;
    }
    return isSameDay(e.end, now) ? `tot ${fmtTime(e.end)}` : `tot ${fmtDate(e.end)} ${fmtTime(e.end)}`;
  };
  const shown = $derived(active.length ? next.slice(0, 1) : []);
</script>

{#if active.length}
  <div class="agenda" transition:slide={{ duration: 220 }}>
    <span class="tiny muted head"><Icon path={mdiCalendarClock} size={14} />Nu bezig</span>
    {#each active as e (key(e))}
      <div class="ev" style="--c:{colorFor(e.calendar, $household)}" in:fade={{ duration: 200 }}>
        <span class="dot"></span>
        <span class="col grow body">
          <b class="ellipsis">{e.summary}</b>
          <span class="tiny muted meta">
            <span>{until(e)}</span>
            {#if e.location}<span class="loc ellipsis"><Icon path={mdiMapMarkerOutline} size={12} />{e.location}</span>{/if}
          </span>
        </span>
      </div>
    {/each}
    {#each shown as e (key(e))}
      <span class="tiny faint later ellipsis" style="--c:{colorFor(e.calendar, $household)}" in:fade={{ duration: 200 }}>
        <span class="dot sm"></span>Straks {fmtTime(e.start)} · {e.summary}
      </span>
    {/each}
  </div>
{/if}

<style>
  .agenda { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); }
  .head { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .ev { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 6px 8px 6px 6px; border-radius: 11px; background: color-mix(in srgb, var(--c) 12%, transparent); }
  .body { gap: 1px; min-width: 0; }
  .meta { display: flex; gap: 8px; min-width: 0; }
  .meta > span { flex-shrink: 0; }
  .meta .loc { flex-shrink: 1; display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
  .dot { width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; background: var(--c); margin-left: 4px; }
  .dot.sm { width: 7px; height: 7px; margin: 0 6px 0 4px; display: inline-block; }
  .later { display: flex; align-items: center; min-width: 0; }
</style>

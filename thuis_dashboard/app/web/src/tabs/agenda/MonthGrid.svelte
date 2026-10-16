<script>
  import { isSameDay, startOfDay } from '../../lib/format.js';
  import { dayKey } from './util.js';

  /** @type {{ days: Date[], month: number, byDay: Map<string, any[]>, selected?: Date|null, onpick: (d: Date) => void }} */
  let { days, month, byDay, selected = null, onpick } = $props();
  const WD = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const today = startOfDay();

  function dots(list) {
    const seen = [];
    for (const e of list) if (!seen.includes(e.color)) seen.push(e.color);
    return seen;
  }
</script>

<div class="month">
  {#each WD as w}<div class="wd tiny faint">{w}</div>{/each}
  {#each days as d (d.getTime())}
    {@const list = byDay.get(dayKey(d)) ?? []}
    {@const cols = dots(list)}
    <button
      class="day"
      class:out={d.getMonth() !== month}
      class:today={isSameDay(d, today)}
      class:sel={selected && isSameDay(d, selected)}
      class:has={list.length > 0}
      onclick={() => onpick(d)}
      aria-label={d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }) + `, ${list.length} afspraken`}
    >
      <span class="n num">{d.getDate()}</span>
      <span class="dots">
        {#each cols.slice(0, 4) as c, i}<i style="--c:{c};--d:{i * 40}ms"></i>{/each}
        {#if cols.length > 4}<span class="more">+</span>{/if}
      </span>
      <span class="titles">
        {#each list.slice(0, 3) as e}<span class="t ellipsis" style="--c:{e.color}">{e.summary}</span>{/each}
        {#if list.length > 3}<span class="tiny faint">+{list.length - 3} meer</span>{/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
  .wd { text-align: center; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; padding: 2px 0 4px; }
  .day {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 54px; padding: 6px 2px;
    border: 1px solid transparent; border-radius: 14px; background: var(--surface-2); cursor: pointer; overflow: hidden;
    transition: transform 0.18s var(--spring), background 0.2s, border-color 0.2s, box-shadow 0.25s;
  }
  .day:hover { background: var(--surface-3); }
  .day:active { transform: scale(0.92); }
  .day.out { opacity: 0.4; background: transparent; }
  .n { font-weight: 700; font-size: 0.95rem; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; transition: background 0.2s; }
  .today .n { background: var(--gradient); color: #fff; box-shadow: 0 4px 14px -4px var(--accent); }
  .sel { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .dots { display: flex; gap: 3px; align-items: center; height: 8px; }
  .dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); box-shadow: 0 0 6px -1px var(--c); animation: pop 0.4s var(--spring) both; animation-delay: var(--d); }
  .more { font-size: 0.7rem; font-weight: 800; color: var(--text-3); line-height: 1; }
  .titles { display: none; }
  @media (min-width: 760px) {
    .day { min-height: 104px; align-items: stretch; padding: 6px; }
    .n { align-self: flex-start; }
    .dots { display: none; }
    .titles { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; }
    .t {
      font-size: 0.72rem; font-weight: 600; padding: 2px 6px; border-radius: 6px; display: block;
      background: color-mix(in srgb, var(--c) 18%, transparent); border-left: 3px solid var(--c);
    }
  }
</style>

<script>
  import { onMount } from 'svelte';
  import { isSameDay, startOfDay, fmtTime } from '../../lib/format.js';
  import { addDays, dayKey } from './util.js';

  /** @type {{ start: Date, byDay: Map<string, any[]>, onopen: (e: any) => void, onday?: (d: Date) => void }} */
  let { start, byDay, onopen, onday } = $props();
  const H = 44;
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  let scroller = $state(/** @type {HTMLElement|null} */ (null));
  let now = $state(new Date());

  const days = $derived(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  const allDay = $derived(days.map((d) => (byDay.get(dayKey(d)) ?? []).filter((e) => e.allDay)));
  const hasAllDay = $derived(allDay.some((l) => l.length));
  const blocks = $derived(days.map((d) => layout(byDay.get(dayKey(d)) ?? [], d)));

  function layout(list, day) {
    const s0 = day.getTime();
    const e0 = addDays(day, 1).getTime();
    const items = list
      .filter((e) => !e.allDay)
      .map((e) => ({ e, s: Math.max(e.start.getTime(), s0), en: Math.min(Math.max(e.end.getTime(), e.start.getTime() + 20 * 60e3), e0), lane: 0, n: 1 }))
      .sort((a, b) => a.s - b.s || b.en - a.en);
    const lanes = [];
    let cluster = [];
    let clusterEnd = 0;
    const flush = () => {
      const n = Math.max(1, ...cluster.map((c) => c.lane + 1));
      cluster.forEach((c) => (c.n = n));
      cluster = [];
      lanes.length = 0;
    };
    for (const it of items) {
      if (cluster.length && it.s >= clusterEnd) flush();
      let l = lanes.findIndex((end) => end <= it.s);
      if (l < 0) {
        l = lanes.length;
        lanes.push(it.en);
      } else lanes[l] = it.en;
      it.lane = l;
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.en);
    }
    if (cluster.length) flush();
    return items.map((it) => ({
      ...it,
      top: ((it.s - s0) / 60e3) * (H / 60),
      height: Math.max(20, ((it.en - it.s) / 60e3) * (H / 60) - 2),
    }));
  }

  const nowTop = $derived(((now.getTime() - startOfDay(now).getTime()) / 60e3) * (H / 60));

  onMount(() => {
    const t = setInterval(() => (now = new Date()), 60e3);
    if (scroller) scroller.scrollTop = Math.max(0, (days.some((d) => isSameDay(d, now)) ? now.getHours() - 2 : 7) * H);
    return () => clearInterval(t);
  });
</script>

<div class="week">
  <div class="head row7">
    <span></span>
    {#each days as d (d.getTime())}
      <button class="dh" class:today={isSameDay(d, now)} onclick={() => onday?.(d)}>
        <span class="tiny faint">{d.toLocaleDateString('nl-BE', { weekday: 'short' }).replace('.', '')}</span>
        <b class="num">{d.getDate()}</b>
      </button>
    {/each}
  </div>
  {#if hasAllDay}
    <div class="row7 allday">
      <span class="tiny faint gut">dag</span>
      {#each allDay as list, i (i)}
        <div class="adc">
          {#each list as e}
            <button class="ad ellipsis" style="--c:{e.color}" onclick={() => onopen(e)}>{e.summary}</button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
  <div class="scroll" bind:this={scroller}>
    <div class="row7 body" style="height:{24 * H}px;--h:{H}px">
      <div class="gutter">
        {#each HOURS as h}<span class="tiny faint" style="top:{h * H}px">{String(h).padStart(2, '0')}</span>{/each}
      </div>
      {#each days as d, i (d.getTime())}
        <div class="col7" class:today={isSameDay(d, now)}>
          {#each blocks[i] as b (b.e.uid ?? `${b.e.calendar}${b.e.start.getTime()}${b.e.summary}`)}
            <button
              class="blk"
              style="--c:{b.e.color};top:{b.top}px;height:{b.height}px;left:calc({(b.lane / b.n) * 100}% + 1px);width:calc({100 / b.n}% - 2px)"
              onclick={() => onopen(b.e)}
              title={`${fmtTime(b.e.start)} ${b.e.summary}`}
            >
              <span class="bt">{b.e.summary}</span>
              {#if b.height > 34}<span class="bm">{fmtTime(b.e.start)}</span>{/if}
            </button>
          {/each}
          {#if isSameDay(d, now)}<div class="now" style="top:{nowTop}px"></div>{/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .row7 { display: grid; grid-template-columns: 30px repeat(7, minmax(0, 1fr)); gap: 3px; }
  .head { padding-bottom: 6px; }
  .dh { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: none; cursor: pointer; padding: 4px 0; border-radius: 12px; min-height: 44px; transition: background 0.2s; }
  .dh:hover { background: var(--surface-2); }
  .dh b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; }
  .dh.today b { background: var(--gradient); color: #fff; box-shadow: 0 4px 14px -4px var(--accent); }
  .allday { padding-bottom: 6px; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
  .gut { align-self: center; text-align: center; }
  .adc { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ad {
    border: 0; cursor: pointer; font-size: 0.68rem; font-weight: 700; padding: 3px 4px; border-radius: 6px; text-align: left;
    background: color-mix(in srgb, var(--c) 22%, var(--surface-2)); border-left: 3px solid var(--c); color: var(--text); display: block;
  }
  .scroll { max-height: 460px; overflow-y: auto; overscroll-behavior: contain; border-radius: var(--radius-sm); }
  .body { position: relative; }
  .gutter { position: relative; }
  .gutter span { position: absolute; right: 2px; transform: translateY(-50%); }
  .gutter span:first-child { transform: none; }
  .col7 {
    position: relative; border-radius: 8px;
    background: repeating-linear-gradient(to bottom, var(--surface-2) 0, var(--surface-2) 1px, transparent 1px, transparent var(--h));
  }
  .col7.today { background-color: var(--accent-softer); }
  .blk {
    position: absolute; border: 0; cursor: pointer; overflow: hidden; text-align: left; padding: 3px 4px; border-radius: 7px;
    background: color-mix(in srgb, var(--c) 26%, var(--surface-solid)); border-left: 3px solid var(--c); color: var(--text);
    display: flex; flex-direction: column; gap: 1px; animation: fade-up 0.35s var(--ease) both;
    transition: transform 0.18s var(--spring), box-shadow 0.2s;
  }
  .blk:hover { box-shadow: 0 6px 16px -8px var(--c); z-index: 2; }
  .blk:active { transform: scale(0.95); }
  .bt { font-size: 0.68rem; font-weight: 700; line-height: 1.15; word-break: break-word; }
  .bm { font-size: 0.62rem; color: var(--text-2); }
  .now { position: absolute; left: -2px; right: 0; height: 2px; background: var(--danger); z-index: 3; pointer-events: none; }
  .now::before { content: ''; position: absolute; left: -3px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--danger); animation: pulse-ring 1.6s infinite; --pulse: var(--danger); }
  @media (min-width: 760px) {
    .row7 { grid-template-columns: 44px repeat(7, minmax(0, 1fr)); gap: 6px; }
    .bt { font-size: 0.78rem; }
    .ad { font-size: 0.75rem; }
    .scroll { max-height: 600px; }
  }
</style>

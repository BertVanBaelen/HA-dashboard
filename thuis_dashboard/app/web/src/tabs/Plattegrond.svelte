<script>
  import {
    mdiFire, mdiLightbulbOn, mdiLightbulbOutline, mdiWindowOpenVariant, mdiDoorOpen, mdiPower, mdiChevronRight,
  } from '@mdi/js';
  import { FLOORPLAN, FLOORPLAN_ROOMS } from '$shared/config.js';
  import { states, household } from '../lib/api.js';
  import Icon from '../components/Icon.svelte';
  import RoomSheet from './plattegrond/RoomSheet.svelte';
  import { planIcon } from './plattegrond/icons.js';
  import { summarize, fmt } from './plattegrond/summary.js';
  import { css } from './verlichting/color.js';
  import FloorSvg from './plattegrond/FloorSvg.svelte';

  /** @type {import('./plattegrond/summary.js').PlanRoom[]} */
  const rooms = FLOORPLAN_ROOMS;
  const [vx, vy, vw, vh] = FLOORPLAN.viewBox;
  const pct = (/** @type {number} */ v, /** @type {number} */ total) => `${((v / total) * 100).toFixed(3)}%`;
  const box = (/** @type {number[]} */ r) => `left:${pct(r[0] - vx, vw)};top:${pct(r[1] - vy, vh)};width:${pct(r[2], vw)};height:${pct(r[3], vh)}`;
  // Small regions only get a single-line badge
  const compact = (/** @type {number[]} */ r) => r[3] / vh < 0.15 || r[2] / vw < 0.26;

  const sums = $derived(Object.fromEntries(rooms.map((r) => [r.id, summarize(r, $states, $household)])));

  let selected = $state(/** @type {import('./plattegrond/summary.js').PlanRoom|null} */ (null));
  let open = $state(false);
  function show(r) {
    selected = r;
    open = true;
  }

  function describe(/** @type {ReturnType<typeof summarize>} */ s) {
    if (!s.deviceCount) return 'Geen apparaten';
    const parts = [];
    if (s.temp != null) parts.push(`${fmt(s.temp)}°${s.humidity != null ? ` · ${fmt(s.humidity, 0)}%` : ''}`);
    if (s.heating) parts.push('verwarmt');
    if (s.lightCount) parts.push(s.lightsOn ? `${s.lightsOn} lamp${s.lightsOn > 1 ? 'en' : ''} aan` : 'licht uit');
    if (s.mediaOn) parts.push(s.mediaPlaying ? 'media speelt' : 'media aan');
    if (s.openCount) parts.push(s.openKind === 'door' ? 'deur open' : 'raam open');
    if (s.switchesOn) parts.push(`${s.switchesOn} stopcontact${s.switchesOn > 1 ? 'en' : ''} aan`);
    return parts.join(' · ') || `${s.deviceCount} apparaten`;
  }
</script>

<div class="plattegrond">
  <div class="plan-wrap">
    <div class="plan no-swipe" style="aspect-ratio:{vw} / {vh}" role="group" aria-label="Plattegrond van het appartement">
      <FloorSvg />
      {#each rooms as r (r.id)}
        {@const s = sums[r.id]}
        <button
          class="room"
          class:sel={open && selected?.id === r.id}
          class:lit={s.lightsOn > 0}
          class:heating={s.heating}
          class:alert={s.openCount > 0}
          class:bare={!s.deviceCount}
          style="{box(r.rect)};--lamp:{s.lampColor ? css(s.lampColor) : 'transparent'};--lvl:{s.lampLevel}"
          aria-label="{r.name}: {describe(s)}"
          onclick={() => show(r)}
        >
          <span class="glow"></span>
          <span class="badge" class:compact={compact(r.rect)}>
            <span class="name"><Icon path={planIcon(r.icon)} size={13} /><span class="ellipsis">{r.name}</span></span>
            {#if s.deviceCount}
              {#if s.temp != null}
                <span class="temp num">{fmt(s.temp)}°{#if s.humidity != null}<small>{fmt(s.humidity, 0)}%</small>{/if}</span>
              {/if}
              <span class="inds">
                {#if s.hasClimate}
                  <i class="ind heat" class:on={s.heating} title={s.heating ? 'Verwarmt' : 'Verwarming niet actief'}><Icon path={mdiFire} size={14} /></i>
                {/if}
                {#if s.lightCount}
                  <i class="ind lamp" class:on={s.lightsOn > 0} title="{s.lightsOn} van {s.lightCount} lampen aan">
                    <Icon path={s.lightsOn ? mdiLightbulbOn : mdiLightbulbOutline} size={14} />{#if s.lightsOn}<b>{s.lightsOn}</b>{/if}
                  </i>
                {/if}
                {#if s.mediaOn}
                  <i class="ind media on" class:playing={s.mediaPlaying} title={s.mediaPlaying ? 'Media speelt' : 'Media aan'}><Icon path={planIcon(s.mediaKind)} size={14} /></i>
                {/if}
                {#if s.switchesOn}
                  <i class="ind sw on" title="{s.switchesOn} aan"><Icon path={mdiPower} size={13} /><b>{s.switchesOn}</b></i>
                {/if}
                {#if s.openCount}
                  <i class="ind open on" title="Open"><Icon path={s.openKind === 'door' ? mdiDoorOpen : mdiWindowOpenVariant} size={14} /></i>
                {/if}
              </span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
    <p class="hint tiny faint">Tik op een ruimte voor alle bediening</p>
  </div>

  <div class="list">
    <h3 class="section-title">Ruimtes</h3>
    <div class="rooms stagger">
      {#each rooms as r (r.id)}
        {@const s = sums[r.id]}
        <button class="room-row" class:lit={s.lightsOn > 0} class:heating={s.heating} class:bare={!s.deviceCount} style="--lamp:{s.lampColor ? css(s.lampColor) : 'var(--accent)'}" onclick={() => show(r)}>
          <span class="rr-ic"><Icon path={planIcon(r.icon)} size={22} /></span>
          <span class="grow col" style="gap:1px">
            <strong class="ellipsis">{r.name}</strong>
            <span class="small muted ellipsis">{describe(s)}</span>
          </span>
          {#if s.openCount}<span class="danger"><Icon path={s.openKind === 'door' ? mdiDoorOpen : mdiWindowOpenVariant} size={18} /></span>{/if}
          <span class="faint"><Icon path={mdiChevronRight} size={20} /></span>
        </button>
      {/each}
    </div>
  </div>
</div>

<RoomSheet room={selected} bind:open />

<style>
  .plattegrond { display: flex; flex-direction: column; gap: var(--gap); }
  @media (min-width: 900px) {
    .plattegrond {
      display: grid; align-items: start;
      grid-template-columns: min(55%, max(340px, calc((100dvh - 200px) * 300 / 520))) minmax(300px, 1fr);
    }
    .plan-wrap { position: sticky; top: 12px; }
    .list .section-title:first-child { margin-top: 0; }
  }

  .plan-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .plan {
    position: relative; overflow: hidden; isolation: isolate;
    width: min(100%, max(300px, calc((100dvh - 200px) * 300 / 520)));
    border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow);
    background: var(--surface-2); user-select: none; -webkit-user-select: none;
  }

  .room {
    position: absolute; display: grid; place-items: center; padding: 3px; margin: 0; cursor: pointer;
    background: transparent; border: 2px solid transparent; border-radius: 12px; color: var(--text);
    transition: background 0.35s var(--ease), border-color 0.3s, box-shadow 0.4s var(--ease);
    -webkit-tap-highlight-color: transparent;
  }
  .room:hover, .room:focus-visible { background: color-mix(in srgb, var(--accent) 10%, transparent); border-color: color-mix(in srgb, var(--accent) 45%, transparent); outline: none; }
  .room:active .badge { transform: scale(0.94); }
  .room.sel { background: color-mix(in srgb, var(--accent) 16%, transparent); border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .room.heating { background: color-mix(in srgb, var(--heat) 12%, transparent); }
  .room.alert { border-color: color-mix(in srgb, var(--danger) 55%, transparent); border-style: dashed; }
  .glow {
    position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; opacity: 0;
    background: radial-gradient(circle at 50% 50%, var(--lamp), transparent 70%);
    transition: opacity 0.7s var(--ease);
  }
  .room.lit .glow { opacity: calc(0.25 + var(--lvl) * 0.45); animation: breathe 4s ease-in-out infinite; }

  .badge {
    display: flex; flex-direction: column; align-items: center; gap: 2px; max-width: 100%; min-width: 0;
    padding: 5px 9px 6px; border-radius: 14px; line-height: 1.15;
    background: color-mix(in srgb, var(--surface-solid) 88%, transparent); border: 1px solid var(--border);
    box-shadow: 0 6px 18px -8px rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    transition: transform 0.25s var(--spring);
  }
  .badge.compact { flex-direction: row; gap: 6px; padding: 4px 8px; border-radius: 999px; }
  .bare .badge { background: color-mix(in srgb, var(--surface-solid) 70%, transparent); box-shadow: none; color: var(--text-2); }
  .name { display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 700; min-width: 0; max-width: 100%; }
  .name :global(svg) { color: var(--text-3); }
  .temp { font-size: 1rem; font-weight: 800; letter-spacing: -0.02em; }
  .temp small { font-size: 0.68rem; font-weight: 600; color: var(--text-2); margin-left: 4px; }
  .compact .temp { font-size: 0.8rem; }
  .inds { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
  .inds:empty { display: none; }
  .ind {
    display: inline-flex; align-items: center; gap: 1px; height: 20px; min-width: 20px; padding: 0 3px; justify-content: center;
    border-radius: 999px; font-style: normal; color: var(--text-3); background: var(--surface-2);
    transition: color 0.3s, background 0.3s, box-shadow 0.4s;
  }
  .ind b { font-size: 0.68rem; font-weight: 800; }
  .ind.heat.on { color: #fff; background: var(--heat); box-shadow: 0 0 10px -2px var(--heat); }
  .ind.heat.on :global(svg) { animation: flicker 1.8s ease-in-out infinite; }
  .ind.lamp.on { color: #3a2a00; background: var(--lamp); box-shadow: 0 0 12px 0 var(--lamp); }
  .ind.media.on { color: #fff; background: #6366f1; }
  .ind.media.playing { animation: pulse-ring 1.8s var(--ease) infinite; --pulse: #6366f1; }
  .ind.sw.on { color: #fff; background: var(--info); }
  .ind.open.on { color: #fff; background: var(--danger); animation: pulse-ring 1.6s var(--ease) infinite; --pulse: var(--danger); }

  .hint { margin: 0; }

  .rooms { display: flex; flex-direction: column; gap: 8px; }
  .room-row {
    display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; text-align: left; cursor: pointer;
    border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow);
    color: var(--text); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    transition: transform 0.2s var(--spring), border-color 0.4s;
  }
  .room-row:active { transform: scale(0.98); }
  .room-row.bare { box-shadow: none; background: var(--surface-2); }
  .rr-ic {
    width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0;
    background: var(--surface-3); color: var(--text-2); transition: all 0.5s var(--ease);
  }
  .room-row.heating .rr-ic { background: var(--heat); color: #fff; }
  .room-row.lit .rr-ic { background: var(--lamp); color: #fff; box-shadow: 0 0 18px -4px var(--lamp); }

  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 30% { transform: scale(1.12) rotate(-4deg); } 60% { transform: scale(0.95) rotate(3deg); } }
  @media (prefers-reduced-motion: reduce) {
    .room.lit .glow, .ind.heat.on :global(svg), .ind.media.playing, .ind.open.on { animation: none; }
  }
</style>

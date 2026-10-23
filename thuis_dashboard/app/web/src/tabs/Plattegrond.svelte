<script>
  import { mdiWindowOpenVariant, mdiDoorOpen, mdiChevronRight, mdiFloorPlan, mdiHomeVariantOutline } from '@mdi/js';
  import { FLOORPLAN, FLOORPLAN_ROOMS } from '$shared/config.js';
  import { states, household } from '../lib/api.js';
  import Icon from '../components/Icon.svelte';
  import RoomSheet from './plattegrond/RoomSheet.svelte';
  import { planIcon } from './plattegrond/icons.js';
  import { summarize, fmt } from './plattegrond/summary.js';
  import { css } from './verlichting/color.js';
  import FloorSvg from './plattegrond/FloorSvg.svelte';
  import HouseView from './plattegrond/HouseView.svelte';
  import RoomBadge from './plattegrond/RoomBadge.svelte';

  const VIEW_KEY = 'huisje.view';
  let view = $state(localStorage.getItem(VIEW_KEY) === 'plan' ? 'plan' : 'house');
  function setView(/** @type {'plan'|'house'} */ v) {
    view = v;
    localStorage.setItem(VIEW_KEY, v);
  }

  /** @type {import('./plattegrond/summary.js').PlanRoom[]} */
  const rooms = FLOORPLAN_ROOMS;
  const [vx, vy, vw, vh] = FLOORPLAN.viewBox;
  const pct = (/** @type {number} */ v, /** @type {number} */ total) => `${((v / total) * 100).toFixed(3)}%`;
  const box = (/** @type {number[]} */ r) => `left:${pct(r[0] - vx, vw)};top:${pct(r[1] - vy, vh)};width:${pct(r[2], vw)};height:${pct(r[3], vh)}`;
  // Small regions only get a single-line badge
  const compact = (/** @type {number[]} */ r) => r[3] / vh < 0.15 || r[2] / vw < 0.26;

  const sums = $derived(Object.fromEntries(rooms.map((r) => [r.id, summarize(r, $states, $household)])));
  const houseRooms = $derived(rooms.filter((r) => sums[r.id].deviceCount > 0));
  const bareRooms = $derived(rooms.filter((r) => !sums[r.id].deviceCount));

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

<div class="plattegrond" class:house-mode={view === 'house'}>
  <div class="plan-wrap">
    {#if view === 'house'}
      <HouseView rooms={houseRooms} {sums} selectedId={open ? selected?.id : null} onselect={show} {describe} />
    {:else}
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
          <RoomBadge room={r} {s} compact={compact(r.rect)} />
        </button>
      {/each}
    </div>
    {/if}
    <div class="under">
      <p class="hint tiny faint">Tik op een ruimte voor alle bediening</p>
      <div class="view-switch" role="group" aria-label="Weergave">
        <button class:on={view === 'house'} aria-pressed={view === 'house'} title="Huisje" onclick={() => setView('house')}><Icon path={mdiHomeVariantOutline} size={15} /></button>
        <button class:on={view === 'plan'} aria-pressed={view === 'plan'} title="Plattegrond" onclick={() => setView('plan')}><Icon path={mdiFloorPlan} size={15} /></button>
      </div>
    </div>
  </div>

  <div class="list">
    {#each [{ title: 'Ruimtes met apparaten', list: houseRooms }, { title: 'Ruimtes zonder apparaten', list: bareRooms }] as sec (sec.title)}
    {#if sec.list.length}
    <h3 class="section-title">{sec.title}</h3>
    <div class="rooms stagger">
      {#each sec.list as r (r.id)}
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
    {/if}
    {/each}
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
  .room:active :global(.badge) { transform: scale(0.94); }
  .room.sel { background: color-mix(in srgb, var(--accent) 16%, transparent); border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .room.heating { background: color-mix(in srgb, var(--heat) 12%, transparent); }
  .room.alert { border-color: color-mix(in srgb, var(--danger) 55%, transparent); border-style: dashed; }
  .glow {
    position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; opacity: 0;
    background: radial-gradient(circle at 50% 50%, var(--lamp), transparent 70%);
    transition: opacity 0.7s var(--ease);
  }
  .room.lit .glow { opacity: calc(0.25 + var(--lvl) * 0.45); animation: breathe 4s ease-in-out infinite; }

  .under { width: var(--plan-w); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .hint { margin: 0; }
  .view-switch { display: inline-flex; gap: 2px; padding: 2px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); opacity: 0.75; transition: opacity 0.2s; }
  .view-switch:hover, .view-switch:focus-within { opacity: 1; }
  .view-switch button {
    display: grid; place-items: center; width: 26px; height: 22px; padding: 0; border: 0; border-radius: 999px; cursor: pointer;
    background: transparent; color: var(--text-3); transition: background 0.25s, color 0.25s;
  }
  .view-switch button.on { background: var(--surface-solid); color: var(--accent); box-shadow: 0 1px 4px -1px rgba(15, 23, 42, 0.3); }

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
  @media (prefers-reduced-motion: reduce) {
    .room.lit .glow { animation: none; }
  }
</style>

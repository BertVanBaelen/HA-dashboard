<script>
  import { mdiFire, mdiLightbulbOn, mdiLightbulbOutline, mdiWindowOpenVariant, mdiDoorOpen, mdiPower } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';
  import { planIcon } from './icons.js';
  import { fmt } from './summary.js';

  /** @type {{ room: import('./summary.js').PlanRoom, s: ReturnType<typeof import('./summary.js').summarize>, compact?: boolean }} */
  let { room, s, compact = false } = $props();
</script>

<span class="badge" class:compact class:bare={!s.deviceCount}>
  <span class="name"><Icon path={planIcon(room.icon)} size={13} /><span class="ellipsis">{room.name}</span></span>
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

<style>
  .badge {
    display: flex; flex-direction: column; align-items: center; gap: 2px; max-width: 100%; min-width: 0;
    padding: 5px 9px 6px; border-radius: 14px; line-height: 1.15;
    background: color-mix(in srgb, var(--surface-solid) 88%, transparent); border: 1px solid var(--border);
    box-shadow: 0 6px 18px -8px rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    transition: transform 0.25s var(--spring);
  }
  .badge.compact { flex-direction: row; gap: 6px; padding: 4px 8px; border-radius: 999px; }
  .badge.bare { background: color-mix(in srgb, var(--surface-solid) 70%, transparent); box-shadow: none; color: var(--text-2); }
  .name { display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 700; min-width: 0; max-width: 100%; }
  .name :global(svg) { color: var(--text-3); }
  .temp { font-size: 1rem; font-weight: 800; letter-spacing: -0.02em; }
  .temp small { font-size: 0.68rem; font-weight: 600; color: var(--text-2); margin-left: 4px; }
  .compact .temp { font-size: 0.8rem; }
  .compact .temp small { display: none; }
  .compact .name { flex-shrink: 0; max-width: 60%; }
  .compact .inds { flex-wrap: nowrap; min-width: 0; overflow: hidden; }

  /* Small rooms on narrow phones (house view): tighter badge so everything stays visible. */
  @container room (max-height: 74px) {
    .badge:not(.compact) { padding: 3px 7px 4px; gap: 1px; border-radius: 11px; }
    .badge:not(.compact) .temp { font-size: 0.86rem; }
    .badge:not(.compact) .ind { height: 17px; min-width: 17px; }
  }
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

  @keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 30% { transform: scale(1.12) rotate(-4deg); } 60% { transform: scale(0.95) rotate(3deg); } }
  @media (prefers-reduced-motion: reduce) {
    .ind.heat.on :global(svg), .ind.media.playing, .ind.open.on { animation: none; }
  }
</style>

<script>
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { mdiZigbee, mdiAccessPointPlus, mdiRefresh, mdiAccessPoint, mdiBattery, mdiPowerPlug, mdiChevronDown, mdiAlertCircleOutline, mdiUsbFlashDrive } from '@mdi/js';
  import { relTime } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { zha, zhaSummary, refreshZha, useZha, permitUntil, permitJoin, stopPermitJoin, PERMIT_JOIN_SECONDS } from './zha.js';

  /** @type {{ now: number }} */
  let { now } = $props();

  onMount(() => useZha());

  const SHOW = 8;
  let showAll = $state(false);
  let busy = $state(false);

  const coordinator = $derived($zha.devices?.find((d) => d.coordinator) ?? null);
  const devices = $derived(
    ($zha.devices ?? [])
      .filter((d) => !d.coordinator)
      .sort((a, b) => Number(a.available) - Number(b.available) || a.name.localeCompare(b.name)),
  );
  const shown = $derived(showAll ? devices : devices.slice(0, SHOW));
  const remaining = $derived(Math.max(0, Math.ceil(($permitUntil - now) / 1000)));
  const joining = $derived(remaining > 0);
  const healthy = $derived($zhaSummary.known && !$zhaSummary.offline && $zhaSummary.coordinatorOk !== false);

  async function togglePermit() {
    busy = true;
    try {
      await (joining ? stopPermitJoin() : permitJoin());
    } catch {
    } finally {
      busy = false;
    }
  }

  const ago = (t) => (now >= 0 ? relTime(t) : '');
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const lqiPct = (l) => (l == null ? 0 : Math.max(0, Math.min(100, (l / 255) * 100)));
  const lqiColor = (l) => (l == null ? 'var(--text-3)' : l < 60 ? 'var(--danger)' : l < 120 ? 'var(--warn)' : 'var(--ok)');
  const typeIcon = (d) => (d.type === 'Router' ? mdiAccessPoint : d.battery ? mdiBattery : mdiPowerPlug);
  const typeLabel = (d) => (d.type === 'Router' ? 'Router' : d.battery ? 'Batterij' : 'Netstroom');
  const R = 26;
  const C = 2 * Math.PI * R;
</script>

<Card
  title="Zigbee (ZHA)"
  iconPath={mdiZigbee}
  subtitle={$zhaSummary.known ? `${$zhaSummary.online} van ${$zhaSummary.total} online` : $zha.error ? 'Niet beschikbaar' : 'Laden…'}
  accent={$zha.error && !$zhaSummary.known ? 'var(--danger)' : healthy || !$zhaSummary.known ? '#f59e0b' : 'var(--danger)'}
  glow={joining}
>
  {#snippet actions()}
    {#if !$zhaSummary.known}<Badge text={$zha.error ? 'Fout' : 'n.b.'} kind={$zha.error ? 'danger' : 'neutral'} />
    {:else if $zhaSummary.offline}<Badge kind="danger" pulse text="{$zhaSummary.offline} offline" />
    {:else}<Badge kind="ok" text="Alles online" />{/if}
    <button class="btn ghost sm rf" title="Vernieuwen" aria-label="Vernieuwen" disabled={$zha.loading} onclick={() => refreshZha()}>
      <span class="ri" class:spin={$zha.loading}><Icon path={mdiRefresh} size={18} /></span>
    </button>
  {/snippet}

  {#if $zha.error}
    <div class="err">
      <Icon path={mdiAlertCircleOutline} size={20} />
      <div class="grow">
        <div class="bt">{$zha.error}</div>
        {#if $zhaSummary.known}<div class="small muted">Laatst bijgewerkt {ago($zha.updated)}</div>{/if}
      </div>
    </div>
  {/if}

  {#if coordinator}
    <div class="bridge" class:down={!coordinator.available}>
      <span class="bic"><Icon path={mdiUsbFlashDrive} size={24} /></span>
      <div class="grow">
        <div class="bt">Coördinator</div>
        <div class="small muted ellipsis">{[coordinator.manufacturer, coordinator.model].filter(Boolean).join(' · ') || coordinator.ieee}</div>
      </div>
      <span class="dot" class:ok={coordinator.available}></span>
    </div>
  {/if}

  <div class="join" class:on={joining}>
    <div class="gauge">
      <svg viewBox="0 0 60 60" width="60" height="60">
        <circle cx="30" cy="30" r={R} class="track" />
        <circle cx="30" cy="30" r={R} class="prog" stroke-dasharray={C} stroke-dashoffset={C * (1 - remaining / PERMIT_JOIN_SECONDS)} />
      </svg>
      <span class="gi"><Icon path={mdiAccessPointPlus} size={22} /></span>
    </div>
    <div class="grow">
      <div class="bt">Apparaten koppelen</div>
      <div class="small muted">
        {#if joining}Koppelen actief · <b class="num cd">{mmss(remaining)}</b>{:else}Netwerk open voor ruim 4 minuten{/if}
      </div>
    </div>
    <button class="btn sm" class:soft={!joining} class:primary={joining} disabled={busy || (!$zhaSummary.known && !!$zha.error)} onclick={togglePermit}>
      {joining ? 'Stoppen' : 'Koppelen'}
    </button>
  </div>

  {#if $zhaSummary.known}
    {#if devices.length}
      <div class="devs">
        {#each shown as d (d.ieee)}
          <div class="dev" class:bad={!d.available} title={`${d.name}\n${[d.manufacturer, d.model].filter(Boolean).join(' ')}\n${d.ieee}`} transition:slide={{ duration: 200 }}>
            <span class="dot" class:ok={d.available}></span>
            <div class="grow info">
              <div class="ellipsis nm">{d.name}</div>
              <div class="tiny muted ellipsis">{d.lastSeen ? ago(d.lastSeen) : 'Nooit gezien'}{d.model ? ` · ${d.model}` : ''}</div>
            </div>
            <span class="lqi" title={`LQI ${d.lqi ?? '–'}${d.rssi != null ? ` · RSSI ${d.rssi} dBm` : ''}`}>
              <span class="bar"><span style="width:{lqiPct(d.lqi)}%;background:{lqiColor(d.lqi)}"></span></span>
              <span class="tiny faint num">{d.lqi ?? '–'}</span>
            </span>
            <span class="ti" title={typeLabel(d)}><Icon path={typeIcon(d)} size={18} /></span>
          </div>
        {/each}
      </div>
      {#if devices.length > SHOW}
        <button class="btn ghost sm block more" onclick={() => (showAll = !showAll)}>
          {showAll ? 'Toon minder' : `Toon alle ${devices.length}`}
          <span class="chev" class:open={showAll}><Icon path={mdiChevronDown} size={18} /></span>
        </button>
      {/if}
    {:else}
      <EmptyState iconPath={mdiZigbee} text="Nog geen Zigbee-apparaten gekoppeld" />
    {/if}
  {/if}
</Card>

<style>
  .err { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--radius-sm); margin-bottom: 10px; color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
  .err .bt { color: var(--text); }
  .bridge, .join { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--radius-sm); background: var(--surface-2); margin-bottom: 10px; transition: background 0.3s; }
  .bridge.down { background: color-mix(in srgb, var(--danger) 12%, transparent); }
  .bic { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0; color: #f59e0b; background: color-mix(in srgb, #f59e0b 16%, transparent); }
  .down .bic { color: var(--danger); background: color-mix(in srgb, var(--danger) 16%, transparent); }
  .bt { font-weight: 650; }
  .grow { min-width: 0; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--danger); --pulse: var(--danger); animation: pulse-ring 1.6s infinite; }
  .dot.ok { background: var(--ok); box-shadow: 0 0 8px var(--ok); animation: none; }
  .bridge .dot { width: 12px; height: 12px; }

  .join.on { background: color-mix(in srgb, #f59e0b 14%, transparent); }
  .gauge { position: relative; width: 60px; height: 60px; flex-shrink: 0; margin: -6px 0; }
  .gauge svg { transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--surface-3); stroke-width: 5; }
  .prog { fill: none; stroke: #f59e0b; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
  .gi { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); transition: color 0.3s; }
  .on .gi { color: #f59e0b; --glow: #f59e0b; }
  .cd { color: #f59e0b; }

  .rf { padding: 4px 6px; min-height: 0; }
  .ri { display: inline-grid; }

  .devs { display: flex; flex-direction: column; gap: 6px; }
  .dev { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 7px 12px; border-radius: 12px; background: var(--surface-2); transition: background 0.3s; }
  .dev.bad { background: color-mix(in srgb, var(--danger) 13%, transparent); }
  .dev.bad .nm { color: var(--danger); }
  .info { display: flex; flex-direction: column; gap: 1px; }
  .nm { font-size: 0.9rem; font-weight: 600; }
  .lqi { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .bar { width: 44px; height: 6px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
  .bar span { display: block; height: 100%; border-radius: inherit; transition: width 0.4s; }
  .lqi .num { min-width: 22px; text-align: right; }
  .ti { display: inline-grid; color: var(--text-3); flex-shrink: 0; }
  .more { margin-top: 6px; gap: 4px; }
  .chev { display: inline-grid; transition: transform 0.3s var(--spring); }
  .chev.open { transform: rotate(180deg); }
</style>

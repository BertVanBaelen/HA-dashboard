<script>
  import { slide } from 'svelte/transition';
  import { mdiWifi, mdiSpeedometer, mdiWeb, mdiRouterWireless, mdiPowerPlugOff, mdiChevronDown } from '@mdi/js';
  import { states, name, num } from '../../lib/api.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { collectConnectivity, connectivityOk } from './data.js';

  const items = $derived(collectConnectivity($states));
  const offline = $derived(items.filter((i) => !i.ok).length);

  const speed = $derived(
    Object.values($states)
      .filter((s) => /^sensor\.speedtest_/.test(s.entity_id) && Number.isFinite(Number(s.state)))
      .map((s) => {
        const id = s.entity_id;
        const kind = /download/.test(id) ? 'Download' : /upload/.test(id) ? 'Upload' : /ping|latency/.test(id) ? 'Ping' : name(s);
        return { id, kind, value: num(s, kind === 'Ping' ? 0 : 1), unit: s.attributes.unit_of_measurement ?? '' };
      }),
  );
  const internet = $derived(
    Object.values($states).filter((s) => /^binary_sensor\..*(internet|wan|router)/.test(s.entity_id) && !items.some((i) => i.id === s.entity_id)),
  );

  const unavailableList = $derived(
    Object.values($states)
      .filter((s) => s.state === 'unavailable')
      .map((s) => ({ id: s.entity_id, label: name(s), domain: s.entity_id.split('.')[0] }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );
  let showAll = $state(false);
  const shownUnavailable = $derived(showAll ? unavailableList : unavailableList.slice(0, 6));
</script>

<Card title="Connectiviteit" iconPath={mdiWifi} subtitle={items.length ? `${items.length - offline} van ${items.length} online` : ''} accent={offline ? 'var(--danger)' : 'var(--info)'}>
  {#snippet actions()}
    {#if offline}<Badge kind="danger" pulse text="{offline} offline" />{:else if items.length}<Badge kind="ok" text="Alles online" />{/if}
  {/snippet}

  {#if speed.length || internet.length}
    <div class="net">
      {#each internet as s (s.entity_id)}
        {@const ok = connectivityOk(s)}
        <div class="stat" class:bad={!ok}>
          <Icon path={/router/.test(s.entity_id) ? mdiRouterWireless : mdiWeb} size={20} />
          <span class="tiny muted ellipsis">{name(s)}</span>
          <b class:ok class:danger={!ok}>{ok ? 'Online' : 'Offline'}</b>
        </div>
      {/each}
      {#each speed as s (s.id)}
        <div class="stat">
          <Icon path={mdiSpeedometer} size={20} />
          <span class="tiny muted">{s.kind}</span>
          <b class="num">{s.value} <span class="tiny muted">{s.unit}</span></b>
        </div>
      {/each}
    </div>
  {/if}

  {#if items.length}
    <div class="conns">
      {#each items as c (c.id)}
        <div class="conn" class:bad={!c.ok} title={c.id}>
          <span class="dot" class:ok={c.ok}></span>
          <span class="ellipsis grow">{c.label}</span>
          {#if c.na}<span class="tiny faint">n.b.</span>{/if}
        </div>
      {/each}
    </div>
  {:else}
    <EmptyState iconPath={mdiWifi} text="Geen verbindingssensoren gevonden" />
  {/if}

  {#if unavailableList.length}
    <div class="na">
      <div class="nah">
        <Icon path={mdiPowerPlugOff} size={16} />
        <span class="grow">Niet beschikbaar</span>
        <span class="cnt num">{unavailableList.length}</span>
      </div>
      <div class="nalist">
        {#each shownUnavailable as u (u.id)}
          <div class="nai" transition:slide={{ duration: 200 }}>
            <span class="ellipsis grow">{u.label}</span>
            <span class="tiny faint dom">{u.domain}</span>
          </div>
        {/each}
      </div>
      {#if unavailableList.length > 6}
        <button class="btn ghost sm block more" onclick={() => (showAll = !showAll)}>
          {showAll ? 'Toon minder' : `Toon alle ${unavailableList.length}`}
          <span class="chev" class:open={showAll}><Icon path={mdiChevronDown} size={18} /></span>
        </button>
      {/if}
    </div>
  {/if}
</Card>

<style>
  .net { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-bottom: 12px; }
  .stat { display: flex; flex-direction: column; gap: 3px; padding: 10px; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--info); min-width: 0; }
  .stat.bad { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
  .stat b { color: var(--text); }
  .stat b.ok { color: var(--ok); } .stat b.danger { color: var(--danger); }

  .conns { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
  .conn { display: flex; align-items: center; gap: 9px; min-height: 40px; padding: 8px 12px; border-radius: 12px; background: var(--surface-2); font-size: 0.88rem; font-weight: 550; min-width: 0; transition: background 0.3s; }
  .conn.bad { background: color-mix(in srgb, var(--danger) 13%, transparent); color: var(--danger); }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--danger); --pulse: var(--danger); animation: pulse-ring 1.6s infinite; }
  .dot.ok { background: var(--ok); box-shadow: 0 0 8px var(--ok); animation: none; }

  .na { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
  .nah { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-2); margin-bottom: 6px; }
  .cnt { min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; display: grid; place-items: center; background: var(--surface-3); }
  .nalist { display: flex; flex-direction: column; }
  .nai { display: flex; align-items: center; gap: 8px; padding: 7px 4px; font-size: 0.88rem; color: var(--text-2); border-bottom: 1px dashed var(--border); }
  .dom { font-family: ui-monospace, monospace; }
  .more { margin-top: 6px; gap: 4px; }
  .chev { display: inline-grid; transition: transform 0.3s var(--spring); }
  .chev.open { transform: rotate(180deg); }
</style>

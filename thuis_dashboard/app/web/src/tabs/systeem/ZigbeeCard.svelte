<script>
  import { mdiZigbee, mdiAccessPointPlus, mdiRestart, mdiLanConnect, mdiLanDisconnect } from '@mdi/js';
  import { states, callService, unavailable } from '../../lib/api.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import { ZIGBEE, PERMIT_JOIN_SECONDS } from './data.js';

  /** @type {{ now: number }} */
  let { now } = $props();

  const conn = $derived($states[ZIGBEE.connection]);
  const version = $derived($states[ZIGBEE.version]);
  const permit = $derived($states[ZIGBEE.permitJoin]);
  const restartBtn = $derived($states[ZIGBEE.restart]);
  const connected = $derived(conn?.state === 'on');
  const joining = $derived(permit?.state === 'on');
  const joinEnd = $derived(joining && permit ? new Date(permit.last_changed).getTime() + PERMIT_JOIN_SECONDS * 1000 : 0);
  const remaining = $derived(joining ? Math.max(0, Math.ceil((joinEnd - now) / 1000)) : 0);

  let toggling = $state(false);
  let restarting = $state(false);
  let autoOffSentFor = '';

  $effect(() => {
    if (!joining || !permit) return;
    const key = permit.last_changed;
    const t = setTimeout(() => {
      if (autoOffSentFor === key) return;
      autoOffSentFor = key;
      callService('switch', 'turn_off', {}, ZIGBEE.permitJoin, 'Koppelmodus automatisch uitgeschakeld').catch(() => {});
    }, Math.max(0, joinEnd - Date.now()));
    return () => clearTimeout(t);
  });

  async function setPermit(v) {
    toggling = true;
    try {
      await callService('switch', v ? 'turn_on' : 'turn_off', {}, ZIGBEE.permitJoin, v ? 'Koppelmodus aan voor 4 minuten' : 'Koppelmodus uit');
    } catch {
    } finally {
      toggling = false;
    }
  }

  async function restart() {
    restarting = true;
    try {
      await callService('button', 'press', {}, ZIGBEE.restart, 'Zigbee2MQTT wordt herstart');
    } catch {
    } finally {
      setTimeout(() => (restarting = false), 4000);
    }
  }

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const R = 26;
  const C = 2 * Math.PI * R;
</script>

<Card title="Zigbee2MQTT" iconPath={mdiZigbee} subtitle={version && !unavailable(version) ? `Versie ${version.state}` : 'Versie onbekend'} accent={connected ? '#f59e0b' : 'var(--danger)'} glow={joining}>
  {#snippet actions()}
    {#if !conn}<Badge text="Niet beschikbaar" />{:else if connected}<Badge kind="ok" text="Verbonden" />{:else}<Badge kind="danger" pulse text="Offline" />{/if}
  {/snippet}

  <div class="bridge" class:down={conn && !connected}>
    <span class="bic"><Icon path={connected ? mdiLanConnect : mdiLanDisconnect} size={24} /></span>
    <div class="grow">
      <div class="bt">Bridge</div>
      <div class="small muted">{!conn || unavailable(conn) ? 'Niet beschikbaar' : connected ? 'Verbonden met MQTT' : 'Geen verbinding'}</div>
    </div>
    <span class="dot" class:ok={connected}></span>
  </div>

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
        {#if !permit || unavailable(permit)}Niet beschikbaar{:else if joining}Nog <b class="num cd">{mmss(remaining)}</b> open{:else}Uit · sluit automatisch na 4 min{/if}
      </div>
    </div>
    <Toggle checked={joining} disabled={toggling || !permit || unavailable(permit)} onchange={setPermit} label="Koppelmodus" color="#f59e0b" />
  </div>

  <button class="btn soft block rs" disabled={restarting || !restartBtn || unavailable(restartBtn)} onclick={restart}>
    <span class:spin={restarting} class="ri"><Icon path={mdiRestart} size={20} /></span>{restarting ? 'Herstarten…' : 'Herstart bridge'}
  </button>
</Card>

<style>
  .bridge, .join { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--radius-sm); background: var(--surface-2); margin-bottom: 10px; transition: background 0.3s; }
  .bridge.down { background: color-mix(in srgb, var(--danger) 12%, transparent); }
  .bic { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; color: #f59e0b; background: color-mix(in srgb, #f59e0b 16%, transparent); }
  .down .bic { color: var(--danger); background: color-mix(in srgb, var(--danger) 16%, transparent); }
  .bt { font-weight: 650; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--danger); --pulse: var(--danger); animation: pulse-ring 1.6s infinite; }
  .dot.ok { background: var(--ok); --pulse: var(--ok); animation: pulse-ring 2.6s infinite; }

  .join.on { background: color-mix(in srgb, #f59e0b 14%, transparent); }
  .gauge { position: relative; width: 60px; height: 60px; flex-shrink: 0; margin: -6px 0; }
  .gauge svg { transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--surface-3); stroke-width: 5; }
  .prog { fill: none; stroke: #f59e0b; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
  .gi { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); transition: color 0.3s; }
  .on .gi { color: #f59e0b; --glow: #f59e0b; animation: glow 1.6s ease-in-out infinite; }
  .cd { color: #f59e0b; }
  .rs { gap: 8px; min-height: 46px; }
  .ri { display: inline-grid; }
</style>

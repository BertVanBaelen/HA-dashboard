<script>
  import { mdiBackupRestore, mdiCloudUpload, mdiCheckCircle, mdiAlertCircle, mdiCalendarClock, mdiHistory, mdiTimerSand } from '@mdi/js';
  import { states, callService, unavailable } from '../../lib/api.js';
  import { relTime, fmtDateTime } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import { BACKUP, BACKUP_MAX_AGE_MS } from './data.js';

  /** @type {{ now: number }} */
  let { now } = $props();

  const STATES = { idle: 'Klaar', create_backup: 'Backup maken…', receive_backup: 'Backup ontvangen…', restore_backup: 'Herstellen…', blocked: 'Geblokkeerd' };
  const EVENTS = { completed: 'Voltooid', failed: 'Mislukt', in_progress: 'Bezig' };

  let busy = $state(false);

  const mgr = $derived($states[BACKUP.state]);
  const last = $derived($states[BACKUP.lastSuccessful]);
  const attempt = $derived($states[BACKUP.lastAttempted]);
  const next = $derived($states[BACKUP.nextScheduled]);
  const ev = $derived($states[BACKUP.event]);

  const ts = (s) => (unavailable(s) ? null : new Date(s.state).getTime() || null);
  const lastTs = $derived(ts(last));
  const attemptTs = $derived(ts(attempt));
  const tooOld = $derived(!lastTs || now - lastTs > BACKUP_MAX_AGE_MS);
  const attemptFailed = $derived(!!attemptTs && (!lastTs || attemptTs - lastTs > 60e3));
  const working = $derived(busy || (!!mgr && !unavailable(mgr) && mgr.state !== 'idle' && mgr.state !== 'blocked'));
  const evType = $derived(ev?.attributes?.event_type);

  const ago = (t, _n) => (t ? relTime(t) : '–');

  async function createBackup() {
    busy = true;
    try {
      await callService('backup', 'create_automatic', {}, undefined, 'Backup gestart');
    } catch {
    } finally {
      busy = false;
    }
  }
</script>

<Card title="Backups" iconPath={mdiBackupRestore} subtitle={mgr && !unavailable(mgr) ? (STATES[mgr.state] ?? mgr.state) : 'Niet beschikbaar'} accent={tooOld ? 'var(--danger)' : 'var(--ok)'} glow={tooOld}>
  {#snippet actions()}
    {#if working}<Badge kind="info" pulse text="Bezig" />{:else if tooOld}<Badge kind="danger" pulse text="Te oud" />{:else}<Badge kind="ok" text="OK" />{/if}
  {/snippet}

  <div class="last" class:bad={tooOld}>
    <span class="lic" class:working><Icon path={working ? mdiCloudUpload : tooOld ? mdiAlertCircle : mdiCheckCircle} size={30} /></span>
    <div class="grow">
      <div class="tiny muted up">Laatste geslaagde backup</div>
      <div class="big lt">{lastTs ? ago(lastTs, now) : 'Nooit'}</div>
      {#if lastTs}<div class="small muted">{fmtDateTime(lastTs)}</div>{/if}
    </div>
  </div>

  <div class="rows">
    <div class="r" class:warnrow={attemptFailed}>
      <Icon path={mdiHistory} size={18} />
      <span class="grow">Laatste poging</span>
      <span class="small" class:warn={attemptFailed}>{attemptTs ? ago(attemptTs, now) : '–'}{attemptFailed ? ' · mislukt' : ''}</span>
    </div>
    <div class="r">
      <Icon path={mdiCalendarClock} size={18} />
      <span class="grow">Volgende gepland</span>
      <span class="small">{ts(next) ? `${ago(ts(next), now)} · ${fmtDateTime(ts(next))}` : '–'}</span>
    </div>
    <div class="r">
      <Icon path={mdiTimerSand} size={18} />
      <span class="grow">Laatste gebeurtenis</span>
      <span class="small">
        {#if ev && !unavailable(ev)}
          <b class:ok={evType === 'completed'} class:danger={evType === 'failed'}>{EVENTS[evType] ?? evType ?? '–'}</b>
          <span class="muted">· {ago(ts(ev), now)}</span>
        {:else}<span class="muted">–</span>{/if}
      </span>
    </div>
    {#if evType === 'failed' && ev?.attributes?.failed_reason}
      <div class="tiny danger reason">Reden: {ev.attributes.failed_reason}</div>
    {/if}
  </div>

  <button class="btn primary block mk" disabled={working || mgr?.state === 'blocked'} onclick={createBackup}>
    {#if working}<span class="spinner"></span>Backup wordt gemaakt…{:else}<Icon path={mdiCloudUpload} size={20} />Nu backup maken{/if}
  </button>
</Card>

<style>
  .last { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--ok) 10%, transparent); }
  .last.bad { background: color-mix(in srgb, var(--danger) 12%, transparent); }
  .lic { width: 54px; height: 54px; border-radius: 18px; display: grid; place-items: center; color: var(--ok); background: color-mix(in srgb, var(--ok) 18%, transparent); animation: pop 0.6s var(--spring); }
  .bad .lic { color: var(--danger); background: color-mix(in srgb, var(--danger) 18%, transparent); --pulse: var(--danger); animation: pulse-ring 1.8s infinite; }
  .lic.working { color: var(--info); background: color-mix(in srgb, var(--info) 18%, transparent); }
  .lic.working :global(.icon) { animation: float 1.2s ease-in-out infinite; }
  .up { text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
  .lt { font-weight: 800; }
  .bad .lt { color: var(--danger); }
  .rows { display: flex; flex-direction: column; margin: 10px 0 12px; }
  .r { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px solid var(--border); color: var(--text-2); }
  .r:last-of-type { border-bottom: 0; }
  .r .grow { color: var(--text); font-size: 0.9rem; }
  .r > .small { text-align: right; }
  .reason { padding: 0 4px 6px 32px; }
  .mk { gap: 8px; min-height: 46px; }
  .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; display: inline-block; }
</style>

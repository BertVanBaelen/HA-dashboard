<script>
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { mdiShieldCheck, mdiAlertCircle, mdiAlertOctagon, mdiUpdate, mdiBackupRestore, mdiZigbee, mdiBatteryAlert, mdiWifiOff } from '@mdi/js';
  import { states, household, unavailable } from '../lib/api.js';
  import { relTime } from '../lib/format.js';
  import Icon from '../components/Icon.svelte';
  import UpdatesCard from './systeem/UpdatesCard.svelte';
  import BackupCard from './systeem/BackupCard.svelte';
  import ZigbeeCard from './systeem/ZigbeeCard.svelte';
  import BatteryCard from './systeem/BatteryCard.svelte';
  import ConnectivityCard from './systeem/ConnectivityCard.svelte';
  import { BACKUP, ZIGBEE, BACKUP_MAX_AGE_MS, collectUpdates, collectBatteries, collectConnectivity } from './systeem/data.js';

  let now = $state(Date.now());
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });

  const updateCount = $derived(collectUpdates($states).length);
  const batteries = $derived(collectBatteries($states, $household?.sensorLabels ?? {}));
  const lowBatteries = $derived(batteries.filter((b) => b.low).length);
  const weakBatteries = $derived(batteries.filter((b) => !b.low && !b.na && !b.binary && (b.pct ?? 100) < 40).length);
  const offline = $derived(collectConnectivity($states).filter((c) => !c.ok).length);
  const lastBackup = $derived.by(() => {
    const s = $states[BACKUP.lastSuccessful];
    return unavailable(s) ? null : new Date(s.state).getTime() || null;
  });
  const backupOld = $derived(!lastBackup || now - lastBackup > BACKUP_MAX_AGE_MS);
  const zb = $derived($states[ZIGBEE.connection]);
  const zigbeeOk = $derived(zb?.state === 'on');

  const level = $derived(backupOld || (zb && !zigbeeOk) || lowBatteries ? 'danger' : updateCount || offline || weakBatteries ? 'warn' : 'ok');
  const headline = $derived(level === 'ok' ? 'Alles in orde' : level === 'warn' ? 'Aandacht nodig' : 'Actie vereist');

  const chips = $derived([
    { key: 'updates', icon: mdiUpdate, text: updateCount ? `${updateCount} update${updateCount > 1 ? 's' : ''}` : 'Up-to-date', kind: updateCount ? 'warn' : 'ok' },
    { key: 'backups', icon: mdiBackupRestore, text: lastBackup ? `Backup ${relTime(lastBackup)}` : 'Geen backup', kind: backupOld ? 'danger' : 'ok' },
    { key: 'zigbee', icon: mdiZigbee, text: !zb ? 'Zigbee n.b.' : zigbeeOk ? 'Zigbee OK' : 'Zigbee offline', kind: !zb ? 'neutral' : zigbeeOk ? 'ok' : 'danger' },
    { key: 'batterijen', icon: mdiBatteryAlert, text: lowBatteries ? `${lowBatteries} batterij${lowBatteries > 1 ? 'en' : ''} laag` : 'Batterijen OK', kind: lowBatteries ? 'danger' : weakBatteries ? 'warn' : 'ok' },
    ...(offline ? [{ key: 'connectiviteit', icon: mdiWifiOff, text: `${offline} offline`, kind: 'danger' }] : []),
  ]);

  const goto = (key) => document.getElementById(`sys-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
</script>

<div class="stagger col sys">
  <section class="hero {level}">
    <div class="orb">
      <span class="ring r1"></span><span class="ring r2"></span>
      {#key level}
        <span class="core" in:scale={{ start: 0.5, duration: 450 }}>
          <Icon path={level === 'ok' ? mdiShieldCheck : level === 'warn' ? mdiAlertCircle : mdiAlertOctagon} size={40} />
        </span>
      {/key}
    </div>
    <div class="grow txt">
      <div class="tiny up">Systeemstatus</div>
      <h2>{headline}</h2>
      <div class="chips">
        {#each chips as c (c.key)}
          <button class="chip {c.kind}" onclick={() => goto(c.key)}><Icon path={c.icon} size={15} />{c.text}</button>
        {/each}
      </div>
    </div>
  </section>

  <div class="section-title" id="sys-updates">Updates</div>
  <UpdatesCard />

  <div class="grid">
    <div class="col" style="gap:var(--gap)">
      <div class="section-title" id="sys-backups">Backups</div>
      <BackupCard {now} />
    </div>
    <div class="col" style="gap:var(--gap)">
      <div class="section-title" id="sys-zigbee">Zigbee2MQTT</div>
      <ZigbeeCard {now} />
    </div>
  </div>

  <div class="grid">
    <div class="col" style="gap:var(--gap)">
      <div class="section-title" id="sys-batterijen">Batterijen</div>
      <BatteryCard />
    </div>
    <div class="col" style="gap:var(--gap)">
      <div class="section-title" id="sys-connectiviteit">Connectiviteit</div>
      <ConnectivityCard />
    </div>
  </div>
</div>

<style>
  .sys { gap: var(--gap); padding-bottom: 10px; }
  .sys :global(.section-title) { scroll-margin-top: 80px; }
  .grid { align-items: start; }

  .hero { --c: var(--ok); position: relative; overflow: hidden; display: flex; align-items: center; gap: 18px; padding: 20px; border-radius: var(--radius); border: 1px solid color-mix(in srgb, var(--c) 35%, var(--border)); background: radial-gradient(130% 120% at 0% 0%, color-mix(in srgb, var(--c) 22%, transparent), transparent 65%), var(--surface); box-shadow: var(--shadow), 0 14px 40px -20px var(--c); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); transition: border-color 0.5s, box-shadow 0.5s; }
  .hero.warn { --c: var(--warn); }
  .hero.danger { --c: var(--danger); }
  .orb { position: relative; width: 76px; height: 76px; flex-shrink: 0; display: grid; place-items: center; }
  .core { width: 66px; height: 66px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--c) 70%, #fff), var(--c)); box-shadow: 0 10px 28px -8px var(--c); z-index: 1; animation: float 4s ease-in-out infinite; }
  .ring { position: absolute; inset: 5px; border-radius: 50%; border: 2px solid var(--c); opacity: 0; animation: ripple 2.8s var(--ease) infinite; }
  .r2 { animation-delay: 1.4s; }
  .hero.ok .ring { animation-duration: 4s; }
  .hero.danger .ring { animation-duration: 1.8s; }
  @keyframes ripple { 0% { transform: scale(0.85); opacity: 0.7; } 100% { transform: scale(1.45); opacity: 0; } }
  .txt { min-width: 0; }
  .up { text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--c); }
  h2 { font-size: 1.35rem; margin: 2px 0 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { --k: var(--text-2); display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 4px 11px; border: 0; border-radius: 999px; font: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; color: var(--k); background: color-mix(in srgb, var(--k) 14%, transparent); transition: transform 0.25s var(--spring), background 0.3s; }
  .chip:hover { background: color-mix(in srgb, var(--k) 22%, transparent); }
  .chip:active { transform: scale(0.94); }
  .chip.ok { --k: var(--ok); } .chip.warn { --k: var(--warn); } .chip.danger { --k: var(--danger); }
  @media (max-width: 420px) {
    .hero { padding: 16px; gap: 14px; align-items: flex-start; }
    .orb { width: 60px; height: 60px; }
    .core { width: 54px; height: 54px; }
  }
</style>

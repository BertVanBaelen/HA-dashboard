<script>
  import { onDestroy } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { get } from 'svelte/store';
  import { mdiUpdate, mdiDownload, mdiDownloadMultiple, mdiOpenInNew, mdiCheckDecagram, mdiBackupRestore, mdiArrowRight, mdiAlertCircle } from '@mdi/js';
  import { states, callService, toast } from '../../lib/api.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import Badge from '../../components/Badge.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { UPDATE_GROUPS, BACKUP_GROUPS, FEATURE_BACKUP, collectUpdates, updateGroup, updateTitle, updatePercentage, inProgress, supports, installOrder, isOwnDashboard } from './data.js';

  const KEY = 'systeem.backupBeforeUpdate';
  let backupFirst = $state(localStorage.getItem(KEY) !== '0');
  let pending = $state(/** @type {Record<string, boolean>} */ ({}));
  let expanded = $state(/** @type {Record<string, boolean>} */ ({}));
  let bulk = $state(/** @type {{ done: number, total: number, current: string } | null} */ (null));
  let destroyed = false;
  onDestroy(() => (destroyed = true));

  const updates = $derived(collectUpdates($states));
  const upToDate = $derived(Object.values($states).filter((s) => s.entity_id.startsWith('update.') && s.state === 'off').length);
  const groups = $derived(
    UPDATE_GROUPS.map((g) => ({ ...g, items: updates.filter((u) => updateGroup(u) === g.key).sort((a, b) => updateTitle(a).localeCompare(updateTitle(b))) })).filter((g) => g.items.length),
  );
  const bulkList = $derived(updates.filter((u) => !isOwnDashboard(u)));

  function setBackup(v) {
    backupFirst = v;
    localStorage.setItem(KEY, v ? '1' : '0');
  }

  const withBackup = (s) => backupFirst && BACKUP_GROUPS.has(updateGroup(s)) && supports(s, FEATURE_BACKUP);

  /** Resolves true once the update entity is no longer pending, false on stall/timeout. */
  function waitDone(id, maxMs = 45 * 60e3) {
    return new Promise((resolve) => {
      const start = Date.now();
      let idleSince = 0;
      const check = () => {
        const s = get(states)[id];
        if (!s || destroyed) return finish(false);
        if (s.state !== 'on' && !inProgress(s)) return finish(true);
        if (inProgress(s)) idleSince = 0;
        else if (!idleSince) idleSince = Date.now();
        if ((idleSince && Date.now() - idleSince > 30e3) || Date.now() - start > maxMs) finish(false);
      };
      const timer = setInterval(check, 1500);
      const unsub = states.subscribe(() => queueMicrotask(check));
      let settled = false;
      function finish(v) {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        queueMicrotask(() => unsub());
        resolve(v);
      }
    });
  }

  async function install(s, quiet = false) {
    const id = s.entity_id;
    if (pending[id] || inProgress(s)) return false;
    const backup = withBackup(s);
    const title = updateTitle(s);
    pending[id] = true;
    if (!quiet) toast(`${title} wordt bijgewerkt${backup ? ' (eerst een backup)' : ''}…`);
    try {
      await callService('update', 'install', backup ? { backup: true } : {}, id).catch((e) => {
        if (!/time-out|verbinding/i.test(e?.message ?? '')) throw e;
      });
      const ok = await waitDone(id);
      if (ok) toast(`${title} bijgewerkt`, 'ok');
      else if (!destroyed) toast(`${title}: update niet bevestigd`, 'error', 6000);
      return ok;
    } catch {
      return false;
    } finally {
      delete pending[id];
    }
  }

  async function installAll() {
    if (bulk) return;
    const list = [...bulkList].sort((a, b) => installOrder(a) - installOrder(b));
    if (!list.length) return;
    bulk = { done: 0, total: list.length, current: '' };
    let failed = 0;
    for (const s of list) {
      if (destroyed) break;
      const fresh = get(states)[s.entity_id];
      if (!fresh || fresh.state !== 'on') {
        bulk.done++;
        continue;
      }
      bulk.current = updateTitle(fresh);
      if (!(await install(fresh, true))) failed++;
      bulk.done++;
    }
    bulk = null;
    if (!destroyed) toast(failed ? `${failed} update(s) niet gelukt` : 'Alles bijgewerkt 🎉', failed ? 'error' : 'ok', 5000);
  }
</script>

<Card title="Updates" iconPath={mdiUpdate} subtitle={updates.length ? `${updates.length} beschikbaar · ${upToDate} up-to-date` : `${upToDate} onderdelen up-to-date`} accent="#8b5cf6" glow={updates.length > 0}>
  {#snippet actions()}
    {#if bulkList.length > 1 || bulk}
      <button class="btn primary sm" disabled={!!bulk} onclick={installAll}>
        {#if bulk}<span class="spinner"></span>{bulk.done}/{bulk.total}{:else}<Icon path={mdiDownloadMultiple} size={18} />Alles bijwerken{/if}
      </button>
    {/if}
  {/snippet}

  <div class="backup-row" class:on={backupFirst}>
    <span class="bic"><Icon path={mdiBackupRestore} size={20} /></span>
    <div class="grow">
      <div class="bt">Backup vóór update</div>
      <div class="tiny muted">Voor Core, OS en apps</div>
    </div>
    <Toggle checked={backupFirst} onchange={setBackup} label="Backup vóór update" color="var(--ok)" />
  </div>

  {#if bulk}
    <div class="bulk" transition:slide>
      <div class="small spread"><span class="ellipsis">Bezig: <b>{bulk.current || '…'}</b></span><span class="muted num">{bulk.done}/{bulk.total}</span></div>
      <div class="pbar"><span style="width:{(bulk.done / bulk.total) * 100}%"></span></div>
    </div>
  {/if}

  {#if !updates.length}
    <div in:fly={{ y: 10 }}>
      <EmptyState iconPath={mdiCheckDecagram} title="Alles is up-to-date" text="Geen updates beschikbaar" />
    </div>
  {:else}
    <div class="groups">
      {#each groups as g (g.key)}
        <div class="group" style="--gc:{g.color}" transition:slide>
          <div class="ghead">
            <span class="gic"><Icon path={g.icon} size={16} /></span>
            <span class="gl">{g.label}</span>
            <span class="gcount num">{g.items.length}</span>
          </div>
          {#each g.items as u (u.entity_id)}
            {@const busy = !!pending[u.entity_id] || inProgress(u)}
            {@const pct = updatePercentage(u)}
            {@const a = u.attributes}
            <div class="upd" class:busy animate:flip={{ duration: 300 }} in:fly={{ y: 12, duration: 300 }} out:slide={{ duration: 300 }}>
              <div class="urow">
                <span class="uic" class:spinning={busy}>
                  {#if busy}<span class="ring"></span>{/if}
                  <Icon path={busy ? mdiDownload : g.icon} size={20} />
                </span>
                <div class="grow info">
                  <div class="ut ellipsis">{updateTitle(u)}</div>
                  <div class="ver small">
                    <span class="old num">{a.installed_version ?? '?'}</span>
                    <Icon path={mdiArrowRight} size={14} />
                    <b class="new num">{a.latest_version ?? '?'}</b>
                  </div>
                </div>
                <button class="btn sm" class:primary={!busy} class:soft={busy} disabled={busy || !!bulk} onclick={() => install(u)}>
                  {#if busy}<span class="spinner"></span>{pct != null ? `${Math.round(pct)}%` : 'Bezig'}{:else}Installeren{/if}
                </button>
              </div>
              {#if busy}
                <div class="pbar" class:indet={pct == null} transition:slide><span style="width:{pct ?? 35}%"></span></div>
              {/if}
              {#if a.release_summary}
                <button class="summary small muted" class:open={expanded[u.entity_id]} onclick={() => (expanded[u.entity_id] = !expanded[u.entity_id])}>{a.release_summary}</button>
              {/if}
              <div class="meta">
                {#if a.release_url}
                  <a class="link tiny" href={a.release_url} target="_blank" rel="noopener noreferrer"><Icon path={mdiOpenInNew} size={13} />Release notes</a>
                {/if}
                {#if withBackup(u)}<Badge kind="ok" text="Backup vooraf" />{/if}
                {#if isOwnDashboard(u)}
                  <span class="tiny warn own"><Icon path={mdiAlertCircle} size={13} />Herstart het dashboard</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</Card>

<style>
  .backup-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-2); margin-bottom: 12px; transition: background 0.3s; }
  .backup-row.on { background: color-mix(in srgb, var(--ok) 10%, transparent); }
  .bic { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; background: var(--surface-3); color: var(--text-2); transition: background 0.3s, color 0.3s; }
  .on .bic { background: color-mix(in srgb, var(--ok) 18%, transparent); color: var(--ok); }
  .bt { font-weight: 600; font-size: 0.9rem; }

  .bulk { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--accent-softer); }

  .groups { display: flex; flex-direction: column; gap: 14px; }
  .group { display: flex; flex-direction: column; gap: 8px; }
  .ghead { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-2); }
  .gic { width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; color: var(--gc); background: color-mix(in srgb, var(--gc) 16%, transparent); }
  .gcount { margin-left: auto; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; display: grid; place-items: center; background: color-mix(in srgb, var(--gc) 18%, transparent); color: var(--gc); }

  .upd { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: var(--radius-sm); background: var(--surface-2); border: 1px solid transparent; transition: border-color 0.3s, box-shadow 0.3s; }
  .upd.busy { border-color: color-mix(in srgb, var(--gc) 45%, transparent); box-shadow: 0 6px 24px -12px var(--gc); }
  .urow { display: flex; align-items: center; gap: 12px; }
  .info { min-width: 0; }
  .uic { position: relative; width: 40px; height: 40px; flex-shrink: 0; border-radius: 13px; display: grid; place-items: center; color: var(--gc); background: color-mix(in srgb, var(--gc) 16%, transparent); }
  .uic.spinning :global(.icon) { animation: float 1.2s ease-in-out infinite; }
  .ring { position: absolute; inset: -3px; border-radius: 15px; border: 2px solid transparent; border-top-color: var(--gc); border-right-color: var(--gc); animation: spin 1s linear infinite; }
  .ut { font-weight: 650; }
  .ver { display: flex; align-items: center; gap: 6px; color: var(--text-2); }
  .old { color: var(--text-3); text-decoration: line-through; text-decoration-thickness: 1px; }
  .new { color: var(--gc); }
  .btn { gap: 6px; min-height: 40px; }
  .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; display: inline-block; }

  .pbar { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; position: relative; }
  .pbar span { display: block; height: 100%; border-radius: 3px; background: var(--gradient); transition: width 0.6s var(--ease); }
  .pbar.indet span { position: absolute; animation: indet 1.4s var(--ease) infinite; }
  @keyframes indet { from { left: -35%; } to { left: 100%; } }

  .summary { all: unset; cursor: pointer; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line; font-size: 0.82rem; color: var(--text-2); }
  .summary.open { -webkit-line-clamp: unset; line-clamp: unset; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .meta:empty { display: none; }
  .link { display: inline-flex; align-items: center; gap: 4px; color: var(--accent-text, var(--accent)); font-weight: 600; text-decoration: none; }
  .link:hover { text-decoration: underline; }
  .own { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
</style>

<script>
  import { onMount, untrack } from 'svelte';
  import { fly, slide, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { mdiPlaylistRemove, mdiCheckAll } from '@mdi/js';
  import { ALLOWED_SERVICES } from '$shared/config.js';
  import { states, household, name, haRequest, callService, onStateChanges, unavailable } from '../../lib/api.js';
  import { colorFor } from '../../lib/colors.js';
  import { openSettings } from '../../lib/nav.js';
  import Card from '../../components/Card.svelte';
  import Chip from '../../components/Chip.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import TodoItem from './TodoItem.svelte';

  const LKEY = 'agenda.list';
  const CELEBRATE_MS = 750;
  const canClear = (ALLOWED_SERVICES.todo ?? []).includes('remove_completed_items');

  const lists = $derived(($household?.lists ?? []).filter((id) => $states[id] || !Object.keys($states).length));
  let sel = $state(sessionStorage.getItem(LKEY));
  const current = $derived(sel && lists.includes(sel) ? sel : lists[0]);
  const cur = $derived(current ? $states[current] : null);
  const color = $derived(current ? colorFor(current) : 'var(--accent)');

  let items = $state(/** @type {Record<string, any[]>} */ ({}));
  let celebrating = $state(/** @type {string[]} */ ([]));
  let text = $state('');
  let showDone = $state(sessionStorage.getItem('agenda.done') === '1');
  let input = $state(/** @type {HTMLInputElement|null} */ (null));
  let busyOps = 0;
  const timers = {};

  const list = $derived(current ? (items[current] ?? null) : null);
  const open = $derived((list ?? []).filter((i) => i.status !== 'completed' || celebrating.includes(i.uid)));
  const openCount = $derived((list ?? []).filter((i) => i.status !== 'completed' && !celebrating.includes(i.uid)).length);
  const done = $derived((list ?? []).filter((i) => i.status === 'completed' && !celebrating.includes(i.uid)));

  const icon = (id) => (id.includes('shopping') ? 'cart' : id.includes('clean') ? 'broom' : 'list');
  const placeholder = $derived(current?.includes('shopping') ? 'Bv. Melk, brood…' : 'Nieuw item…');
  function count(id) {
    const l = items[id];
    if (l) return l.filter((i) => i.status !== 'completed').length;
    const n = Number($states[id]?.state);
    return Number.isFinite(n) ? n : 0;
  }

  async function fetchList(id) {
    if (busyOps > 0) return;
    try {
      const r = await haRequest({ type: 'todo/item/list', entity_id: id });
      if (busyOps === 0) items[id] = r?.items ?? [];
    } catch {
      items[id] ??= [];
    }
  }
  function schedule(id, ms = 250) {
    clearTimeout(timers[id]);
    timers[id] = setTimeout(() => fetchList(id), ms);
  }

  async function op(id, fn) {
    busyOps++;
    try {
      await fn();
    } catch {
    } finally {
      busyOps--;
      if (busyOps === 0) schedule(id, 150);
    }
  }

  $effect(() => {
    const id = current;
    if (id) untrack(() => fetchList(id));
  });

  onMount(() => {
    const off = onStateChanges((changes) => {
      for (const id of Object.keys(changes ?? {})) if (id.startsWith('todo.') && (id === current || items[id])) schedule(id);
    });
    const poll = setInterval(() => current && !document.hidden && schedule(current, 0), 30e3);
    return () => {
      off();
      clearInterval(poll);
      Object.values(timers).forEach(clearTimeout);
    };
  });

  function pick(id) {
    sel = id;
    sessionStorage.setItem(LKEY, id);
  }

  function add(e) {
    e?.preventDefault();
    const v = text.trim();
    const id = current;
    if (!v || !id) return;
    text = '';
    (items[id] ??= []).push({ uid: `tmp-${Date.now()}`, summary: v, status: 'needs_action', _tmp: true });
    input?.focus();
    op(id, () => callService('todo', 'add_item', { item: v }, id));
  }

  function toggle(it) {
    const id = current;
    const checked = it.status === 'completed' || celebrating.includes(it.uid);
    if (!checked) {
      celebrating = [...celebrating, it.uid];
      navigator.vibrate?.(15);
      op(id, async () => {
        await Promise.all([
          callService('todo', 'update_item', { item: it.uid, status: 'completed' }, id),
          new Promise((r) => setTimeout(r, CELEBRATE_MS)),
        ]).finally(() => {
          it.status = 'completed';
          celebrating = celebrating.filter((u) => u !== it.uid);
        });
      });
    } else {
      it.status = 'needs_action';
      op(id, () => callService('todo', 'update_item', { item: it.uid, status: 'needs_action' }, id));
    }
  }

  function rename(it, v) {
    const id = current;
    it.summary = v;
    op(id, () => callService('todo', 'update_item', { item: it.uid, rename: v }, id));
  }

  function remove(it) {
    const id = current;
    items[id] = (items[id] ?? []).filter((x) => x.uid !== it.uid);
    op(id, () => callService('todo', 'remove_item', { item: it.uid }, id, 'Verwijderd'));
  }

  function clearDone() {
    const id = current;
    const uids = done.map((i) => i.uid);
    if (!uids.length) return;
    items[id] = (items[id] ?? []).filter((x) => !uids.includes(x.uid));
    op(id, () =>
      canClear
        ? callService('todo', 'remove_completed_items', {}, id, 'Afgewerkte items gewist ✨')
        : callService('todo', 'remove_item', { item: uids }, id, 'Afgewerkte items gewist ✨'),
    );
  }

  function toggleDone() {
    showDone = !showDone;
    sessionStorage.setItem('agenda.done', showDone ? '1' : '0');
  }
</script>

{#if !lists.length}
  <Card>
    <EmptyState iconPath={mdiPlaylistRemove} title="Nog geen lijsten" text="Kies in Instellingen → Huishouden welke lijsten jullie hier willen zien.">
      <button class="btn primary" onclick={openSettings}><Icon name="settings" size={18} />Naar instellingen</button>
    </EmptyState>
  </Card>
{:else}
  <div class="col" style="gap:var(--gap)">
    {#if lists.length > 1}
      <div class="chips no-swipe">
        {#each lists as id (id)}
          {@const n = count(id)}
          <Chip icon={icon(id)} label={name($states[id]) || id} color={colorFor(id)} active={id === current} onclick={() => pick(id)}>
            {#key n}<span class="cnt" class:zero={n === 0}>{n}</span>{/key}
          </Chip>
        {/each}
      </div>
    {/if}

    <Card icon={icon(current)} title={name(cur) || current} subtitle={list ? `${openCount} open · ${done.length} afgewerkt` : ''} accent={color}>
      {#if cur && unavailable(cur) && Object.keys($states).length}
        <p class="muted small">Niet beschikbaar</p>
      {:else}
        <div class="col" style="gap:12px;--c:{color}">
          <form class="addrow" onsubmit={add}>
            <input class="input" bind:this={input} bind:value={text} {placeholder} enterkeyhint="done" maxlength="200" aria-label="Nieuw item" />
            <button class="btn primary icon addbtn" type="submit" disabled={!text.trim()} aria-label="Toevoegen"><Icon name="plus" /></button>
          </form>

          {#if list === null}
            {#each [0, 1, 2] as i (i)}<div class="skeleton sk"></div>{/each}
          {:else}
            {#if open.length}
              <div class="items">
                {#each open as it (it.uid)}
                  <div animate:flip={{ duration: 320, easing: cubicOut }} in:fly={{ y: -12, duration: 300 }} out:slide={{ duration: 260 }}>
                    <TodoItem item={it} {color} checked={it.status === 'completed' || celebrating.includes(it.uid)} celebrate={celebrating.includes(it.uid)} ontoggle={() => toggle(it)} onrename={(v) => rename(it, v)} ondelete={() => remove(it)} />
                  </div>
                {/each}
              </div>
            {:else}
              <div in:fade>
                <EmptyState iconPath={mdiCheckAll} title={done.length ? 'Alles afgewerkt! 🎉' : 'Lijst is leeg'} text={done.length ? 'Goed bezig.' : 'Voeg hierboven iets toe.'} />
              </div>
            {/if}

            {#if done.length}
              <div class="done-head spread">
                <button class="btn ghost sm" onclick={toggleDone} aria-expanded={showDone}>
                  <span class="chev" class:open={showDone}><Icon name="chevronDown" size={18} /></span>
                  Afgewerkt ({done.length})
                </button>
                <button class="btn danger sm" onclick={clearDone}><Icon name="delete" size={16} />Afgewerkte wissen</button>
              </div>
              {#if showDone}
                <div class="items" transition:slide={{ duration: 280 }}>
                  {#each done as it (it.uid)}
                    <div animate:flip={{ duration: 320 }} in:fly={{ y: -10, duration: 280 }} out:slide={{ duration: 220 }}>
                      <TodoItem item={it} {color} checked ontoggle={() => toggle(it)} onrename={(v) => rename(it, v)} ondelete={() => remove(it)} />
                    </div>
                  {/each}
                </div>
              {/if}
            {/if}
          {/if}
        </div>
      {/if}
    </Card>
  </div>
{/if}

<style>
  .chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .chips::-webkit-scrollbar { display: none; }
  .cnt {
    min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; display: inline-grid; place-items: center; font-size: 0.75rem; font-weight: 800;
    background: color-mix(in srgb, currentColor 18%, transparent); animation: pop 0.4s var(--spring);
  }
  .cnt.zero { opacity: 0.55; }
  .addrow { display: flex; gap: 8px; align-items: center; }
  .addrow .input { min-height: 48px; font-size: 1rem; }
  .addbtn { width: 48px; height: 48px; flex-shrink: 0; transition: transform 0.25s var(--spring), opacity 0.2s; }
  .addbtn:not(:disabled) { animation: pop 0.35s var(--spring); }
  .items { display: flex; flex-direction: column; gap: 6px; }
  .sk { height: 54px; border-radius: var(--radius-sm); }
  .done-head { gap: 8px; margin-top: 4px; }
  .chev { display: inline-flex; transition: transform 0.3s var(--spring); transform: rotate(-90deg); }
  .chev.open { transform: rotate(0); }
</style>

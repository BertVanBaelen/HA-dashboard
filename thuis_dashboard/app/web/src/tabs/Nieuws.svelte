<script>
  import { onMount, untrack } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { NEWS_SOURCES } from '$shared/config.js';
  import { prefs, actionQuiet } from '../lib/api.js';
  import { relTime } from '../lib/format.js';
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import NewsCard from './nieuws/NewsCard.svelte';
  import NewsSources from './nieuws/NewsSources.svelte';
  import { dismiss, undismiss, loadBody } from './nieuws/news.js';

  const REFRESH_MS = 10 * 60e3;
  const FILTER_KEY = 'nieuws.filter';
  const srcById = Object.fromEntries(NEWS_SOURCES.map((s) => [s.id, s]));

  let items = $state(/** @type {any[]} */ ([]));
  let errors = $state(/** @type {{source:string,error:string}[]} */ ([]));
  let fetchedAt = $state(0);
  let loading = $state(false);
  let failed = $state('');
  let filter = $state(sessionStorage.getItem(FILTER_KEY) ?? 'alle');
  let sourcesOpen = $state(false);
  let undo = $state(/** @type {string[]|null} */ (null));
  let undoTimer = 0;
  /** @type {any} */
  let topCard = $state();

  const dismissed = $derived($prefs.news?.dismissed ?? {});
  const unread = $derived(items.filter((i) => !(i.id in dismissed)));
  const counts = $derived(unread.reduce((m, i) => ((m[i.source] = (m[i.source] ?? 0) + 1), m), /** @type {Record<string,number>} */ ({})));
  const chips = $derived(NEWS_SOURCES.filter((s) => counts[s.id] || s.id === filter));
  const deck = $derived(filter === 'alle' ? unread : unread.filter((i) => i.source === filter));
  const sourcesKey = $derived(JSON.stringify($prefs.news?.sources ?? {}));

  async function load(force = false) {
    loading = true;
    try {
      const r = await actionQuiet('news', { op: 'list', force });
      items = r.items;
      errors = r.errors;
      fetchedAt = r.fetchedAt;
      failed = '';
    } catch (err) {
      failed = err.message ?? String(err);
    } finally {
      loading = false;
    }
  }

  // (Re)load when the source settings change – this also does the first load.
  $effect(() => {
    sourcesKey;
    untrack(() => load());
  });

  onMount(() => {
    const iv = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const vis = () => document.visibilityState === 'visible' && Date.now() - fetchedAt > REFRESH_MS && load();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
      clearTimeout(undoTimer);
    };
  });

  // Fetch the next article in the background so it is ready when the current one is swiped away.
  $effect(() => {
    const next = deck[1];
    if (!next?.readable) return;
    const t = setTimeout(() => loadBody(next.id), 800);
    return () => clearTimeout(t);
  });

  function setFilter(v) {
    filter = v;
    sessionStorage.setItem(FILTER_KEY, v);
  }

  function offerUndo(ids) {
    undo = ids;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (undo = null), 5000);
  }

  function gone(item) {
    dismiss([item.id]);
    offerUndo([item.id]);
    if (scrollY > 0) scrollTo({ top: 0, behavior: scrollY < 900 ? 'smooth' : 'instant' });
  }

  function allRead() {
    const ids = deck.map((i) => i.id);
    dismiss(ids);
    offerUndo(ids);
  }

  function doUndo() {
    if (!undo) return;
    undismiss(undo);
    undo = null;
    clearTimeout(undoTimer);
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onkey(e) {
    if (e.target.closest?.('input, textarea, select') || sourcesOpen) return;
    if (e.key === 'Delete' || (e.key === 'ArrowDown' && e.altKey)) topCard?.away(1);
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="news col">
  <div class="head">
    <div class="grow">
      <h2 class="title">Nieuws</h2>
      <span class="tiny faint">
        {#if undo}{undo.length === 1 ? 'Bericht weggedaan' : `${undo.length} berichten weggedaan`}{:else if failed && !items.length}Kon het nieuws niet laden{:else if items.length}{deck.length} {deck.length === 1 ? 'bericht' : 'berichten'} · bijgewerkt {relTime(fetchedAt)}{:else}Laden…{/if}
      </span>
    </div>
    {#if undo}
      <button class="btn soft sm" in:fly={{ y: -8, duration: 200 }} onclick={doUndo}><Icon name="undo" size={18} />Ongedaan maken</button>
    {:else if deck.length > 1}
      <button class="btn ghost sm" onclick={allRead} title="Alles als gelezen markeren"><Icon name="check" size={18} />Alles gelezen</button>
    {/if}
    <button class="btn icon soft" class:spin={loading} onclick={() => load(true)} disabled={loading} aria-label="Vernieuwen"><Icon name="refresh" size={20} /></button>
    <button class="btn icon soft" onclick={() => (sourcesOpen = true)} aria-label="Bronnen"><Icon name="tune" size={20} /></button>
  </div>

  {#if chips.length > 1 || filter !== 'alle'}
    <div class="chips no-swipe">
      <button class="chip" class:sel={filter === 'alle'} onclick={() => setFilter('alle')}>Alles <b>{unread.length}</b></button>
      {#each chips as s (s.id)}
        <button class="chip" class:sel={filter === s.id} style="--c:{s.color}" onclick={() => setFilter(s.id)}>
          <span class="dot"></span>{s.name} <b>{counts[s.id] ?? 0}</b>
        </button>
      {/each}
    </div>
  {/if}

  {#if errors.length}
    <p class="tiny faint err">{errors.map((e) => srcById[e.source]?.name ?? e.source).join(', ')} {errors.length === 1 ? 'kon' : 'konden'} niet bijgewerkt worden.</p>
  {/if}

  {#if !items.length && (loading || !failed)}
    <div class="stack">
      <div class="skeleton ph"></div>
    </div>
  {:else if failed && !items.length}
    <EmptyState icon="wifiOff" title="Geen nieuws" text={failed}>
      <button class="btn soft" onclick={() => load(true)}><Icon name="refresh" size={18} />Opnieuw</button>
    </EmptyState>
  {:else if !deck.length}
    <div in:fade>
      <EmptyState icon="check" title="Je bent helemaal mee" text={filter === 'alle' ? 'Nieuwe berichten verschijnen hier vanzelf.' : `Geen nieuwe berichten van ${srcById[filter]?.name}.`}>
        {#if filter !== 'alle'}<button class="btn soft" onclick={() => setFilter('alle')}>Toon alle bronnen</button>{/if}
      </EmptyState>
    </div>
  {:else}
    <div class="stack" data-no-swipe>
      {#each deck.slice(1, 3) as it, i (it.id)}
        <div class="peek p{i + 1}" aria-hidden="true"><NewsCard item={it} source={srcById[it.source]} /></div>
      {/each}
      {#key deck[0].id}
        <div class="current" in:scale={{ start: 0.96, duration: 260, opacity: 0.6 }}>
          <NewsCard bind:this={topCard} item={deck[0]} source={srcById[deck[0].source]} top ondismiss={() => gone(deck[0])} />
        </div>
      {/key}
    </div>
  {/if}
</div>

<Sheet bind:open={sourcesOpen} title="Nieuwsbronnen">
  <NewsSources />
</Sheet>

<style>
  .news { gap: 12px; max-width: 680px; margin: 0 auto; width: 100%; }
  .head { display: flex; align-items: center; gap: 8px; }
  .title { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; }
  .spin :global(svg) { animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 2px 4px; }
  .chips::-webkit-scrollbar { display: none; }
  .chip { --c: var(--accent); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; transition: background 0.25s, color 0.25s, border-color 0.25s; }
  .chip b { font-weight: 800; opacity: 0.7; }
  .chip.sel { background: color-mix(in srgb, var(--c) 16%, var(--surface)); border-color: var(--c); color: var(--text); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .err { margin: 0; }
  .stack { --cover-h: clamp(340px, calc(100dvh - 300px - var(--safe-bottom)), 760px); position: relative; padding-top: 18px; }
  .current { position: relative; z-index: 3; }
  .peek { position: absolute; left: 0; right: 0; overflow: hidden; border-radius: 26px; pointer-events: none; transform-origin: top center; transition: transform 0.3s var(--ease); }
  .peek.p1 { top: 9px; z-index: 2; transform: scale(0.95); opacity: 0.85; }
  .peek.p2 { top: 0; z-index: 1; transform: scale(0.9); opacity: 0.55; }
  .ph { height: var(--cover-h); border-radius: 26px; }
</style>

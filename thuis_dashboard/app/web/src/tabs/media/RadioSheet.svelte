<script>
  import { fly } from 'svelte/transition';
  import { mdiStar, mdiStarOutline, mdiRadioTower, mdiFolder, mdiChevronRight, mdiArrowLeft } from '@mdi/js';
  import { household, action, saveHousehold, toast } from '../../lib/api.js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';

  /** @typedef {{title:string,mediaId:string,canPlay:boolean,canExpand:boolean}} Item */
  /** @type {{ open?: boolean, currentId?: string|null, onplay: (r: {name:string,mediaId:string}) => void }} */
  let { open = $bindable(false), currentId = null, onplay } = $props();

  /** Browse path on the stereo (MusicCast media browser); first entry is the root. */
  let trail = $state(/** @type {{title:string,mediaId:string|null}[]} */ ([]));
  let items = $state(/** @type {Item[]|null} */ (null));
  let error = $state('');
  let started = false;

  async function browse(/** @type {string|null} */ mediaId, /** @type {string} */ title, push = true) {
    items = null;
    error = '';
    try {
      const res = await action('browseStereo', mediaId ? { mediaId } : {}, null);
      const list = /** @type {Item[]} */ (res?.children ?? []);
      // Jump straight into Net Radio when the root offers it
      const net = !mediaId && list.find((c) => c.canExpand && /net\s*radio/i.test(c.title));
      if (net) return browse(net.mediaId, net.title, push);
      if (push) trail = [...trail, { title: title || res?.title || '', mediaId }];
      items = list;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Laden mislukt';
      items = [];
    }
  }

  function back() {
    if (trail.length < 2) return;
    const prev = trail[trail.length - 2];
    trail = trail.slice(0, -2);
    browse(prev.mediaId, prev.title);
  }

  $effect(() => {
    if (open && !started) {
      started = true;
      trail = [];
      browse(null, 'Net Radio');
    }
    if (!open) started = false;
  });

  const favIds = $derived(new Set(($household?.radios ?? []).map((/** @type {any} */ r) => r.mediaId)));

  async function toggleFav(/** @type {Item} */ r) {
    const radios = $household?.radios ?? [];
    const exists = radios.some((/** @type {any} */ x) => x.mediaId === r.mediaId);
    const next = exists
      ? radios.filter((/** @type {any} */ x) => x.mediaId !== r.mediaId)
      : [...radios, { id: `r${Date.now().toString(36)}`, name: r.title, mediaId: r.mediaId }];
    try {
      await saveHousehold({ radios: next });
      toast(exists ? `${r.title} verwijderd uit favorieten` : `${r.title} toegevoegd aan favorieten`, 'ok');
    } catch {
      toast('Opslaan mislukt', 'error');
    }
  }
</script>

<Sheet bind:open title="Andere radio">
  <div class="col" style="gap:12px">
    {#if trail.length > 1}
      <button class="btn soft sm back" onclick={back}><Icon path={mdiArrowLeft} size={18} />{trail[trail.length - 2].title || 'Terug'}</button>
    {/if}
    {#if trail.length}<p class="tiny faint crumb">Net Radio van de stereo · {trail[trail.length - 1].title}</p>{/if}
    {#if items === null}
      {#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="skeleton" style="height:56px;border-radius:14px"></div>{/each}
    {:else if error}
      <EmptyState iconPath={mdiRadioTower} title="Zenders laden mislukt" text={error}>
        <button class="btn soft sm" onclick={() => { trail = []; browse(null, 'Net Radio'); }}>Opnieuw</button>
      </EmptyState>
    {:else if !items.length}
      <EmptyState iconPath={mdiRadioTower} text="Niets gevonden" />
    {:else}
      <div class="list">
        {#each items as r, i (r.mediaId + i)}
          {@const playing = !!currentId && currentId === r.mediaId}
          <div class="station" class:playing in:fly={{ y: 10, delay: Math.min(i, 12) * 25, duration: 250 }}>
            {#if r.canPlay}
              <button class="play" onclick={() => onplay({ name: r.title, mediaId: r.mediaId })}>
                <span class="fav">{r.title[0]}</span>
                <span class="grow ellipsis">{r.title}</span>
                {#if playing}<span class="eq"><i></i><i></i><i></i></span>{/if}
              </button>
              <button class="btn icon ghost star" class:on={favIds.has(r.mediaId)} aria-label="Favoriet" onclick={() => toggleFav(r)}>
                <Icon path={favIds.has(r.mediaId) ? mdiStar : mdiStarOutline} size={22} />
              </button>
            {:else if r.canExpand}
              <button class="play" onclick={() => browse(r.mediaId, r.title)}>
                <span class="fav dir"><Icon path={mdiFolder} size={22} /></span>
                <span class="grow ellipsis">{r.title}</span>
                <Icon path={mdiChevronRight} size={20} />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</Sheet>

<style>
  .back { align-self: flex-start; }
  .crumb { margin: 0; }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .station { display: flex; align-items: center; gap: 4px; border-radius: 14px; background: var(--surface-2); transition: background 0.3s; }
  .station.playing { background: var(--accent-soft); }
  .play { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 8px 10px; min-height: 56px; border: 0; background: none; color: var(--text); font-weight: 600; text-align: left; cursor: pointer; transition: transform 0.2s var(--spring); }
  .play:active { transform: scale(0.97); }
  .fav { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; overflow: hidden; display: grid; place-items: center; background: var(--gradient); color: #fff; font-weight: 800; }
  .fav.dir { background: var(--accent-soft); color: var(--accent); }
  .star { color: var(--text-3); }
  .star.on { color: #f59e0b; animation: pop 0.4s var(--spring); }
  .eq { display: flex; align-items: flex-end; gap: 2px; height: 16px; }
  .eq i { width: 3px; border-radius: 2px; background: var(--accent); animation: eq 0.8s ease-in-out infinite alternate; }
  .eq i:nth-child(2) { animation-delay: -0.3s; }
  .eq i:nth-child(3) { animation-delay: -0.55s; }
  @keyframes eq { from { height: 25%; } to { height: 100%; } }
</style>

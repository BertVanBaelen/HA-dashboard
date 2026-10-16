<script>
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { mdiMagnify, mdiStar, mdiStarOutline, mdiRadioTower } from '@mdi/js';
  import { household, action, saveHousehold, toast } from '../../lib/api.js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';

  /** @type {{ open?: boolean, currentUrl?: string|null, onplay: (r: {name:string,url:string}) => void }} */
  let { open = $bindable(false), currentUrl = null, onplay } = $props();

  let list = $state(/** @type {{id:string,name:string,url:string,favicon:string|null}[]|null} */ (null));
  let error = $state(false);
  let q = $state('');
  let badIcons = $state(/** @type {Record<string, boolean>} */ ({}));

  async function load() {
    error = false;
    try {
      list = (await action('searchRadios', {}, null)) ?? [];
    } catch {
      error = true;
      list = [];
    }
  }

  $effect(() => {
    if (open && list === null) load();
  });

  const favUrls = $derived(new Set(($household?.radios ?? []).map((/** @type {any} */ r) => r.url)));
  const shown = $derived.by(() => {
    const needle = q.trim().toLowerCase();
    return (list ?? []).filter((r) => !needle || r.name.toLowerCase().includes(needle)).slice(0, 80);
  });

  async function toggleFav(/** @type {{id:string,name:string,url:string}} */ r) {
    const radios = $household?.radios ?? [];
    const exists = radios.some((/** @type {any} */ x) => x.url === r.url);
    const next = exists ? radios.filter((/** @type {any} */ x) => x.url !== r.url) : [...radios, { id: r.id, name: r.name, url: r.url }];
    try {
      await saveHousehold({ radios: next });
      toast(exists ? `${r.name} verwijderd uit favorieten` : `${r.name} toegevoegd aan favorieten`, 'ok');
    } catch {
      toast('Opslaan mislukt', 'error');
    }
  }
</script>

<Sheet bind:open title="Andere radio">
  <div class="col" style="gap:12px">
    <label class="search">
      <Icon path={mdiMagnify} size={20} />
      <input class="input" type="search" placeholder="Zoek een Vlaamse zender…" bind:value={q} />
    </label>
    {#if list === null}
      {#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="skeleton" style="height:56px;border-radius:14px"></div>{/each}
    {:else if error}
      <EmptyState iconPath={mdiRadioTower} title="Zenders laden mislukt" text="Radio Browser is niet bereikbaar">
        <button class="btn soft sm" onclick={() => { list = null; load(); }}>Opnieuw</button>
      </EmptyState>
    {:else if !shown.length}
      <EmptyState iconPath={mdiRadioTower} text="Geen zenders gevonden" />
    {:else}
      <div class="list">
        {#each shown as r, i (r.id)}
          {@const playing = currentUrl === r.url}
          <div class="station" class:playing animate:flip={{ duration: 250 }} in:fly={{ y: 10, delay: Math.min(i, 12) * 25, duration: 250 }}>
            <button class="play" onclick={() => onplay(r)}>
              <span class="fav">
                {#if r.favicon && !badIcons[r.id]}
                  <img src={r.favicon} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (badIcons[r.id] = true)} />
                {:else}
                  {r.name[0]}
                {/if}
              </span>
              <span class="grow ellipsis">{r.name}</span>
              {#if playing}<span class="eq"><i></i><i></i><i></i></span>{/if}
            </button>
            <button class="btn icon ghost star" class:on={favUrls.has(r.url)} aria-label="Favoriet" onclick={() => toggleFav(r)}>
              <Icon path={favUrls.has(r.url) ? mdiStar : mdiStarOutline} size={22} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</Sheet>

<style>
  .search { display: flex; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 2; color: var(--text-3); }
  .search .input { flex: 1; }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .station { display: flex; align-items: center; gap: 4px; border-radius: 14px; background: var(--surface-2); transition: background 0.3s; }
  .station.playing { background: var(--accent-soft); }
  .play { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 8px 10px; min-height: 56px; border: 0; background: none; color: var(--text); font-weight: 600; text-align: left; cursor: pointer; transition: transform 0.2s var(--spring); }
  .play:active { transform: scale(0.97); }
  .fav { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; overflow: hidden; display: grid; place-items: center; background: var(--gradient); color: #fff; font-weight: 800; }
  .fav img { width: 100%; height: 100%; object-fit: cover; background: #fff; }
  .star { color: var(--text-3); }
  .star.on { color: #f59e0b; animation: pop 0.4s var(--spring); }
  .eq { display: flex; align-items: flex-end; gap: 2px; height: 16px; }
  .eq i { width: 3px; border-radius: 2px; background: var(--accent); animation: eq 0.8s ease-in-out infinite alternate; }
  .eq i:nth-child(2) { animation-delay: -0.3s; }
  .eq i:nth-child(3) { animation-delay: -0.55s; }
  @keyframes eq { from { height: 25%; } to { height: 100%; } }
</style>

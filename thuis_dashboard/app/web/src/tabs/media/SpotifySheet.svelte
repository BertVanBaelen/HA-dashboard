<script>
  import { fly } from 'svelte/transition';
  import { mdiArrowLeft, mdiPlay, mdiShuffleVariant, mdiMusicNoteOff, mdiAccountMusic, mdiAlbum, mdiPlaylistMusic, mdiPodcast } from '@mdi/js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import SpotifyTrackRow from './SpotifyTrackRow.svelte';
  import SpotifyTile from './SpotifyTile.svelte';
  import { sp, spQuiet } from './spotify.js';

  /** @typedef {import('./spotify.js').SpItem} SpItem */
  /** @type {{ open?: boolean, item: SpItem|null, nowUri?: string }} */
  let { open = $bindable(false), item, nowUri = '' } = $props();

  const ICONS = { artist: mdiAccountMusic, album: mdiAlbum, playlist: mdiPlaylistMusic, show: mdiPodcast };
  const KIND = { artist: 'Artiest', album: 'Album', playlist: 'Afspeellijst', show: 'Podcast' };

  /** Navigation stack inside the sheet (artist → album). */
  let stack = $state(/** @type {SpItem[]} */ ([]));
  let data = $state(/** @type {{tracks:SpItem[],albums?:SpItem[],locked?:boolean}|null} */ (null));
  let error = $state('');
  let busy = $state('');
  const cur = $derived(stack[stack.length - 1] ?? null);

  async function load(/** @type {SpItem} */ it) {
    data = null;
    error = '';
    try {
      data = await spQuiet('open', { uri: it.uri });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Laden mislukt';
    }
  }

  let shownFor = /** @type {string|null} */ (null);
  $effect(() => {
    if (open && item && shownFor !== item.uri) {
      shownFor = item.uri;
      stack = [item];
      load(item);
    }
    if (!open) shownFor = null;
  });

  function push(/** @type {SpItem} */ it) {
    stack = [...stack, it];
    load(it);
  }
  function back() {
    stack = stack.slice(0, -1);
    if (cur) load(cur);
  }

  async function run(/** @type {string} */ key, /** @type {() => Promise<any>} */ fn) {
    busy = key;
    try {
      await fn();
    } catch {
    } finally {
      busy = '';
    }
  }

  const tracks = $derived(data?.tracks ?? []);
  const isArtist = $derived(cur?.type === 'artist');

  function playAll(/** @type {boolean} */ shuffle) {
    if (!cur) return;
    run(shuffle ? 'shuffle' : 'all', () =>
      isArtist
        ? sp('play', { uris: tracks.map((t) => t.uri), shuffle }, `${cur.name} wordt afgespeeld`)
        : sp('play', { uri: cur.uri, shuffle }, `${cur.name} wordt afgespeeld`),
    );
  }

  function playTrack(/** @type {SpItem} */ t, /** @type {number} */ i) {
    if (!cur) return;
    run(t.uri, () => (isArtist ? sp('play', { uris: tracks.slice(i).map((x) => x.uri) }) : sp('play', { uri: t.uri, contextUri: cur.uri })));
  }

  const queue = (/** @type {SpItem} */ t) => sp('addToQueue', { uri: t.uri }, `${t.name} staat in de wachtrij`).catch(() => {});
</script>

<Sheet bind:open title={cur ? KIND[/** @type {keyof typeof KIND} */ (cur.type)] ?? 'Spotify' : 'Spotify'}>
  {#if cur}
    <div class="col" style="gap:14px">
      {#if stack.length > 1}
        <button class="btn soft sm back" onclick={back}><Icon path={mdiArrowLeft} size={18} />{stack[stack.length - 2].name}</button>
      {/if}
      {#key cur.uri}
        <div class="head" class:round={isArtist} in:fly={{ y: 10, duration: 250 }}>
          <span class="cover">
            {#if cur.image}<img src={cur.image} alt="" />{:else}<Icon path={ICONS[/** @type {keyof typeof ICONS} */ (cur.type)] ?? mdiPlaylistMusic} size={40} />{/if}
          </span>
          <div class="grow meta">
            <h3>{cur.name}</h3>
            {#if cur.sub}<span class="small muted">{cur.sub}</span>{/if}
            <div class="row btns">
              <button class="btn primary sp" disabled={!!busy || (isArtist && !tracks.length)} onclick={() => playAll(false)}>
                {#if busy === 'all'}<span class="spinner"></span>{:else}<Icon path={mdiPlay} size={20} />{/if}Afspelen
              </button>
              <button class="btn soft" aria-label="Shuffle" disabled={!!busy || (isArtist && !tracks.length)} onclick={() => playAll(true)}>
                {#if busy === 'shuffle'}<span class="spinner dark"></span>{:else}<Icon path={mdiShuffleVariant} size={20} />{/if}
              </button>
            </div>
          </div>
        </div>
      {/key}

      {#if data === null && !error}
        {#each [0, 1, 2, 3, 4, 5] as i (i)}<div class="skeleton" style="height:52px;border-radius:12px"></div>{/each}
      {:else if error}
        <EmptyState iconPath={mdiMusicNoteOff} title="Laden mislukt" text={error}>
          <button class="btn soft sm" onclick={() => load(cur)}>Opnieuw</button>
        </EmptyState>
      {:else if data?.locked}
        <EmptyState
          iconPath={mdiPlaylistMusic}
          title="Nummers niet zichtbaar"
          text="Spotify toont de inhoud van afspeellijsten van anderen niet meer aan deze app. Met Afspelen of Shuffle speel je ze wel af."
        />
      {:else}
        {#if isArtist && tracks.length}<h4 class="sect">Populair</h4>{/if}
        {#if tracks.length}
          <div class="list">
            {#each tracks as t, i (t.uri + i)}
              <SpotifyTrackRow item={t} image={cur.type === 'album' ? cur.image : null} active={t.uri === nowUri} busy={busy === t.uri} onplay={() => playTrack(t, i)} onqueue={() => queue(t)} />
            {/each}
          </div>
        {:else if !data?.albums?.length}
          <EmptyState iconPath={mdiMusicNoteOff} text="Hier staat niets in" />
        {/if}
        {#if data?.albums?.length}
          <h4 class="sect">Albums & singles</h4>
          <div class="tiles">
            {#each data.albums as al, i (al.uri)}
              <SpotifyTile item={al} delay={Math.min(i, 12) * 20} onclick={() => push(al)} />
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .back { align-self: flex-start; }
  .head { display: flex; gap: 16px; align-items: flex-end; }
  .cover { width: 116px; height: 116px; flex-shrink: 0; border-radius: 14px; overflow: hidden; display: grid; place-items: center; background: var(--surface-3); color: var(--text-3); box-shadow: 0 16px 34px -16px rgba(0, 0, 0, 0.6); }
  .round .cover { border-radius: 50%; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .meta { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  h3 { font-size: 1.2rem; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .btns { margin-top: 8px; gap: 8px; }
  .sp { background: #1db954; box-shadow: 0 8px 20px -8px #1db954; gap: 6px; }
  .sect { margin: 4px 0 -4px; font-size: 0.95rem; }
  .list { display: flex; flex-direction: column; gap: 2px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 4px; }
  .spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: #fff; animation: spin 0.8s linear infinite; }
  .spinner.dark { border-color: color-mix(in srgb, currentColor 30%, transparent); border-top-color: currentColor; }
</style>

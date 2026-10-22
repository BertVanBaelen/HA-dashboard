<script>
  import { mdiPlaylistMusic } from '@mdi/js';
  import Sheet from '../../components/Sheet.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import SpotifyTrackRow from './SpotifyTrackRow.svelte';
  import { sp, spQuiet } from './spotify.js';

  /** @typedef {import('./spotify.js').SpItem} SpItem */
  /** @type {{ open?: boolean, nowUri?: string }} */
  let { open = $bindable(false), nowUri = '' } = $props();

  let data = $state(/** @type {{current:SpItem|null,queue:SpItem[]}|null} */ (null));
  let error = $state('');
  let busy = $state('');

  async function load() {
    error = '';
    try {
      data = await spQuiet('queue');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Laden mislukt';
      data = { current: null, queue: [] };
    }
  }

  $effect(() => {
    if (open) {
      data = null;
      load();
    }
  });

  // Refresh when the track changes while the sheet is open
  let lastUri = '';
  $effect(() => {
    const u = nowUri;
    if (open && data && u && u !== lastUri) load();
    lastUri = u;
  });

  async function playFrom(/** @type {number} */ i) {
    if (!data) return;
    const t = data.queue[i];
    busy = t.uri;
    try {
      await sp('play', { uris: data.queue.slice(i).map((x) => x.uri) });
    } catch {
    } finally {
      busy = '';
    }
  }
</script>

<Sheet bind:open title="Wachtrij">
  <div class="col" style="gap:10px">
    {#if data === null}
      {#each [0, 1, 2, 3, 4] as i (i)}<div class="skeleton" style="height:52px;border-radius:12px"></div>{/each}
    {:else}
      {#if data.current}
        <h4>Nu</h4>
        <SpotifyTrackRow item={data.current} active onplay={() => {}} />
      {/if}
      <h4>Hierna</h4>
      {#if data.queue.length}
        <div class="list">
          {#each data.queue as t, i (t.uri + i)}
            <SpotifyTrackRow item={t} busy={busy === t.uri} active={t.uri === nowUri && !data.current} onplay={() => playFrom(i)} />
          {/each}
        </div>
      {:else}
        <EmptyState iconPath={mdiPlaylistMusic} text={error || 'De wachtrij is leeg'} />
      {/if}
    {/if}
  </div>
</Sheet>

<style>
  h4 { font-size: 0.95rem; margin: 4px 0 -4px; }
  .list { display: flex; flex-direction: column; gap: 2px; }
</style>

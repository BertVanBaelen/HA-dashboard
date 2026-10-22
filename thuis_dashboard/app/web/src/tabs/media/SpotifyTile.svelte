<script>
  import { mdiAccountMusic, mdiAlbum, mdiPlaylistMusic, mdiPodcast } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ item: import('./spotify.js').SpItem, active?: boolean, onclick: () => void, delay?: number }} */
  let { item, active = false, onclick, delay = 0 } = $props();
  const ICONS = { artist: mdiAccountMusic, album: mdiAlbum, playlist: mdiPlaylistMusic, show: mdiPodcast };
  let broken = $state(false);
</script>

<button class="tile" class:round={item.type === 'artist'} class:active {onclick} style="--d:{delay}ms">
  <span class="cover">
    {#if item.image && !broken}<img src={item.image} alt="" loading="lazy" onerror={() => (broken = true)} />
    {:else}<Icon path={ICONS[/** @type {keyof typeof ICONS} */ (item.type)] ?? mdiPlaylistMusic} size={30} />{/if}
  </span>
  <span class="name ellipsis">{item.name}</span>
  {#if item.sub}<span class="tiny muted ellipsis">{item.sub}</span>{/if}
</button>

<style>
  .tile { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 6px; border: 0; border-radius: 14px; background: none; color: var(--text); text-align: left; cursor: pointer; animation: pop 0.4s var(--spring) var(--d) both; transition: background 0.25s, transform 0.2s var(--spring); }
  .tile:hover { background: var(--surface-2); }
  .tile:active { transform: scale(0.95); }
  .cover { aspect-ratio: 1; width: 100%; border-radius: 10px; overflow: hidden; display: grid; place-items: center; background: var(--surface-3); color: var(--text-3); box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.5); margin-bottom: 4px; }
  .round .cover { border-radius: 50%; }
  .round { text-align: center; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .name { font-weight: 600; font-size: 0.85rem; }
  .active .name { color: #1db954; }
</style>

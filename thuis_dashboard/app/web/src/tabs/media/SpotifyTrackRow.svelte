<script>
  import { mdiMusicNote, mdiPlaylistPlus, mdiPodcast } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';
  import { mmss } from './spotify.js';

  /** @type {{ item: import('./spotify.js').SpItem, image?: string|null, active?: boolean, busy?: boolean, onplay: () => void, onqueue?: () => void }} */
  let { item, image = null, active = false, busy = false, onplay, onqueue } = $props();
  const pic = $derived(item.image ?? image);
  let broken = $state(false);
</script>

<div class="trow" class:active>
  <button class="main" onclick={onplay} disabled={busy}>
    <span class="pic">
      {#if pic && !broken}<img src={pic} alt="" loading="lazy" onerror={() => (broken = true)} />
      {:else}<Icon path={item.type === 'episode' ? mdiPodcast : mdiMusicNote} size={20} />{/if}
      {#if busy}<span class="spin"></span>{:else if active}<span class="eq"><i></i><i></i><i></i></span>{/if}
    </span>
    <span class="txt grow">
      <span class="name ellipsis">{item.name}</span>
      <span class="tiny muted ellipsis">{#if item.explicit}<b class="e">E</b>{/if}{item.sub}</span>
    </span>
    {#if item.durationMs}<span class="tiny faint num">{mmss(item.durationMs / 1000)}</span>{/if}
  </button>
  {#if onqueue}
    <button class="btn icon ghost q" aria-label="Aan wachtrij toevoegen" onclick={onqueue}><Icon path={mdiPlaylistPlus} size={20} /></button>
  {/if}
</div>

<style>
  .trow { display: flex; align-items: center; gap: 2px; border-radius: 14px; transition: background 0.25s; }
  .trow.active { background: color-mix(in srgb, #1db954 14%, transparent); }
  .main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 6px 8px; border: 0; background: none; color: var(--text); text-align: left; cursor: pointer; transition: transform 0.2s var(--spring); }
  .main:active { transform: scale(0.98); }
  .pic { position: relative; width: 44px; height: 44px; flex-shrink: 0; border-radius: 8px; overflow: hidden; display: grid; place-items: center; background: var(--surface-3); color: var(--text-3); }
  .pic img { width: 100%; height: 100%; object-fit: cover; }
  .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-weight: 600; font-size: 0.92rem; }
  .active .name { color: #1db954; }
  .e { display: inline-grid; place-items: center; width: 14px; height: 14px; margin-right: 5px; border-radius: 3px; font-size: 0.6rem; background: var(--text-3); color: var(--surface-solid); vertical-align: 1px; }
  .q { color: var(--text-3); }
  .eq, .spin { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; gap: 2px; padding: 12px 0; background: rgba(0, 0, 0, 0.45); }
  .eq i { width: 3px; border-radius: 2px; background: #1db954; animation: eq 0.8s ease-in-out infinite alternate; }
  .eq i:nth-child(2) { animation-delay: -0.3s; }
  .eq i:nth-child(3) { animation-delay: -0.55s; }
  @keyframes eq { from { height: 25%; } to { height: 100%; } }
  .spin::after { content: ''; align-self: center; width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: #fff; animation: spin 0.8s linear infinite; }
</style>

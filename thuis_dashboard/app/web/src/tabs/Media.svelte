<script>
  import { fly, fade, scale } from 'svelte/transition';
  import { mdiTelevision, mdiSpeaker, mdiPower, mdiSofaOutline } from '@mdi/js';
  import { MEDIA } from '$shared/config.js';
  import { states, action, isOn } from '../lib/api.js';
  import Segmented from '../components/Segmented.svelte';
  import Icon from '../components/Icon.svelte';
  import TvPanel from './media/TvPanel.svelte';
  import StereoPanel from './media/StereoPanel.svelte';

  const LOCK_MS = 3000;
  const LABELS = { tv: 'TV', stereo: 'Stereo', uit: 'Uit' };
  const COLORS = { tv: '#6366f1', stereo: '#ec4899', uit: '#64748b' };

  const tvOn = $derived(isOn($states[MEDIA.tvActive]));
  const stereoOn = $derived(isOn($states[MEDIA.stereoActive]));
  const liveMode = $derived(tvOn ? 'tv' : stereoOn ? 'stereo' : 'uit');

  let pending = $state(/** @type {'tv'|'stereo'|'uit'|null} */ (null));
  const mode = $derived(pending ?? liveMode);

  async function setMode(/** @type {'tv'|'stereo'|'uit'} */ m) {
    if (pending) return;
    pending = m;
    const t0 = Date.now();
    try {
      await action('mediaMode', { mode: m }, m === 'uit' ? 'Media uitgeschakeld' : `${LABELS[m]} staat aan`);
    } catch {
    } finally {
      await new Promise((r) => setTimeout(r, Math.max(0, LOCK_MS - (Date.now() - t0))));
      pending = null;
    }
  }

  const options = [
    { value: 'tv', label: 'TV', iconPath: mdiTelevision, color: COLORS.tv },
    { value: 'stereo', label: 'Stereo', iconPath: mdiSpeaker, color: COLORS.stereo },
    { value: 'uit', label: 'Uit', iconPath: mdiPower, color: COLORS.uit },
  ];
</script>

<div class="media col" style="gap:var(--gap)">
  <div class="modebar" class:busy={!!pending} style="--mc:{COLORS[mode]}">
    <Segmented size="lg" {options} value={mode} disabled={!!pending} onchange={setMode} />
    {#if pending}
      <div class="switching small" transition:fly={{ y: -6, duration: 250 }}>
        <span class="spinner"></span>
        {pending === 'uit' ? 'Alles wordt uitgeschakeld…' : `Overschakelen naar ${LABELS[pending]}…`}
      </div>
    {/if}
  </div>

  {#key liveMode}
    <div class="panel" in:fly={{ y: 24, duration: 450, delay: 120 }} out:fade={{ duration: 120 }}>
      {#if liveMode === 'tv'}
        <TvPanel />
      {:else if liveMode === 'stereo'}
        <StereoPanel />
      {:else}
        <div class="idle" in:scale={{ start: 0.9, duration: 500 }}>
          <span class="idle-ic"><Icon path={mdiSofaOutline} size={44} /></span>
          <b>Alles staat uit</b>
          <span class="small muted">Kies TV of Stereo om te beginnen</span>
        </div>
      {/if}
    </div>
  {/key}
</div>

<style>
  .media { padding-bottom: 10px; }
  .modebar {
    position: relative; display: flex; flex-direction: column; gap: 8px;
    filter: drop-shadow(0 12px 28px color-mix(in srgb, var(--mc) 22%, transparent));
    transition: filter 0.5s;
  }
  .modebar.busy :global(.pill) { animation: breathe 1.2s ease-in-out infinite; }
  @keyframes breathe { 50% { opacity: 0.65; } }
  .switching { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--text-2); font-weight: 600; }
  .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--accent-soft); border-top-color: var(--mc); animation: spin 0.8s linear infinite; }
  .idle { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 16px; text-align: center; color: var(--text-2); }
  .idle-ic {
    width: 88px; height: 88px; border-radius: 28px; display: grid; place-items: center; margin-bottom: 8px;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text-3); animation: float 4s ease-in-out infinite;
  }
</style>

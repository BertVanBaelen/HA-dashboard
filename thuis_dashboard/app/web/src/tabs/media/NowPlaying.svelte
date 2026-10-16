<script>
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { unavailable } from '../../lib/api.js';
  import Icon from '../../components/Icon.svelte';
  import { artworkUrl, OFF_STATES } from './hold.js';

  /**
   * @type {{ s: any, kind: 'tv'|'stereo', color?: string, fallbackTitle?: string, children?: import('svelte').Snippet }}
   */
  let { s, kind, color = 'var(--accent)', fallbackTitle = '', children } = $props();

  const a = $derived(s?.attributes ?? {});
  const na = $derived(unavailable(s));
  const playing = $derived(s?.state === 'playing' || s?.state === 'buffering');
  const paused = $derived(s?.state === 'paused');
  const off = $derived(!s || OFF_STATES.includes(s.state));
  const art = $derived(artworkUrl(s));
  let broken = $state(/** @type {string|null} */ (null));
  const showArt = $derived(!!art && broken !== art);

  const title = $derived(a.media_title || (off ? (na ? 'Niet beschikbaar' : 'Staat uit') : fallbackTitle || (kind === 'tv' ? 'Klaar om te kijken' : 'Klaar om te luisteren')));
  const sub = $derived(
    [a.media_artist || a.media_album_artist || a.media_series_title, a.app_name || a.source].filter(Boolean).join(' · ') ||
      (kind === 'tv' ? 'Chromecast' : 'Stereo'),
  );
  const status = $derived(na ? 'Niet beschikbaar' : playing ? 'Speelt nu' : paused ? 'Gepauzeerd' : off ? 'Uit' : 'Stand-by');

  let now = $state(Date.now());
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });
  const progress = $derived.by(() => {
    const dur = Number(a.media_duration);
    const pos = Number(a.media_position);
    if (!dur || Number.isNaN(pos)) return null;
    const upd = a.media_position_updated_at ? new Date(a.media_position_updated_at).getTime() : now;
    const p = Math.min(dur, pos + (playing ? Math.max(0, (now - upd) / 1000) : 0));
    return { p, dur, pct: (p / dur) * 100 };
  });
  const mmss = (/** @type {number} */ v) => {
    const t = Math.floor(v);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  };
</script>

<div class="np" class:playing class:off style="--np:{color}">
  {#if showArt}
    {#key art}<div class="ambient" style="background-image:url('{art}')" transition:fade={{ duration: 600 }}></div>{/key}
  {/if}
  <div class="row top">
    <div class="art" class:spin-disc={kind === 'stereo' && !showArt}>
      {#if showArt}
        {#key art}
          <img src={art} alt="" in:scale={{ start: 0.85, duration: 400 }} onerror={() => (broken = art)} />
        {/key}
      {:else if kind === 'stereo'}
        <span class="disc"><span class="label"><Icon name="music" size={20} /></span></span>
      {:else}
        <span class="fallback"><Icon name="television" size={44} /></span>
      {/if}
      {#if playing}
        <span class="eq" transition:scale={{ duration: 250 }}><i></i><i></i><i></i><i></i></span>
      {/if}
    </div>
    <div class="meta grow">
      <span class="status tiny">
        <span class="dot"></span>{status}
      </span>
      {#key title}
        <h3 class="title" in:fade={{ duration: 300 }}>{title}</h3>
      {/key}
      <span class="small muted ellipsis">{sub}</span>
    </div>
  </div>
  {#if progress}
    <div class="prog">
      <div class="track"><span style="width:{progress.pct}%"></span></div>
      <div class="spread tiny muted num"><span>{mmss(progress.p)}</span><span>{mmss(progress.dur)}</span></div>
    </div>
  {/if}
  {#if children}<div class="ctrls">{@render children()}</div>{/if}
</div>

<style>
  .np { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 16px; isolation: isolate; overflow: hidden; }
  .ambient {
    position: absolute; inset: -40px; z-index: -1; background-size: cover; background-position: center;
    filter: blur(40px) saturate(1.6); opacity: 0.35; transform: scale(1.1);
  }
  .top { gap: 16px; align-items: center; }
  .art {
    position: relative; width: 104px; height: 104px; flex-shrink: 0; border-radius: 20px; overflow: hidden;
    background: linear-gradient(135deg, var(--np), color-mix(in srgb, var(--np) 40%, var(--accent-2, #8b5cf6)));
    box-shadow: 0 14px 30px -12px var(--np);
    display: grid; place-items: center; color: #fff;
    transition: transform 0.5s var(--spring), box-shadow 0.5s;
  }
  .off .art { filter: grayscale(0.7); opacity: 0.7; box-shadow: none; }
  .playing .art { transform: scale(1.02); }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .fallback { display: grid; place-items: center; filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25)); }
  .disc {
    width: 82px; height: 82px; border-radius: 50%; display: grid; place-items: center;
    background: repeating-radial-gradient(circle, #111 0 2px, #1d1d1d 2px 4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    animation: spin 3.5s linear infinite; animation-play-state: paused;
  }
  .playing .disc { animation-play-state: running; }
  .label { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--np); color: #fff; }
  .eq {
    position: absolute; right: 8px; bottom: 8px; display: flex; align-items: flex-end; gap: 3px; height: 22px;
    padding: 4px 6px; border-radius: 10px; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(6px);
  }
  .eq i { display: block; width: 3px; border-radius: 2px; background: #fff; height: 30%; animation: eq 0.9s ease-in-out infinite alternate; }
  .eq i:nth-child(2) { animation-duration: 0.7s; animation-delay: -0.3s; }
  .eq i:nth-child(3) { animation-duration: 1.05s; animation-delay: -0.6s; }
  .eq i:nth-child(4) { animation-duration: 0.8s; animation-delay: -0.15s; }
  @keyframes eq { 0% { height: 20%; } 50% { height: 100%; } 100% { height: 45%; } }

  .meta { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .status { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); }
  .playing .status { color: var(--np); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  .playing .dot { --pulse: var(--np); }
  .title { font-size: 1.15rem; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  .prog { display: flex; flex-direction: column; gap: 4px; }
  .track { height: 5px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
  .track span { display: block; height: 100%; border-radius: 3px; background: var(--np); transition: width 1s linear; }
  .ctrls { display: flex; justify-content: center; }
</style>

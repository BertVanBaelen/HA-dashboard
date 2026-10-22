<script>
  import { fade, fly } from 'svelte/transition';
  import {
    mdiSpotify, mdiPlay, mdiPause, mdiSkipNext, mdiSkipPrevious, mdiShuffleVariant, mdiRepeat, mdiRepeatOnce, mdiRepeatOff,
    mdiHeart, mdiHeartOutline, mdiPlaylistMusic, mdiMagnify, mdiClose, mdiSpeaker, mdiMusicNoteOff, mdiVolumeHigh, mdiAccountMusic,
  } from '@mdi/js';
  import { MEDIA } from '$shared/config.js';
  import { states, prefs, savePrefs, unavailable } from '../../lib/api.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Chip from '../../components/Chip.svelte';
  import Slider from '../../components/Slider.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import SpotifyTrackRow from './SpotifyTrackRow.svelte';
  import SpotifyTile from './SpotifyTile.svelte';
  import SpotifySheet from './SpotifySheet.svelte';
  import SpotifyQueueSheet from './SpotifyQueueSheet.svelte';
  import { findSpotify, spotifyAccounts, onStereoDevice, sp, spQuiet, mmss, httpImage, SPOTIFY_GREEN } from './spotify.js';

  /** @typedef {import('./spotify.js').SpItem} SpItem */

  const s = $derived(findSpotify($states, $prefs?.spotifyEntity));
  const accounts = $derived(spotifyAccounts($states));
  const a = $derived(s?.attributes ?? {});
  const na = $derived(!s || unavailable(s));
  const playing = $derived(s?.state === 'playing');
  const device = $derived(/** @type {string|undefined} */ (a.sp_device_name));
  const onStereo = $derived(onStereoDevice(device));
  const nowUri = $derived(String(a.media_content_id ?? ''));
  const art = $derived(httpImage(a.sp_nowplaying_image_url) ?? (a.entity_picture ? String(a.entity_picture) : null));
  const title = $derived(a.media_title ? String(a.media_title) : '');
  const artist = $derived(String(a.media_artist ?? a.media_album_name ?? ''));
  const repeat = $derived(/** @type {'off'|'all'|'one'} */ (a.repeat ?? 'off'));

  // ---- Progress (interpolated between state updates) ----
  let now = $state(Date.now());
  $effect(() => {
    if (!playing) return;
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });
  const duration = $derived(Number(a.media_duration) || 0);
  const position = $derived.by(() => {
    const p = Number(a.media_position) || 0;
    const at = a.media_position_updated_at ? Date.parse(a.media_position_updated_at) : NaN;
    const live = playing && Number.isFinite(at) ? p + (now - at) / 1000 : p;
    return Math.min(duration || live, Math.max(0, live));
  });
  let seeking = $state(/** @type {number|null} */ (null));
  const shownPos = $derived(seeking ?? position);

  // ---- Commands ----
  let busy = $state('');
  async function run(/** @type {string} */ key, /** @type {() => Promise<any>} */ fn) {
    busy = key;
    try {
      await fn();
    } catch {
    } finally {
      busy = '';
    }
  }
  const ctl = (/** @type {string} */ cmd, /** @type {any} */ value = undefined, /** @type {string|undefined} */ ok = undefined) =>
    run(cmd, () => sp('control', { cmd, value }, ok));

  const togglePlay = () => ctl(playing && onStereo ? 'pause' : 'play');
  const NEXT_REPEAT = { off: 'all', all: 'one', one: 'off' };
  const REPEAT_ICON = { off: mdiRepeatOff, all: mdiRepeat, one: mdiRepeatOnce };

  async function commitSeek() {
    const v = seeking;
    if (v === null) return;
    try {
      await sp('control', { cmd: 'seek', value: Math.round(v) });
    } catch {
    } finally {
      // keep showing the target until the next state update
      setTimeout(() => (seeking = null), 800);
    }
  }

  // ---- Liked state of the current track ----
  let liked = $state(false);
  const trackId = $derived(nowUri.startsWith('spotify:track:') ? nowUri.split(':')[2] : '');
  $effect(() => {
    const id = trackId;
    liked = false;
    if (!id) return;
    let stale = false;
    spQuiet('isLiked', { id }).then((v) => !stale && (liked = !!v), () => {});
    return () => (stale = true);
  });
  async function toggleLike() {
    if (!trackId) return;
    const next = !liked;
    liked = next;
    try {
      await sp('setLiked', { id: trackId, liked: next }, next ? 'Toegevoegd aan Liked Songs' : 'Verwijderd uit Liked Songs');
    } catch {
      liked = !next;
    }
  }

  // ---- Library ----
  const KINDS = [
    { value: 'playlists', label: 'Afspeellijsten' },
    { value: 'tracks', label: 'Liked Songs' },
    { value: 'albums', label: 'Albums' },
    { value: 'artists', label: 'Artiesten' },
    { value: 'recent', label: 'Recent' },
    { value: 'shows', label: 'Podcasts' },
  ];
  let kind = $state('playlists');
  /** @type {Record<string, SpItem[]|undefined>} */
  let lib = $state({});
  /** @type {Record<string, string>} */
  let libErr = $state({});
  let limit = $state(24);

  async function loadLib(/** @type {string} */ k, force = false) {
    if (!force && lib[k]) return;
    libErr[k] = '';
    if (force) lib[k] = undefined;
    try {
      lib[k] = await spQuiet('library', { kind: k });
    } catch (e) {
      libErr[k] = e instanceof Error ? e.message : 'Laden mislukt';
    }
  }
  $effect(() => {
    if (!na) loadLib(kind);
  });
  function pickKind(/** @type {string} */ k) {
    kind = k;
    limit = 24;
  }
  const items = $derived(lib[kind]);
  const isTrackList = $derived(kind === 'tracks' || kind === 'recent');

  // ---- Search ----
  let query = $state('');
  /** @type {{tracks:SpItem[],artists:SpItem[],albums:SpItem[],playlists:SpItem[]}|null} */
  let results = $state(null);
  let searching = $state(false);
  let searchErr = $state('');
  $effect(() => {
    const q = query.trim();
    if (!q) {
      results = null;
      searching = false;
      return;
    }
    searching = true;
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const r = await spQuiet('search', { query: q });
        if (!stale) (results = r), (searchErr = '');
      } catch (e) {
        if (!stale) searchErr = e instanceof Error ? e.message : 'Zoeken mislukt';
      } finally {
        if (!stale) searching = false;
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  });

  // ---- Playing items ----
  const playTracks = (/** @type {SpItem[]} */ list, /** @type {number} */ i) => {
    const t = list[i];
    run(t.uri, () => (t.type === 'episode' ? sp('play', { uri: t.uri }) : sp('play', { uris: list.slice(i, i + 100).map((x) => x.uri) })));
  };
  const playSingle = (/** @type {SpItem} */ t) => run(t.uri, () => sp('play', { uri: t.uri }));
  const playLiked = (/** @type {boolean} */ shuffle) => run(shuffle ? 'liked:shuffle' : 'liked', () => sp('play', { liked: true, shuffle }, 'Liked Songs wordt afgespeeld'));
  const queue = (/** @type {SpItem} */ t) => sp('addToQueue', { uri: t.uri }, `${t.name} staat in de wachtrij`).catch(() => {});

  let detail = $state(/** @type {SpItem|null} */ (null));
  let detailOpen = $state(false);
  const openItem = (/** @type {SpItem} */ it) => {
    detail = it;
    detailOpen = true;
  };
  let queueOpen = $state(false);
</script>

<Card pad={false} glow={playing && onStereo} accent={playing && onStereo ? SPOTIFY_GREEN : ''}>
  {#if !s}
    <div class="pad">
      <EmptyState iconPath={mdiSpotify} title="SpotifyPlus niet gevonden">
        <span class="small muted">Installeer de SpotifyPlus-integratie (HACS) en log in met je Spotify-account. Zie de documentatie van het dashboard.</span>
      </EmptyState>
    </div>
  {:else}
    <div class="player" style="--sp:{SPOTIFY_GREEN}">
      {#if art}<div class="bg" style="background-image:url('{art}')" transition:fade></div>{/if}
      <div class="top row">
        <span class="logo"><Icon path={mdiSpotify} size={22} /></span>
        <span class="grow small dev ellipsis">
          {#if na}Spotify niet beschikbaar
          {:else if device}<Icon path={mdiSpeaker} size={16} /> Speelt op <b>{device}</b>
          {:else}Geen actief apparaat{/if}
        </span>
        {#if accounts.length > 1}
          <select class="acct" aria-label="Spotify-account" value={s?.entity_id} onchange={(e) => savePrefs({ spotifyEntity: e.currentTarget.value }).catch(() => {})}>
            {#each accounts as acc (acc.id)}<option value={acc.id}>{acc.name}</option>{/each}
          </select>
        {/if}
        {#if !na && !onStereo}
          <button class="btn sm sp" disabled={!!busy} onclick={() => ctl('transfer', undefined, `Spotify speelt nu op ${MEDIA.spotify.device}`)}>
            {#if busy === 'transfer'}<span class="spinner"></span>{/if}Naar {MEDIA.spotify.device.toLowerCase()}
          </button>
        {/if}
      </div>

      <div class="now">
        {#key art}
          <span class="art" in:fly={{ y: 8, duration: 300 }}>
            {#if art}<img src={art} alt="" />{:else}<Icon path={mdiSpotify} size={44} />{/if}
          </span>
        {/key}
        <div class="meta grow">
          <b class="title ellipsis">{title || (na ? 'Niet beschikbaar' : 'Niets aan het spelen')}</b>
          <span class="small muted ellipsis">{artist || (a.sp_playlist_name ?? '')}</span>
          {#if a.sp_playlist_name && artist}<span class="tiny faint ctx"><Icon path={mdiPlaylistMusic} size={13} /><span class="ellipsis">{a.sp_playlist_name}</span></span>{/if}
        </div>
        {#if trackId}
          <button class="btn icon ghost heart" class:on={liked} aria-label={liked ? 'Uit Liked Songs' : 'Toevoegen aan Liked Songs'} onclick={toggleLike}>
            <Icon path={liked ? mdiHeart : mdiHeartOutline} size={24} />
          </button>
        {/if}
      </div>

      {#if duration > 0}
        <div class="progress">
          <input
            type="range"
            min="0"
            max={duration}
            step="1"
            value={shownPos}
            style="--p:{(shownPos / duration) * 100}%"
            aria-label="Positie"
            disabled={na}
            oninput={(e) => (seeking = Number(e.currentTarget.value))}
            onchange={commitSeek}
          />
          <div class="row spread tiny muted num"><span>{mmss(shownPos)}</span><span>-{mmss(duration - shownPos)}</span></div>
        </div>
      {/if}

      <div class="controls">
        <button class="btn icon ghost" class:on={a.shuffle} aria-label="Shuffle" disabled={na} onclick={() => ctl('shuffle', !a.shuffle)}>
          <Icon path={mdiShuffleVariant} size={22} />
        </button>
        <button class="btn icon ghost" aria-label="Vorige" disabled={na} onclick={() => ctl('previous')}><Icon path={mdiSkipPrevious} size={30} /></button>
        <button class="pp" aria-label={playing && onStereo ? 'Pauze' : 'Afspelen'} disabled={na || busy === 'play' || busy === 'pause'} onclick={togglePlay}>
          {#if busy === 'play' || busy === 'pause'}<span class="spinner big"></span>
          {:else if playing && onStereo}<Icon path={mdiPause} size={34} />
          {:else}<Icon path={mdiPlay} size={34} />{/if}
        </button>
        <button class="btn icon ghost" aria-label="Volgende" disabled={na} onclick={() => ctl('next')}><Icon path={mdiSkipNext} size={30} /></button>
        <button class="btn icon ghost" class:on={repeat !== 'off'} aria-label="Herhalen" disabled={na} onclick={() => ctl('repeat', NEXT_REPEAT[repeat])}>
          <Icon path={REPEAT_ICON[repeat] ?? mdiRepeat} size={22} />
        </button>
      </div>

      <div class="row vol">
        <span class="grow">
          <Slider
            value={Math.round((Number(a.volume_level) || 0) * 100)}
            min={0}
            max={100}
            step={1}
            label="Spotify-volume"
            format={(/** @type {number} */ v) => `${v}%`}
            color={SPOTIFY_GREEN}
            onchange={(/** @type {number} */ v) => sp('control', { cmd: 'volume', value: v / 100 }).catch(() => {})}
          />
        </span>
        <button class="btn soft sm" disabled={na} onclick={() => (queueOpen = true)}><Icon path={mdiPlaylistMusic} size={18} />Wachtrij</button>
      </div>
    </div>

    <div class="browse">
      <label class="search">
        <Icon path={mdiMagnify} size={20} />
        <input class="grow" type="search" placeholder="Zoek nummers, artiesten, albums…" bind:value={query} disabled={na} />
        {#if query}<button class="btn icon ghost sm" aria-label="Wissen" onclick={() => (query = '')}><Icon path={mdiClose} size={18} /></button>{/if}
      </label>

      {#if query.trim()}
        {#if searching && !results}
          {#each [0, 1, 2, 3] as i (i)}<div class="skeleton" style="height:52px;border-radius:12px"></div>{/each}
        {:else if searchErr && !results}
          <EmptyState iconPath={mdiMusicNoteOff} title="Zoeken mislukt" text={searchErr} />
        {:else if results}
          {@const r = results}
          {#if !r.tracks.length && !r.artists.length && !r.albums.length && !r.playlists.length}
            <EmptyState iconPath={mdiMagnify} text="Niets gevonden" />
          {/if}
          {#if r.tracks.length}
            <h4>Nummers</h4>
            <div class="list">
              {#each r.tracks.slice(0, 6) as t, i (t.uri + i)}
                <SpotifyTrackRow item={t} active={t.uri === nowUri} busy={busy === t.uri} onplay={() => playSingle(t)} onqueue={() => queue(t)} />
              {/each}
            </div>
          {/if}
          {#each [{ k: 'artists', label: 'Artiesten' }, { k: 'albums', label: 'Albums' }, { k: 'playlists', label: 'Afspeellijsten' }] as sect (sect.k)}
            {@const list = r[/** @type {'artists'|'albums'|'playlists'} */ (sect.k)]}
            {#if list.length}
              <h4>{sect.label}</h4>
              <div class="hscroll no-swipe">
                {#each list as it, i (it.uri)}<div class="hs"><SpotifyTile item={it} delay={i * 20} onclick={() => openItem(it)} /></div>{/each}
              </div>
            {/if}
          {/each}
        {/if}
      {:else}
        <div class="row chips no-swipe">
          {#each KINDS as k (k.value)}<Chip label={k.label} active={kind === k.value} onclick={() => pickKind(k.value)} />{/each}
        </div>

        {#if libErr[kind]}
          <EmptyState iconPath={mdiMusicNoteOff} title="Laden mislukt" text={libErr[kind]}>
            <button class="btn soft sm" onclick={() => loadLib(kind, true)}>Opnieuw</button>
          </EmptyState>
        {:else if !items}
          <div class="tiles">{#each Array(8) as _, i (i)}<div class="skeleton" style="aspect-ratio:1;border-radius:12px"></div>{/each}</div>
        {:else if !items.length}
          <EmptyState iconPath={kind === 'artists' ? mdiAccountMusic : mdiMusicNoteOff} text="Niets gevonden in je bibliotheek" />
        {:else if isTrackList}
          {#if kind === 'tracks'}
            <div class="row likedbar">
              <button class="btn primary sp" disabled={!!busy} onclick={() => playLiked(false)}>
                {#if busy === 'liked'}<span class="spinner"></span>{:else}<Icon path={mdiPlay} size={20} />{/if}Afspelen
              </button>
              <button class="btn soft" disabled={!!busy} onclick={() => playLiked(true)}>
                {#if busy === 'liked:shuffle'}<span class="spinner dark"></span>{:else}<Icon path={mdiShuffleVariant} size={20} />{/if}Shuffle
              </button>
            </div>
          {/if}
          <div class="list" in:fade={{ duration: 200 }}>
            {#each items.slice(0, limit) as t, i (t.uri + i)}
              <SpotifyTrackRow item={t} active={t.uri === nowUri} busy={busy === t.uri} onplay={() => playTracks(items, i)} onqueue={() => queue(t)} />
            {/each}
          </div>
        {:else}
          <div class="tiles" in:fade={{ duration: 200 }}>
            {#each items.slice(0, limit) as it, i (it.uri)}
              <SpotifyTile item={it} active={a.sp_context_uri === it.uri} delay={Math.min(i, 12) * 20} onclick={() => openItem(it)} />
            {/each}
          </div>
        {/if}
        {#if items && items.length > limit}
          <button class="btn soft block" onclick={() => (limit += 24)}>Meer tonen</button>
        {/if}
      {/if}
    </div>
  {/if}
</Card>

<SpotifySheet bind:open={detailOpen} item={detail} {nowUri} />
<SpotifyQueueSheet bind:open={queueOpen} {nowUri} />

<style>
  .pad { padding: 16px; }
  .player { position: relative; overflow: hidden; padding: 14px 16px 12px; display: flex; flex-direction: column; gap: 12px; border-radius: inherit; }
  .bg { position: absolute; inset: -40px; background-size: cover; background-position: center; filter: blur(40px) saturate(1.4); opacity: 0.28; pointer-events: none; }
  .player > :not(.bg) { position: relative; }
  .top { gap: 8px; }
  .logo { color: var(--sp); display: grid; }
  .dev { display: flex; align-items: center; gap: 4px; color: var(--text-2); }
  .acct { max-width: 40%; padding: 4px 8px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
  .sp { background: var(--sp, #1db954); color: #fff; border: 0; gap: 6px; box-shadow: 0 8px 20px -10px #1db954; }
  .now { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .art { width: 88px; height: 88px; flex-shrink: 0; border-radius: 12px; overflow: hidden; display: grid; place-items: center; background: var(--surface-3); color: var(--sp); box-shadow: 0 14px 30px -14px rgba(0, 0, 0, 0.7); }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .title { font-size: 1.1rem; }
  .ctx { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .heart { color: var(--text-3); }
  .heart.on, .controls .on { color: var(--sp); }
  .progress input { width: 100%; height: 6px; margin: 4px 0; appearance: none; -webkit-appearance: none; border-radius: 3px; cursor: pointer;
    background: linear-gradient(to right, var(--sp) var(--p), var(--surface-3) var(--p)); }
  .progress input::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); }
  .progress input::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: #fff; }
  .controls { display: flex; align-items: center; justify-content: space-evenly; }
  .pp { width: 64px; height: 64px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; color: #000; background: #fff;
    box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.6); transition: transform 0.25s var(--spring); }
  .pp:active { transform: scale(0.9); }
  .pp:disabled { opacity: 0.6; }
  .vol { gap: 10px; align-items: center; }
  .vol .btn { gap: 6px; }

  .browse { padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border); padding-top: 14px; }
  .search { display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 12px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-3); }
  .search input { border: 0; background: none; outline: none; color: var(--text); font: inherit; min-height: 36px; min-width: 0; }
  .search input::-webkit-search-cancel-button { display: none; }
  .chips { gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  h4 { font-size: 0.95rem; margin: 4px 0 -4px; }
  .list { display: flex; flex-direction: column; gap: 2px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 4px; }
  .hscroll { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; margin: 0 -6px; }
  .hscroll::-webkit-scrollbar { display: none; }
  .hs { width: 128px; flex-shrink: 0; }
  .likedbar { gap: 8px; }
  .likedbar .btn { gap: 6px; }
  .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.35); border-top-color: #fff; animation: spin 0.8s linear infinite; }
  .spinner.big { width: 26px; height: 26px; border-width: 3px; border-color: rgba(0, 0, 0, 0.2); border-top-color: #000; }
  .spinner.dark { border-color: color-mix(in srgb, currentColor 30%, transparent); border-top-color: currentColor; }
</style>

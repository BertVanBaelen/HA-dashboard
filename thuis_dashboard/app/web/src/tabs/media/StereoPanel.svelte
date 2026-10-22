<script>
  import { slide, scale } from 'svelte/transition';
  import { mdiPlay, mdiPause, mdiSpotify, mdiAlbum, mdiRecordPlayer, mdiRadioTower, mdiTune, mdiPower, mdiSwapHorizontal, mdiAudioInputRca, mdiSleep, mdiPlaylistMusic } from '@mdi/js';
  import { MEDIA } from '$shared/config.js';
  import { states, household, callService, action, unavailable, isOn } from '../../lib/api.js';
  import { colorFor } from '../../lib/colors.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Tile from '../../components/Tile.svelte';
  import Chip from '../../components/Chip.svelte';
  import NowPlaying from './NowPlaying.svelte';
  import VolumeControl from './VolumeControl.svelte';
  import RadioSheet from './RadioSheet.svelte';

  const SOURCE_ICONS = { spotify: mdiSpotify, cd: mdiAlbum, line1: mdiRecordPlayer };
  const SOURCE_COLORS = { spotify: '#1DB954', cd: '#8b5cf6', line1: '#f59e0b' };
  const RADIO_COLORS = { vrtnws: '#f5b301', stubru: '#ff6a13', mnm: '#e5007d', radio1: '#2a6fdb', radio2: '#e30613' };

  const stereo = $derived($states[MEDIA.stereo]);
  const na = $derived(unavailable(stereo));
  const a = $derived(stereo?.attributes ?? {});
  const playing = $derived(stereo?.state === 'playing' || stereo?.state === 'buffering');
  const sourceList = $derived(/** @type {string[]} */ (a.source_list ?? []));
  const radios = $derived(/** @type {{id:string,name:string,mediaId:string}[]} */ ($household?.radios ?? []));

  const matchSource = (/** @type {typeof MEDIA.stereoSources[number]} */ src, /** @type {string} */ name) =>
    src.match.some((m) => name.toLowerCase().replace(/\s+/g, ' ') === m || name.toLowerCase().includes(m));
  const sources = $derived(
    MEDIA.stereoSources.map((src) => ({
      ...src,
      available: !sourceList.length || sourceList.some((n) => matchSource(src, n)),
      current: !!a.source && matchSource(src, String(a.source)),
    })),
  );

  let lastRadio = $state(/** @type {string|null} */ (null));
  let busy = $state(/** @type {string|null} */ (null));
  let advanced = $state(false);
  let sheetOpen = $state(false);

  // MusicCast reports the station name in title/artist/album while Net Radio plays
  const currentRadioId = $derived.by(() => {
    const fields = [a.media_title, a.media_artist, a.media_album_name].map((v) => String(v ?? '').trim().toLowerCase()).filter(Boolean);
    const hit = radios.find((r) => fields.includes(r.name.trim().toLowerCase()));
    if (hit) return hit.mediaId;
    return playing ? lastRadio : null;
  });
  const radioName = $derived(radios.find((r) => r.mediaId === currentRadioId)?.name ?? '');

  async function run(/** @type {string} */ key, /** @type {() => Promise<any>} */ fn) {
    busy = key;
    try {
      await fn();
    } catch {
    } finally {
      busy = null;
    }
  }

  const playRadio = (/** @type {{name:string,mediaId:string}} */ r) =>
    run(`radio:${r.mediaId}`, async () => {
      await action('playRadio', { mediaId: r.mediaId }, `${r.name} wordt afgespeeld`);
      lastRadio = r.mediaId;
      sheetOpen = false;
    });

  const selectSource = (/** @type {{key:string,label:string}} */ src) =>
    run(`src:${src.key}`, async () => {
      await action('selectStereoSource', { key: src.key }, `Bron: ${src.label}`);
      lastRadio = null;
    });

  const scene = (/** @type {string} */ id) => callService('scene', 'turn_on', {}, id).catch(() => {});

  const soundbarState = $derived($states[MEDIA.soundbarOn]);
  const sleep = $derived($states[MEDIA.stereoSleepTimer]);
  const sleepOptions = $derived(/** @type {string[]} */ (sleep?.attributes?.options ?? []));
  const sleepLabel = (/** @type {string} */ o) => (/^(off|uit|0)$/i.test(o) ? 'Uit' : /^\d+$/.test(o) ? `${o} min` : o);
  const has = (/** @type {string} */ id) => !!$states[id];
  const offOption = $derived(sleepOptions.find((o) => /^(off|uit|0)$/i.test(o)));
  const sleepActive = $derived(!!sleep && !unavailable(sleep) && !/^(off|uit|0)$/i.test(sleep.state));
</script>

<div class="grid">
  <Card pad={false} glow={playing} accent={playing ? 'var(--accent)' : ''}>
    <NowPlaying s={stereo} kind="stereo" fallbackTitle={radioName || (a.source ? String(a.source) : '')}>
      <div class="playrow">
        <button
          class="pp"
          class:playing
          aria-label={playing ? 'Pauze' : 'Afspelen'}
          disabled={na}
          onclick={() => callService('media_player', 'media_play_pause', {}, MEDIA.stereo).catch(() => {})}
        >
          {#if playing}
            <span in:scale={{ start: 0.4, duration: 260 }}><Icon path={mdiPause} size={36} /></span>
          {:else}
            <span in:scale={{ start: 0.4, duration: 260 }}><Icon path={mdiPlay} size={36} /></span>
          {/if}
        </button>
      </div>
    </NowPlaying>
    {#if sleepActive}
      <div class="sleepwarn">
        <Icon path={mdiSleep} size={18} />
        <span class="grow small">Sleep timer staat aan: <b>{sleepLabel(sleep.state)}</b> – de stereo schakelt dan vanzelf uit</span>
        {#if offOption}
          <button class="btn soft" onclick={() => callService('select', 'select_option', { option: offOption }, MEDIA.stereoSleepTimer, 'Sleep timer uit').catch(() => {})}>Uitzetten</button>
        {/if}
      </div>
    {/if}
    <div class="volwrap">
      <VolumeControl
        label="Soundbar (IR)"
        interval={450}
        disabled={!has(MEDIA.soundbarVolumeUp)}
        ondown={() => scene(MEDIA.soundbarVolumeDown)}
        onup={() => scene(MEDIA.soundbarVolumeUp)}
        onmute={() => scene(MEDIA.soundbarMute)}
      />
    </div>
  </Card>

  <Card title="Bronnen" iconPath={mdiPlaylistMusic} subtitle={na ? 'Niet beschikbaar' : a.source ? `Huidige bron: ${a.source}` : ''}>
    <div class="grid-3 sources">
      {#each sources as src (src.key)}
        <Tile
          label={src.label}
          sub={src.available ? (src.current ? 'Actief' : '') : 'Niet gevonden'}
          iconPath={SOURCE_ICONS[/** @type {keyof typeof SOURCE_ICONS} */ (src.key)] ?? mdiAudioInputRca}
          color={SOURCE_COLORS[/** @type {keyof typeof SOURCE_COLORS} */ (src.key)] ?? ''}
          active={src.current && !currentRadioId}
          busy={busy === `src:${src.key}`}
          disabled={na || !src.available}
          onclick={() => selectSource(src)}
        />
      {/each}
    </div>
  </Card>

  <Card title="Radio" icon="radio" subtitle={radioName ? `Nu: ${radioName}` : 'Net Radio'}>
    {#if radios.length}
      <div class="radios">
        {#each radios as r, i (r.id)}
          {@const on = currentRadioId === r.mediaId}
          <button
            class="radio"
            class:on
            class:busy={busy === `radio:${r.mediaId}`}
            style="--rc:{RADIO_COLORS[/** @type {keyof typeof RADIO_COLORS} */ (r.id)] ?? colorFor(r.id)};--d:{i * 50}ms"
            disabled={na}
            onclick={() => playRadio(r)}
          >
            <span class="badge">
              {#if busy === `radio:${r.mediaId}`}<span class="spinner"></span>
              {:else if on}<span class="eq"><i></i><i></i><i></i></span>
              {:else}{r.name.replace(/^(Radio|Studio)\s+/i, '').slice(0, 3).toUpperCase()}{/if}
            </span>
            <span class="rname ellipsis">{r.name}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="muted small">Nog geen radiozenders. Open “Andere radio”, blader door Net Radio van de stereo en tik op de ster om favorieten toe te voegen.</p>
    {/if}
    <button class="btn soft block other" disabled={na} onclick={() => (sheetOpen = true)}>
      <Icon path={mdiRadioTower} size={20} />Andere radio
    </button>
  </Card>

  <Card pad={false}>
    <button class="advhead" class:open={advanced} onclick={() => (advanced = !advanced)}>
      <span class="advic"><Icon path={mdiTune} size={20} /></span>
      <span class="grow">
        <b>Geavanceerd</b>
        <span class="small muted">Soundbar & sleep timer</span>
      </span>
      <Icon name="chevronDown" class="chev" />
    </button>
    {#if advanced}
      <div class="adv" transition:slide={{ duration: 320 }}>
        <div class="grid-3">
          <Tile
            label="Soundbar"
            sub={soundbarState ? (isOn(soundbarState) ? 'Aan' : 'Uit') : 'Aan/uit'}
            iconPath={mdiPower}
            color="#22c55e"
            active={isOn(soundbarState)}
            busy={busy === 'sb:power'}
            disabled={!has(MEDIA.soundbarPower)}
            onclick={() => run('sb:power', () => callService('scene', 'turn_on', {}, MEDIA.soundbarPower))}
          />
          <Tile
            label="Ingang"
            sub="Wisselen"
            iconPath={mdiSwapHorizontal}
            busy={busy === 'sb:input'}
            disabled={!has(MEDIA.soundbarInput)}
            onclick={() => run('sb:input', () => callService('scene', 'turn_on', {}, MEDIA.soundbarInput, 'Soundbar-ingang gewisseld'))}
          />
          <Tile
            label="AUX"
            sub="Soundbar"
            iconPath={mdiAudioInputRca}
            busy={busy === 'sb:aux'}
            disabled={!has(MEDIA.soundbarAux)}
            onclick={() => run('sb:aux', () => callService('script', 'turn_on', {}, MEDIA.soundbarAux, 'Soundbar op AUX'))}
          />
        </div>
        <div class="sleep">
          <div class="row small"><Icon path={mdiSleep} size={18} /><b>Sleep timer</b>
            {#if sleep && !unavailable(sleep)}<span class="muted">· {sleepLabel(sleep.state)}</span>{/if}
          </div>
          {#if !sleep || unavailable(sleep) || !sleepOptions.length}
            <span class="small muted">Niet beschikbaar</span>
          {:else}
            <div class="wrap row chips no-swipe">
              {#each sleepOptions as o (o)}
                <Chip
                  label={sleepLabel(o)}
                  active={sleep.state === o}
                  onclick={() => callService('select', 'select_option', { option: o }, MEDIA.stereoSleepTimer, `Sleep timer: ${sleepLabel(o)}`).catch(() => {})}
                />
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </Card>
</div>

<RadioSheet bind:open={sheetOpen} currentId={currentRadioId} onplay={playRadio} />

<style>
  .playrow { display: flex; justify-content: center; }
  .sleepwarn { display: flex; align-items: center; gap: 10px; margin: 0 14px 10px; padding: 8px 8px 8px 12px; border-radius: 14px; background: color-mix(in srgb, var(--warning, #f59e0b) 14%, var(--surface-2)); color: var(--text); }
  .pp {
    width: 76px; height: 76px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; color: #fff;
    background: var(--gradient); box-shadow: 0 14px 30px -12px var(--accent);
    transition: transform 0.25s var(--spring), box-shadow 0.3s;
  }
  .pp:active { transform: scale(0.9); }
  .pp:disabled { opacity: 0.5; }
  .pp.playing { --pulse: var(--accent); }
  .volwrap { padding: 0 16px 16px; }
  .sources { gap: 10px; }

  .radios { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .radio {
    display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 6px; min-width: 0; border-radius: 18px; cursor: pointer;
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-weight: 600;
    animation: pop 0.45s var(--spring) var(--d) both;
    transition: transform 0.25s var(--spring), border-color 0.3s, box-shadow 0.3s, background 0.3s;
  }
  .radio:hover { transform: translateY(-3px); }
  .radio:active { transform: scale(0.93); }
  .radio:disabled { opacity: 0.5; }
  .radio.on { background: color-mix(in srgb, var(--rc) 14%, var(--surface-2)); border-color: color-mix(in srgb, var(--rc) 55%, transparent); box-shadow: 0 10px 26px -14px var(--rc); }
  .badge {
    width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 0.85rem; letter-spacing: 0.02em; color: #fff;
    background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--rc) 70%, #fff), var(--rc) 60%, color-mix(in srgb, var(--rc) 70%, #000));
    box-shadow: 0 8px 18px -8px var(--rc);
  }
  .radio.on .badge { --pulse: var(--rc); }
  .rname { font-size: 0.8rem; max-width: 100%; }
  .eq { display: flex; align-items: flex-end; gap: 3px; height: 20px; }
  .eq i { width: 4px; border-radius: 2px; background: #fff; animation: eq 0.8s ease-in-out infinite alternate; }
  .eq i:nth-child(2) { animation-delay: -0.35s; }
  .eq i:nth-child(3) { animation-delay: -0.6s; }
  @keyframes eq { from { height: 25%; } to { height: 100%; } }
  .spinner { width: 22px; height: 22px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.35); border-top-color: #fff; animation: spin 0.8s linear infinite; }
  .other { margin-top: 12px; gap: 8px; min-height: 48px; }

  .advhead { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 0; background: none; color: var(--text); text-align: left; cursor: pointer; }
  .advhead span.grow { display: flex; flex-direction: column; }
  .advic { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
  .advhead :global(.chev) { transition: transform 0.35s var(--spring); color: var(--text-3); }
  .advhead.open :global(.chev) { transform: rotate(180deg); }
  .adv { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 14px; }
  .sleep { display: flex; flex-direction: column; gap: 8px; }
  .chips { gap: 6px; }
</style>

<script>
  import { mdiPlay, mdiPause, mdiVolumeHigh, mdiVolumeOff } from '@mdi/js';
  import { MEDIA, tvIsOn, stereoIsOn } from '$shared/config.js';
  import { states, callService, action, unavailable } from '../../lib/api.js';
  import Icon from '../../components/Icon.svelte';
  import Slider from '../../components/Slider.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import VolumeControl from '../media/VolumeControl.svelte';
  import DeviceRow from './DeviceRow.svelte';
  import { planIcon } from './icons.js';

  /** @type {{ items: {kind:string,label:string}[] }} */
  let { items } = $props();

  const COLORS = { tv: '#6366f1', stereo: '#ec4899', soundbar: '#14b8a6' };
  const PLAYING = ['playing', 'buffering'];

  const get = (/** @type {string} */ id) => $states[id];
  const tvOn = $derived(tvIsOn(get));
  const stereoOn = $derived(stereoIsOn(get));
  const cast = $derived($states[MEDIA.chromecast]);
  const stereo = $derived($states[MEDIA.stereo]);
  const soundbar = $derived($states[MEDIA.soundbarOn]);
  const soundbarOn = $derived(soundbar?.state === 'on');
  const has = (/** @type {string} */ id) => !!$states[id];

  let busy = $state(/** @type {string|null} */ (null));

  const castPlaying = $derived(PLAYING.includes(cast?.state));
  const stereoPlaying = $derived(PLAYING.includes(stereo?.state));
  const volume = $derived(Math.round((Number(stereo?.attributes?.volume_level) || 0) * 100));
  const muted = $derived(!!stereo?.attributes?.is_volume_muted);

  const tvSub = $derived.by(() => {
    if (!tvOn) return 'Uit';
    const ca = cast?.attributes ?? {};
    const what = [ca.app_name, ca.media_title].filter(Boolean).join(' · ');
    return `${castPlaying ? 'Speelt' : cast?.state === 'paused' ? 'Gepauzeerd' : 'Aan'}${what ? ` · ${what}` : ''}`;
  });
  const stereoSub = $derived.by(() => {
    if (!stereoOn) return unavailable(stereo) ? 'Niet bereikbaar' : 'Uit';
    const sa = stereo?.attributes ?? {};
    const what = [sa.source, sa.media_title].filter(Boolean).join(' · ');
    return `${stereoPlaying ? 'Speelt' : stereo?.state === 'paused' ? 'Gepauzeerd' : 'Aan'}${what ? ` · ${what}` : ''}`;
  });

  async function power(/** @type {'tv'|'stereo'} */ kind, /** @type {boolean} */ v) {
    if (busy) return;
    busy = kind;
    const label = kind === 'tv' ? 'TV' : 'Stereo';
    try {
      if (v) await action('mediaMode', { mode: kind }, `${label} staat aan`);
      else if (kind === 'tv' ? stereoOn : tvOn)
        await callService('script', 'turn_on', {}, kind === 'tv' ? MEDIA.scripts.tvOff : MEDIA.scripts.stereoOff, `${label} wordt uitgeschakeld`);
      else await action('mediaMode', { mode: 'uit' }, `${label} uitgeschakeld`);
    } catch {
    } finally {
      busy = null;
    }
  }

  const tvPlayPause = () => callService('remote', 'send_command', { command: MEDIA.castKeys.playPause }, MEDIA.chromecastRemote).catch(() => {});
  const tvKey = (/** @type {string} */ command) => callService('remote', 'send_command', { command }, MEDIA.tvRemote).catch(() => {});
  const script = (/** @type {string|null} */ id) => (id ? callService('script', 'turn_on', {}, id).catch(() => {}) : undefined);
</script>

{#snippet tvBelow()}
  <div class="row">
    <button class="btn soft grow" onclick={tvPlayPause}>
      <Icon path={castPlaying ? mdiPause : mdiPlay} size={20} />{castPlaying ? 'Pauzeren' : 'Afspelen'}
    </button>
  </div>
  <VolumeControl label="Volume TV" disabled={!has(MEDIA.tvRemote)} ondown={() => tvKey('VolumeDown')} onup={() => tvKey('VolumeUp')} onmute={() => tvKey('Mute')} />
{/snippet}

{#snippet stereoBelow()}
  <div class="row">
    <button class="btn soft grow" onclick={() => callService('media_player', 'media_play_pause', {}, MEDIA.stereo).catch(() => {})}>
      <Icon path={stereoPlaying ? mdiPause : mdiPlay} size={20} />{stereoPlaying ? 'Pauzeren' : 'Afspelen'}
    </button>
    <button
      class="btn icon"
      class:soft={muted}
      aria-label={muted ? 'Geluid aan' : 'Dempen'}
      onclick={() => callService('media_player', 'volume_mute', { is_volume_muted: !muted }, MEDIA.stereo).catch(() => {})}
    >
      <Icon path={muted ? mdiVolumeOff : mdiVolumeHigh} size={20} />
    </button>
  </div>
  <Slider
    label="Volume"
    value={volume}
    min={0}
    max={100}
    color={COLORS.stereo}
    format={(v) => `${v}%`}
    onchange={(v) => callService('media_player', 'volume_set', { volume_level: v / 100 }, MEDIA.stereo).catch(() => {})}
  />
{/snippet}

{#snippet soundbarBelow()}
  <VolumeControl
    label="Soundbar (IR)"
    disabled={!has(MEDIA.soundbarVolumeUp)}
    ondown={() => script(MEDIA.soundbarVolumeDown)}
    onup={() => script(MEDIA.soundbarVolumeUp)}
    onmute={() => script(MEDIA.soundbarMute)}
  />
{/snippet}

{#each items as m (m.kind)}
  {#if m.kind === 'tv'}
    <DeviceRow iconPath={planIcon('tv')} label={m.label} sub={busy === 'tv' ? 'Bezig…' : tvSub} active={tvOn} color={COLORS.tv} below={tvOn ? tvBelow : undefined}>
      {#if busy === 'tv'}<span class="spinner"></span>{/if}
      <Toggle checked={tvOn} disabled={!!busy} label={m.label} color={COLORS.tv} onchange={(v) => power('tv', v)} />
    </DeviceRow>
  {:else if m.kind === 'stereo'}
    <DeviceRow
      iconPath={planIcon('stereo')}
      label={m.label}
      sub={busy === 'stereo' ? 'Bezig…' : stereoSub}
      active={stereoOn}
      color={COLORS.stereo}
      below={stereoOn ? stereoBelow : undefined}
    >
      {#if busy === 'stereo'}<span class="spinner"></span>{/if}
      <Toggle checked={stereoOn} disabled={!!busy} label={m.label} color={COLORS.stereo} onchange={(v) => power('stereo', v)} />
    </DeviceRow>
  {:else if m.kind === 'soundbar'}
    <DeviceRow
      iconPath={planIcon('soundbar')}
      label={m.label}
      sub={soundbar ? (soundbarOn ? 'Aan' : 'Uit') : 'Aan/uit via IR'}
      active={soundbarOn}
      color={COLORS.soundbar}
      below={soundbarBelow}
    >
      <Toggle
        checked={soundbarOn}
        disabled={!has(MEDIA.soundbarPower)}
        label={m.label}
        color={COLORS.soundbar}
        onchange={() => callService('script', 'turn_on', {}, MEDIA.soundbarPower).catch(() => {})}
      />
    </DeviceRow>
  {/if}
{/each}

<style>
  .spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid var(--text-3); border-right-color: transparent; animation: spin 0.8s linear infinite; }
</style>

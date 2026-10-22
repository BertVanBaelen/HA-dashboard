<script>
  import { slide, scale } from 'svelte/transition';
  import { mdiArrowLeft, mdiHome, mdiRewind, mdiFastForward, mdiPlayPause, mdiGestureSwipe, mdiGamepadCircleOutline, mdiApps } from '@mdi/js';
  import { MEDIA } from '$shared/config.js';
  import { states, callService, unavailable } from '../../lib/api.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import NowPlaying from './NowPlaying.svelte';
  import Touchpad from './Touchpad.svelte';
  import Dpad from './Dpad.svelte';
  import VolumeControl from './VolumeControl.svelte';
  import { hold } from './hold.js';

  const NAV = { up: 'CursorUp', down: 'CursorDown', left: 'CursorLeft', right: 'CursorRight', ok: 'Confirm' };
  const PAD_KEY = 'thuis-media-pad2';

  const cast = $derived($states[MEDIA.chromecast]);
  const tvRemote = $derived($states[MEDIA.tvRemote]);
  const castRemote = $derived($states[MEDIA.chromecastRemote]);
  const playing = $derived(cast?.state === 'playing' || cast?.state === 'buffering');
  const appName = $derived(String(cast?.attributes?.app_name ?? '').toLowerCase());
  const allApps = [...MEDIA.apps, ...MEDIA.moreApps];
  const currentApp = $derived(appName ? allApps.find((a) => appName.includes(a.label.toLowerCase().split(' ')[0])) : null);

  const appColor = $derived(/** @type {string} */ ((currentApp && 'color' in currentApp && currentApp.color) || ''));

  let padMode = $state(localStorage.getItem(PAD_KEY) ?? 'dpad');
  let moreOpen = $state(false);
  let launching = $state(/** @type {string|null} */ (null));

  const tvNA = $derived(unavailable(tvRemote));
  const castNA = $derived(unavailable(castRemote));

  function setPad(/** @type {string} */ v) {
    padMode = v;
    localStorage.setItem(PAD_KEY, v);
  }

  const send = (/** @type {string} */ entity, /** @type {string} */ command) =>
    callService('remote', 'send_command', { command }, entity).catch(() => {});
  const nav = (/** @type {keyof typeof NAV} */ d) => send(MEDIA.tvRemote, NAV[d]);
  const tv = (/** @type {string} */ c) => send(MEDIA.tvRemote, c);
  const cc = (/** @type {string} */ c) => send(MEDIA.chromecastRemote, c);

  async function launch(/** @type {{key:string,label:string,activity:string}} */ app) {
    launching = app.key;
    try {
      await callService('remote', 'turn_on', { activity: app.activity }, MEDIA.chromecastRemote, `${app.label} wordt gestart`);
      moreOpen = false;
    } catch {
    } finally {
      setTimeout(() => (launching = null), 600);
    }
  }
</script>

<div class="grid">
  <Card pad={false} glow={playing} accent={appColor}>
    <NowPlaying s={cast} kind="tv" color={appColor || 'var(--accent)'}>
      <div class="transport">
        <button class="tbtn" aria-label="Terugspoelen" disabled={castNA} use:hold={{ fn: () => cc(MEDIA.castKeys.rewind), interval: 400 }}><Icon path={mdiRewind} size={26} /></button>
        <button class="tbtn main" aria-label="Afspelen / pauze" disabled={castNA} use:hold={{ fn: () => cc(MEDIA.castKeys.playPause), repeat: false }}>
          <Icon path={mdiPlayPause} size={34} />
        </button>
        <button class="tbtn" aria-label="Vooruitspoelen" disabled={castNA} use:hold={{ fn: () => cc(MEDIA.castKeys.forward), interval: 400 }}><Icon path={mdiFastForward} size={26} /></button>
      </div>
    </NowPlaying>
  </Card>

  <Card title="Afstandsbediening" icon="television" subtitle={tvNA ? 'Niet beschikbaar' : ''}>
    {#snippet actions()}
      <div class="padsel">
        <Segmented
          size="sm"
          value={padMode}
          onchange={setPad}
          options={[
            { value: 'dpad', label: 'Pijlen', iconPath: mdiGamepadCircleOutline },
            { value: 'touch', label: 'Touch', iconPath: mdiGestureSwipe },
          ]}
        />
      </div>
    {/snippet}
    <div class="col remote">
      {#key padMode}
        <div in:scale={{ start: 0.94, duration: 300 }}>
          {#if padMode === 'dpad'}
            <Dpad onnav={nav} disabled={tvNA} />
          {:else}
            <Touchpad onnav={nav} disabled={tvNA} />
          {/if}
        </div>
      {/key}
      <div class="grid-2 navrow">
        <button class="btn soft navbtn" disabled={castNA} use:hold={{ fn: () => cc('BACK'), repeat: false }}><Icon path={mdiArrowLeft} />Terug</button>
        <button class="btn soft navbtn" disabled={castNA} use:hold={{ fn: () => cc('HOME'), repeat: false }}><Icon path={mdiHome} />Home</button>
      </div>
      <VolumeControl
        label="Soundbar"
        disabled={tvNA}
        ondown={() => send(MEDIA.tvRemote, 'VolumeDown')}
        onup={() => send(MEDIA.tvRemote, 'VolumeUp')}
        onmute={() => send(MEDIA.tvRemote, 'Mute')}
      />
    </div>
  </Card>

  <Card title="Apps" iconPath={mdiApps} subtitle={castNA ? 'Chromecast niet beschikbaar' : currentApp ? `Nu open: ${currentApp.label}` : 'Chromecast'}>
    <div class="apps">
      {#each MEDIA.apps as app, i (app.key)}
        <button
          class="app"
          class:current={currentApp?.key === app.key}
          class:busy={launching === app.key}
          style="--app:{app.color};--d:{i * 60}ms"
          disabled={castNA}
          onclick={() => launch(app)}
        >
          <span class="logo"><Icon name={app.icon} size={30} /></span>
          <span class="small ellipsis">{app.label}</span>
        </button>
      {/each}
    </div>
    <button class="more btn ghost block" class:open={moreOpen} onclick={() => (moreOpen = !moreOpen)}>
      Meer apps <Icon name="chevronDown" size={20} class="chev" />
    </button>
    {#if moreOpen}
      <div class="morelist" transition:slide={{ duration: 300 }}>
        {#each MEDIA.moreApps as app, i (app.key)}
          <button
            class="moreapp"
            class:current={currentApp?.key === app.key}
            class:busy={launching === app.key}
            style="--d:{i * 40}ms"
            disabled={castNA}
            onclick={() => launch(app)}
          >
            <span class="initial">{app.label[0]}</span>
            <span class="grow ellipsis">{app.label}</span>
            {#if launching === app.key}<span class="spinner"></span>{:else}<Icon name="chevronRight" size={18} />{/if}
          </button>
        {/each}
      </div>
    {/if}
  </Card>
</div>

<style>
  .transport { display: flex; align-items: center; justify-content: center; gap: 18px; }
  .tbtn {
    width: 56px; height: 56px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center;
    background: var(--surface-2); color: var(--text); touch-action: manipulation; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    transition: transform 0.2s var(--spring), background 0.2s;
  }
  .tbtn:active, .tbtn:global(.held) { transform: scale(0.88); background: var(--accent-soft); }
  .tbtn.main { width: 72px; height: 72px; background: var(--gradient); color: #fff; box-shadow: 0 12px 28px -10px var(--accent); }
  .tbtn:disabled { opacity: 0.5; }
  .padsel { width: 170px; }
  .remote { gap: 12px; }
  .navrow { gap: 10px; }
  .navbtn { min-height: 52px; gap: 8px; font-weight: 700; touch-action: manipulation; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
  .navbtn:global(.held) { transform: scale(0.95); }

  .apps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .app {
    display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px; min-width: 0; border-radius: 18px;
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer;
    animation: pop 0.45s var(--spring) var(--d) both;
    transition: transform 0.25s var(--spring), box-shadow 0.3s, border-color 0.3s;
  }
  .app:hover { transform: translateY(-3px); }
  .app:active { transform: scale(0.92); }
  .app:disabled { opacity: 0.5; }
  .app span { max-width: 100%; }
  .logo {
    width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; color: #fff;
    background: linear-gradient(145deg, var(--app), color-mix(in srgb, var(--app) 55%, #000));
    box-shadow: 0 10px 22px -10px var(--app); transition: transform 0.4s var(--spring);
  }
  .app.current { border-color: color-mix(in srgb, var(--app) 60%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--app) 18%, transparent); }
  .app.current .logo { --glow: var(--app); }
  .app.busy .logo { animation: wiggle 0.5s ease-in-out infinite; }
  .more { margin-top: 10px; gap: 6px; }
  .more :global(.chev) { transition: transform 0.35s var(--spring); }
  .more.open :global(.chev) { transform: rotate(180deg); }
  .morelist { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
  .moreapp {
    display: flex; align-items: center; gap: 12px; padding: 8px 12px; min-height: 52px; border-radius: 14px; cursor: pointer;
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-weight: 600; text-align: left;
    animation: fade-up 0.35s var(--ease) var(--d) both; transition: transform 0.2s var(--spring), background 0.2s;
  }
  .moreapp:active { transform: scale(0.97); }
  .moreapp.current { background: var(--accent-soft); }
  .initial { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--gradient); color: #fff; font-weight: 800; }
  .spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--accent-soft); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
</style>

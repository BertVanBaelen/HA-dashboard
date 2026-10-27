<script>
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { TABS } from '$shared/config.js';
  import { ready, prefs, connection, haConnected, isMock, user, reconnect } from './lib/api.js';
  import { tabLoaders } from './tabs/index.js';
  import Icon from './components/Icon.svelte';
  import Sheet from './components/Sheet.svelte';
  import Toasts from './components/Toasts.svelte';
  import Settings from './settings/Settings.svelte';
  import { navigate, settingsRequest } from './lib/nav.js';

  const MAX_BOTTOM = 5;

  let settingsOpen = $state(false);
  let moreOpen = $state(false);
  let current = $state(/** @type {string|null} */ (null));
  let direction = $state(1);
  let systemDark = $state(window.matchMedia('(prefers-color-scheme: dark)').matches);
  let wide = $state(window.innerWidth >= 768);
  let scrolled = $state(false);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => (systemDark = e.matches));

  const visibleTabs = $derived(
    ($prefs?.tabs ?? TABS.map((t) => ({ id: t.id, visible: true })))
      .filter((t) => t.visible)
      .map((t) => TABS.find((x) => x.id === t.id))
      .filter(Boolean),
  );
  const bottomTabs = $derived(visibleTabs.length > MAX_BOTTOM ? visibleTabs.slice(0, MAX_BOTTOM - 1) : visibleTabs);
  const overflowTabs = $derived(visibleTabs.length > MAX_BOTTOM ? visibleTabs.slice(MAX_BOTTOM - 1) : []);
  const currentTab = $derived(TABS.find((t) => t.id === current));
  const inOverflow = $derived(overflowTabs.some((t) => t.id === current));

  // Theme
  const mode = $derived(($prefs?.theme?.mode ?? 'auto') === 'auto' ? (systemDark ? 'dark' : 'light') : $prefs.theme.mode);
  const accent = $derived($prefs?.theme?.accent ?? 'blauw');
  $effect(() => {
    const el = document.documentElement;
    el.dataset.mode = mode;
    el.dataset.accent = accent;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', mode === 'dark' ? '#0b1020' : '#f4f6fb');
  });

  // Initial tab + keep current valid
  $effect(() => {
    if (!$prefs) return;
    const ids = visibleTabs.map((t) => t.id);
    if (current && ids.includes(current)) return;
    const saved = sessionStorage.getItem('tab');
    current = (saved && ids.includes(saved) ? saved : ids.includes($prefs.startTab) ? $prefs.startTab : ids[0]) ?? null;
  });

  function go(id) {
    if (id === current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const ids = visibleTabs.map((t) => t.id);
    direction = ids.indexOf(id) > ids.indexOf(current) ? 1 : -1;
    current = id;
    sessionStorage.setItem('tab', id);
    moreOpen = false;
    window.scrollTo({ top: 0 });
  }

  // Requests from tabs
  $effect(() => {
    const id = $navigate;
    if (!id) return;
    navigate.set(null);
    if (visibleTabs.some((t) => t.id === id)) go(id);
  });
  $effect(() => {
    if (!$settingsRequest) return;
    settingsRequest.set(false);
    settingsOpen = true;
  });

  // Swipe between tabs (ignores sliders, maps, scrollers and inputs)
  let touch = null;
  function onTouchStart(e) {
    const t = e.target;
    if (t.closest('input, textarea, select, .no-swipe, .leaflet-container, .u-wrap, [data-no-swipe]')) return (touch = null);
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }
  function onTouchEnd(e) {
    if (!touch || wide) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    const dt = Date.now() - touch.t;
    touch = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || dt > 600) return;
    const ids = visibleTabs.map((t) => t.id);
    const i = ids.indexOf(current) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < ids.length) go(ids[i]);
  }

  const status = $derived($connection !== 'open' ? 'offline' : !$haConnected ? 'ha' : 'ok');

  /** Manual refresh: reconnect (fresh states) and remount the current tab so it reloads its data. */
  let refreshes = $state(0);
  function refresh() {
    reconnect();
    refreshes++;
  }
</script>

<svelte:window onresize={() => (wide = window.innerWidth >= 768)} onscroll={() => (scrolled = window.scrollY > 8)} />

<div class="bg" aria-hidden="true">
  <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
</div>

<Toasts />

{#if !$ready}
  <div class="splash" out:fade={{ duration: 300 }}>
    <div class="logo pulse"><Icon name="home" size={42} /></div>
    <div class="muted">{$connection === 'closed' ? 'Verbinding maken…' : 'Laden…'}</div>
    {#if $connection === 'closed'}
      <button class="btn" onclick={reconnect}><Icon name="refresh" size={18} /> Opnieuw proberen</button>
    {/if}
  </div>
{:else}
  <div class="shell" class:wide in:fade={{ duration: 400 }}>
    <header class="top" class:scrolled>
      <div class="spread hdr">
        <div class="title-wrap">
          {#key current}
            <h1 in:fly={{ y: 12, duration: 350, easing: cubicOut }}>{currentTab?.label ?? 'Thuis'}</h1>
          {/key}
          <div class="who small muted">
            <span class="dot {status}" title={status === 'ok' ? 'Verbonden' : 'Geen verbinding'}></span>
            {$user?.displayName}{#if $isMock} · <span class="gradient-text">demo</span>{/if}
          </div>
        </div>
        <div class="actions">
          <button class="btn icon round" class:spin={$connection === 'connecting'} onclick={refresh} aria-label="Vernieuwen" title="Vernieuwen">
            <Icon name="refresh" size={22} />
          </button>
          <button class="btn icon round gear" onclick={() => (settingsOpen = true)} aria-label="Instellingen">
            <Icon name="settings" size={24} />
          </button>
        </div>
      </div>

      {#if wide}
        <nav class="toptabs">
          {#each visibleTabs as t (t.id)}
            <button class:active={t.id === current} onclick={() => go(t.id)}>
              <Icon name={t.icon} size={20} /><span>{t.label}</span>
            </button>
          {/each}
        </nav>
      {/if}
    </header>

    {#if status !== 'ok'}
      <button class="banner" onclick={refresh} transition:fly={{ y: -20, duration: 300 }}>
        <Icon name="wifiOff" size={18} />
        {status === 'offline' ? 'Verbinding verbroken… opnieuw verbinden' : 'Home Assistant is niet bereikbaar'}
        <Icon name="refresh" size={18} />
      </button>
    {/if}

    <main ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
      {#if visibleTabs.length === 0}
        <div class="none">
          <p class="muted">Je hebt alle tabbladen verborgen.</p>
          <button class="btn primary" onclick={() => (settingsOpen = true)}>Instellingen openen</button>
        </div>
      {:else if current}
        {#key `${current}|${refreshes}`}
          <div class="page" in:fly={{ x: 40 * direction, duration: 420, easing: cubicOut }}>
            {#await tabLoaders[current]()}
              <div class="loading"><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:200px"></div></div>
            {:then mod}
              <mod.default />
            {:catch err}
              <p class="danger">Kon tabblad niet laden: {err.message}</p>
            {/await}
          </div>
        {/key}
      {/if}
    </main>

    {#if !wide && visibleTabs.length > 1}
      <nav class="bottom" style="--n:{bottomTabs.length + (overflowTabs.length ? 1 : 0)}">
        {#each bottomTabs as t (t.id)}
          <button class:active={t.id === current} onclick={() => go(t.id)}>
            <span class="ic"><Icon name={t.icon} size={24} /></span>
            <span class="lbl">{t.short ?? t.label}</span>
          </button>
        {/each}
        {#if overflowTabs.length}
          <button class:active={inOverflow} onclick={() => (moreOpen = true)}>
            <span class="ic"><Icon name={inOverflow ? currentTab.icon : 'more'} size={24} /></span>
            <span class="lbl">{inOverflow ? (currentTab.short ?? currentTab.label) : 'Meer'}</span>
          </button>
        {/if}
      </nav>
    {/if}
  </div>

  <Sheet bind:open={moreOpen} title="Meer">
    <div class="more-grid">
      {#each overflowTabs as t, i (t.id)}
        <button class="more-item" class:active={t.id === current} onclick={() => go(t.id)} in:scale={{ start: 0.8, delay: i * 40, duration: 300 }}>
          <span class="ic"><Icon name={t.icon} size={26} /></span>
          <span>{t.label}</span>
        </button>
      {/each}
    </div>
  </Sheet>

  <Sheet bind:open={settingsOpen} title="Instellingen" wide>
    <Settings />
  </Sheet>
{/if}

<style>
  .bg { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; background: radial-gradient(120% 80% at 50% 0%, var(--bg-2), var(--bg)); transition: background 0.6s; }
  .blob { position: absolute; width: 60vmax; height: 60vmax; border-radius: 50%; filter: blur(80px); opacity: var(--blob-opacity); transition: background 0.8s var(--ease); }
  .b1 { background: var(--accent); top: -25vmax; left: -15vmax; animation: blob 26s ease-in-out infinite; }
  .b2 { background: var(--accent-2); top: 20vh; right: -30vmax; animation: blob 32s ease-in-out infinite reverse; }
  .b3 { background: var(--accent-3); bottom: -35vmax; left: 10vw; animation: blob 38s ease-in-out infinite; opacity: calc(var(--blob-opacity) * 0.6); }

  .splash { position: fixed; inset: 0; display: grid; place-content: center; justify-items: center; gap: 16px; }
  .logo { width: 84px; height: 84px; border-radius: 28px; display: grid; place-items: center; color: #fff; background: var(--gradient); }

  .shell { min-height: 100dvh; padding-bottom: calc(96px + var(--safe-bottom)); }
  .shell.wide { padding-bottom: 32px; }

  .top { position: sticky; top: 0; z-index: 20; padding: calc(10px + var(--safe-top)) 18px 10px; transition: background 0.3s, box-shadow 0.3s, backdrop-filter 0.3s; }
  .top.scrolled { background: color-mix(in srgb, var(--bg) 70%, transparent); backdrop-filter: blur(18px) saturate(1.5); -webkit-backdrop-filter: blur(18px) saturate(1.5); box-shadow: 0 1px 0 var(--border); }
  .hdr { max-width: 1200px; margin: 0 auto; }
  .title-wrap { min-width: 0; display: grid; }
  .title-wrap h1 { grid-area: 1 / 1; font-size: 1.85rem; letter-spacing: -0.03em; }
  .who { display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); --pulse: var(--ok); }
  .dot.offline { background: var(--danger); --pulse: var(--danger); }
  .dot.ha { background: var(--warn); --pulse: var(--warn); }
  .actions { display: flex; gap: 8px; }
  .round { width: 46px; height: 46px; background: var(--surface); border: 1px solid var(--border); backdrop-filter: blur(12px); }
  .spin :global(svg) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .gear :global(svg) { transition: transform 0.7s var(--spring); }
  .gear:hover :global(svg), .gear:active :global(svg) { transform: rotate(120deg); }

  .toptabs { max-width: 1200px; margin: 12px auto 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  .toptabs button { display: flex; align-items: center; gap: 8px; border: 1px solid transparent; background: none; padding: 9px 16px; border-radius: 999px; cursor: pointer; font-weight: 600; color: var(--text-2); transition: all 0.3s var(--ease); white-space: nowrap; }
  .toptabs button:hover { background: var(--surface-2); color: var(--text); }
  .toptabs button.active { background: var(--gradient); color: #fff; box-shadow: 0 6px 18px -6px var(--accent); }

  .banner { position: sticky; top: calc(86px + var(--safe-top)); z-index: 19; margin: 0 auto 8px; width: fit-content; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: color-mix(in srgb, var(--danger) 18%, var(--surface-solid)); color: var(--danger); font-weight: 600; font-size: 0.85rem; box-shadow: var(--shadow); border: 0; font-family: inherit; cursor: pointer; }

  main { max-width: 1200px; margin: 0 auto; padding: 6px 14px 0; min-height: 60vh; }
  .page { will-change: transform, opacity; }
  .loading { display: flex; flex-direction: column; gap: 14px; }
  .none { text-align: center; padding: 60px 0; }

  .bottom {
    position: fixed; z-index: 30; left: 10px; right: 10px; bottom: calc(10px + var(--safe-bottom));
    display: grid; grid-template-columns: repeat(var(--n), 1fr); padding: 6px;
    background: color-mix(in srgb, var(--surface-solid) 78%, transparent); backdrop-filter: blur(24px) saturate(1.6); -webkit-backdrop-filter: blur(24px) saturate(1.6);
    border: 1px solid var(--border); border-radius: 26px; box-shadow: var(--shadow-lg);
  }
  .bottom button { border: 0; background: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0 4px; color: var(--text-3); min-height: 56px; border-radius: 20px; transition: color 0.3s; position: relative; }
  .bottom .ic { width: 52px; height: 32px; border-radius: 16px; display: grid; place-items: center; transition: background 0.35s var(--ease), transform 0.4s var(--spring), color 0.3s; }
  .bottom .lbl { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.01em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bottom button.active { color: var(--accent-text); }
  .bottom button.active .ic { background: var(--accent-soft); color: var(--accent); transform: translateY(-2px); }
  .bottom button.active .ic :global(svg) { animation: pop 0.45s var(--spring); }
  .bottom button:active .ic { transform: scale(0.88); }

  .more-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 6px 0 10px; }
  .more-item { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 6px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: transform 0.2s var(--spring); }
  .more-item:active { transform: scale(0.94); }
  .more-item .ic { width: 50px; height: 50px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
  .more-item.active { border-color: var(--accent); }
</style>

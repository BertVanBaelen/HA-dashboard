<script>
  import { onMount } from 'svelte';
  import { slide, fly, fade } from 'svelte/transition';
  import { mdiFire, mdiCalendarClock, mdiPowerStandby, mdiRocketLaunch, mdiTimerOutline, mdiWindowOpenVariant, mdiWeatherSunsetUp, mdiHandBackRight, mdiChevronDown } from '@mdi/js';
  import { DEFAULT_COMFORT_TEMP } from '$shared/config.js';
  import { states, household, callService, isOn, unavailable, toast } from '../../lib/api.js';
  import { fmtTime } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import TempControl from './TempControl.svelte';

  /** @type {{ room: import('../../lib/rooms.js').ClimateRoom }} */
  let { room } = $props();

  const roomIcon = { living: 'sofa', slaapkamer: 'bed', badkamer: 'shower' };

  const c = $derived($states[room.climate]);
  const na = $derived(unavailable(c));
  const a = $derived(c?.attributes ?? {});
  const mode = $derived(c?.state);
  let pendingMode = $state(/** @type {string|null} */ (null));
  const shownMode = $derived(pendingMode ?? mode);
  const off = $derived(shownMode === 'off');

  const toNum = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const current = $derived(toNum($states[room.temperature]?.state) ?? toNum(a.current_temperature));
  const target = $derived(toNum(a.temperature));
  const humidity = $derived($states[room.humidity] ?? null);
  const humidityVal = $derived(toNum(humidity?.state) ?? toNum(a.current_humidity));
  const heatPct = $derived(toNum($states[room.heating]?.state) ?? 0);
  const heating = $derived(!off && (a.hvac_action === 'heating' || heatPct > 0));
  const windowOpen = $derived(isOn($states[room.window]) || a.hvac_action === 'window_open' || a.preset_mode === 'window_open');
  const earlyStart = $derived(isOn($states[room.earlyStart]));
  const overlaySensor = $derived($states[room.overlay]);
  const termination = $derived(String(overlaySensor?.attributes?.termination ?? '').toUpperCase());
  const manual = $derived(!na && (isOn(overlaySensor) || mode === 'heat' || mode === 'off'));
  const comfort = $derived(Number($household?.comfort?.[room.key] ?? DEFAULT_COMFORT_TEMP));
  const minT = $derived(Math.max(toNum(a.min_temp) ?? 5, 10));
  const maxT = $derived(toNum(a.max_temp) ?? 25);
  const step = $derived(toNum(a.target_temp_step) ?? 0.5);

  const modeOptions = $derived(
    [
      { value: 'off', label: 'Uit', iconPath: mdiPowerStandby, color: '#64748b' },
      { value: 'auto', label: 'Auto', iconPath: mdiCalendarClock, color: 'var(--accent)' },
      { value: 'heat', label: 'Verwarm', iconPath: mdiFire, color: 'var(--heat)' },
    ].filter((o) => !a.hvac_modes || a.hvac_modes.includes(o.value)),
  );

  const BOOSTS = [
    { key: '30', label: '30 min', min: 30 },
    { key: '60', label: '1 u', min: 60 },
    { key: '120', label: '2 u', min: 120 },
    { key: 'next', label: 'Volgend blok', min: null },
  ];
  let boostBusy = $state(/** @type {string|null} */ (null));
  let boost = $state(/** @type {{key:string,until:number|null,since:number}|null} */ (null));
  let now = $state(Date.now());
  let resetBusy = $state(false);
  let moreOpen = $state(false);

  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 15e3);
    return () => clearInterval(t);
  });

  $effect(() => {
    mode;
    pendingMode = null;
  });
  $effect(() => {
    if (boost && ((!manual && now - boost.since > 20e3) || (boost.until && boost.until < now))) boost = null;
  });

  const overlayLabel = $derived.by(() => {
    if (boost) return boost.until ? `Boost · nog ${Math.max(1, Math.round((boost.until - now) / 60e3))} min` : 'Boost tot volgend blok';
    if (mode === 'off') return 'Uit (handmatig)';
    if (termination.includes('TIMER')) return 'Timer';
    if (termination.includes('NEXT') || termination.includes('TADO')) return 'Tot volgend blok';
    return 'Handmatig';
  });

  async function setTemp(v) {
    try {
      await callService('climate', 'set_temperature', { temperature: v, hvac_mode: 'heat' }, room.climate, `${room.name}: ${String(v).replace('.', ',')}°`);
    } catch {}
  }

  async function setMode(m) {
    pendingMode = m;
    const t = setTimeout(() => (pendingMode = null), 6000);
    try {
      await callService('climate', 'set_hvac_mode', { hvac_mode: m }, room.climate);
    } catch {
      clearTimeout(t);
      pendingMode = null;
    }
  }

  async function startBoost(b) {
    boostBusy = b.key;
    const data = b.min
      ? { temperature: comfort, time_period: `${String(Math.floor(b.min / 60)).padStart(2, '0')}:${String(b.min % 60).padStart(2, '0')}:00` }
      : { temperature: comfort, requested_overlay: 'NEXT_TIME_BLOCK' };
    try {
      await callService('tado', 'set_climate_timer', data, room.climate);
      boost = { key: b.key, until: b.min ? Date.now() + b.min * 60e3 : null, since: Date.now() };
      now = Date.now();
      toast(b.min ? `${room.name}: ${String(comfort).replace('.', ',')}° tot ${fmtTime(new Date(Date.now() + b.min * 60e3))}` : `${room.name}: ${String(comfort).replace('.', ',')}° tot volgend blok`, 'ok');
    } catch {
    } finally {
      boostBusy = null;
    }
  }

  async function backToSchedule() {
    resetBusy = true;
    try {
      await callService('climate', 'set_hvac_mode', { hvac_mode: 'auto' }, room.climate, `${room.name} volgt weer het schema`);
      boost = null;
    } catch {
    } finally {
      resetBusy = false;
    }
  }
</script>

<Card pad={false} class="room-card {heating ? 'is-heating' : ''} {off ? 'is-off' : ''}" glow={heating} accent={heating ? 'var(--heat)' : off ? '#64748b' : 'var(--cool)'}>
  {#snippet header()}
    <header class="rc-head">
      <span class="rc-icon"><Icon name={roomIcon[room.key] ?? 'thermostat'} size={22} /></span>
      <div class="grow" style="min-width:0">
        <h3>{room.name}</h3>
        <div class="badges">
          {#if na}<Badge text="Niet beschikbaar" />{/if}
          {#if heating}<Badge kind="warn" pulse text="Verwarmt" />{/if}
          {#if manual}<span in:fly={{ y: -6 }}><Badge kind="accent" text={overlayLabel} /></span>{/if}
          {#if earlyStart}<span in:fly={{ y: -6 }}><Badge kind="info" text="Vroeg starten" /></span>{/if}
          {#if windowOpen}<span in:fly={{ y: -6 }}><Badge kind="danger" pulse text="Raam open" /></span>{/if}
          {#if !na && !manual && !heating && !earlyStart && !windowOpen}<Badge kind="ok" text="Volgt schema" />{/if}
        </div>
      </div>
      {#if !na}
        <div class="power" class:on={heatPct > 0} title="Verwarmingsvermogen">
          <Icon path={mdiFire} size={16} />
          <span class="num">{Math.round(heatPct)}%</span>
          <span class="power-bar"><span style="width:{Math.min(100, heatPct)}%"></span></span>
        </div>
      {/if}
    </header>
  {/snippet}

  <div class="rc-body">
    {#if windowOpen}
      <div class="window-alert" transition:slide>
        <span class="wiggle"><Icon path={mdiWindowOpenVariant} size={20} /></span>
        <span>Raam open – verwarming gepauzeerd</span>
      </div>
    {/if}

    <div class="temp-area">
      <TempControl
        value={off ? comfort : (target ?? comfort)}
        min={minT}
        max={maxT}
        {step}
        {current}
        humidity={humidityVal}
        {comfort}
        {off}
        {heating}
        disabled={na}
        label="{room.name} doeltemperatuur"
        onchange={setTemp}
      />
      {#if off}<div class="hint tiny muted">Tik op + of een temperatuur om de verwarming aan te zetten</div>{/if}
    </div>

    <Segmented options={modeOptions} value={shownMode} onchange={setMode} disabled={na} />

    <div class="more" class:open={moreOpen}>
      <button class="more-btn" aria-expanded={moreOpen} onclick={() => (moreOpen = !moreOpen)}>
        <Icon path={mdiRocketLaunch} size={17} />
        <span class="grow">Boost &amp; schema</span>
        {#if (manual || boost) && !moreOpen}<span class="dot" transition:fade={{ duration: 200 }}></span>{/if}
        <span class="chev"><Icon path={mdiChevronDown} size={20} /></span>
      </button>
      {#if moreOpen}
        <div class="more-body" transition:slide={{ duration: 320 }}>
          <div class="label-row">
            <span class="section-title" style="margin:0">Boost naar {String(comfort).replace('.', ',')}°</span>
          </div>
          <div class="boost-row">
            {#each BOOSTS as b, i (b.key)}
              <button class="bchip" class:active={boost?.key === b.key} disabled={na || !!boostBusy} onclick={() => startBoost(b)} in:fly={{ y: 10, delay: 60 + i * 50, duration: 280 }}>
                {#if boostBusy === b.key}<span class="spinner"></span>{:else}<Icon path={b.min ? mdiTimerOutline : mdiWeatherSunsetUp} size={16} />{/if}
                <span>{b.label}</span>
              </button>
            {/each}
          </div>
          <button class="btn soft block reset" disabled={resetBusy || na || !manual} onclick={backToSchedule}>
            {#if resetBusy}<span class="spinner"></span>{:else}<Icon path={mdiHandBackRight} size={18} />{/if}
            {manual ? 'Terug naar schema' : 'Volgt al het schema'}
          </button>
        </div>
      {/if}
    </div>
  </div>
</Card>

<style>
  .rc-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 16px 0; }
  .rc-icon {
    width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0;
    background: color-mix(in srgb, var(--card-accent) 16%, transparent); color: var(--card-accent);
    transition: background 0.4s, color 0.4s;
  }
  h3 { font-size: 1.1rem; }
  .badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .power { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; color: var(--text-3); font-weight: 700; font-size: 0.85rem; }
  .power :global(svg) { transition: color 0.4s; }
  .power.on { color: var(--heat); }
  .power-bar { width: 52px; height: 5px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
  .power-bar span { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #fbbf24, var(--heat), #ef4444); transition: width 0.8s var(--ease); }

  .rc-body { padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 14px; }
  .window-alert {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; font-size: 0.85rem; font-weight: 600;
    color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent);
  }
  .wiggle { display: inline-block; }

  .temp-area { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 4px; }
  .hint { text-align: center; }
  .label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }

  .more { border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border); overflow: hidden; transition: background 0.3s; }
  .more-btn {
    width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; min-height: 46px; border: 0; background: none;
    color: var(--text-2); font: inherit; font-weight: 700; font-size: 0.9rem; cursor: pointer; text-align: left;
  }
  .more-btn:active { background: var(--surface-3); }
  .more.open .more-btn { color: var(--text); }
  .chev { display: grid; transition: transform 0.35s var(--spring); }
  .more.open .chev { transform: rotate(180deg); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
  .more-body { display: flex; flex-direction: column; gap: 10px; padding: 0 12px 12px; }
  .boost-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .bchip {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 52px; padding: 6px 4px;
    border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-weight: 700; font-size: 0.78rem;
    cursor: pointer; transition: transform 0.2s var(--spring), background 0.3s, color 0.3s, box-shadow 0.3s;
  }
  .bchip span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .bchip:active { transform: scale(0.93); }
  .bchip:disabled { opacity: 0.6; cursor: default; }
  .bchip.active { background: var(--heat); color: #fff; border-color: transparent; box-shadow: 0 8px 20px -8px var(--heat); }
  .reset { gap: 8px; }
  .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; display: inline-block; }

  :global(.card.room-card.is-heating) { animation: warm 6s ease-in-out infinite; }
  @keyframes warm { 0%, 100% { box-shadow: var(--shadow), 0 10px 40px -16px color-mix(in srgb, var(--heat) 50%, transparent); } 50% { box-shadow: var(--shadow), 0 14px 50px -10px color-mix(in srgb, var(--heat) 70%, transparent); } }
  @keyframes flick { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2) translateY(-1px); } }
</style>

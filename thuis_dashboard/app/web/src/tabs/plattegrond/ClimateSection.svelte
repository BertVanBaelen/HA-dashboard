<script>
  import { mdiFire, mdiCalendarClock, mdiPowerStandby, mdiWindowOpenVariant, mdiWaterPercent } from '@mdi/js';
  import { states, callService, isOn, unavailable } from '../../lib/api.js';
  import Icon from '../../components/Icon.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import { toNum, fmt } from './summary.js';

  /** @type {{ room: typeof import('$shared/config.js').ROOMS[number] }} */
  let { room } = $props();

  const c = $derived($states[room.climate]);
  const na = $derived(unavailable(c));
  const a = $derived(c?.attributes ?? {});
  const mode = $derived(c?.state);
  let pendingMode = $state(/** @type {string|null} */ (null));
  const shownMode = $derived(pendingMode ?? mode);
  const off = $derived(shownMode === 'off');
  $effect(() => {
    mode;
    pendingMode = null;
  });

  const current = $derived(toNum($states[room.temperature]?.state) ?? toNum(a.current_temperature));
  const humidity = $derived(toNum($states[room.humidity]?.state) ?? toNum(a.current_humidity));
  const target = $derived(toNum(a.temperature));
  const heatPct = $derived(toNum($states[room.heating]?.state) ?? 0);
  const heating = $derived(!off && (a.hvac_action === 'heating' || heatPct > 0));
  const windowOpen = $derived(isOn($states[room.window]) || a.hvac_action === 'window_open');
  const minT = $derived(Math.max(toNum(a.min_temp) ?? 5, 10));
  const maxT = $derived(toNum(a.max_temp) ?? 25);
  const step = $derived(toNum(a.target_temp_step) ?? 0.5);

  const modeOptions = $derived(
    [
      { value: 'off', label: 'Uit', iconPath: mdiPowerStandby, color: '#64748b' },
      { value: 'auto', label: 'Schema', iconPath: mdiCalendarClock, color: 'var(--accent)' },
      { value: 'heat', label: 'Verwarm', iconPath: mdiFire, color: 'var(--heat)' },
    ].filter((o) => !a.hvac_modes || a.hvac_modes.includes(o.value)),
  );

  async function setTemp(v) {
    try {
      await callService('climate', 'set_temperature', { temperature: v, hvac_mode: 'heat' }, room.climate, `${room.name}: ${fmt(v)}°`);
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
</script>

<div class="clim" class:heating class:off>
  <div class="spread top">
    <div class="col" style="gap:2px">
      <span class="small muted">Nu</span>
      <span class="now num">{fmt(current)}<small>°</small></span>
    </div>
    <div class="facts">
      {#if humidity != null}<span class="fact"><Icon path={mdiWaterPercent} size={16} />{fmt(humidity, 0)}%</span>{/if}
      {#if na}
        <span class="fact faint">Niet bereikbaar</span>
      {:else if heating}
        <span class="fact heat"><Icon path={mdiFire} size={16} />Verwarmt{heatPct > 0 ? ` · ${Math.round(heatPct)}%` : ''}</span>
      {:else}
        <span class="fact faint">{off ? 'Verwarming uit' : 'Niet aan het verwarmen'}</span>
      {/if}
      {#if windowOpen}<span class="fact danger"><Icon path={mdiWindowOpenVariant} size={16} />Raam open</span>{/if}
    </div>
  </div>

  <div class="target">
    <span class="small muted">Doeltemperatuur</span>
    <Stepper value={off ? null : target} min={minT} max={maxT} {step} disabled={na || target == null || off} onchange={setTemp} />
  </div>

  <Segmented options={modeOptions} value={shownMode} disabled={na} onchange={setMode} />
</div>

<style>
  .clim {
    display: flex; flex-direction: column; gap: 14px; padding: 14px; border-radius: var(--radius-sm);
    background: var(--surface-2); border: 1px solid var(--border); position: relative; overflow: hidden; isolation: isolate;
    transition: border-color 0.5s, box-shadow 0.5s;
  }
  .clim::before {
    content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0; transition: opacity 0.6s var(--ease);
    background: radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--heat) 28%, transparent), transparent 60%);
  }
  .clim.heating { border-color: color-mix(in srgb, var(--heat) 45%, var(--border)); box-shadow: 0 12px 30px -20px var(--heat); }
  .clim.heating::before { opacity: 1; }
  .top { align-items: flex-start; }
  .now { font-size: 2.4rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  .now small { font-size: 1.1rem; color: var(--text-2); }
  .facts { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .fact { display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; font-weight: 600; color: var(--text-2); }
  .fact.heat { color: var(--heat); }
  .fact.danger { color: var(--danger); }
  .target { display: flex; flex-direction: column; gap: 4px; }
</style>

<script>
  import { onMount } from 'svelte';
  import { fly, slide, scale } from 'svelte/transition';
  import {
    mdiCarElectric, mdiLock, mdiLockOpenVariant, mdiRefresh, mdiLightningBolt, mdiTimerSand, mdiTimerOutline,
    mdiMapMarkerDistance, mdiEvStation, mdiPower, mdiCarDefrostFront, mdiCarDefrostRear, mdiCarSeatHeater, mdiSteering,
    mdiAccountTie, mdiSnowflakeMelt, mdiFan, mdiThermometer, mdiCarBack, mdiAlarmLight, mdiEvPlugType2, mdiPalmTree,
    mdiBatteryHeart, mdiCalendarClock, mdiCarTireAlert, mdiMapMarker, mdiGoogleMaps, mdiOpenInNew, mdiWindowOpenVariant,
    mdiCounter, mdiAlertCircle, mdiCarConnected, mdiCurrentAc, mdiGestureTap, mdiChartLine, mdiMapMarkerPath, mdiCurrencyEur,
  } from '@mdi/js';
  import { CAR_ENTITIES as E, CAR_FLAGS } from '$shared/config.js';
  import { states, household, callService, toast, isOn, unavailable, num, attr } from '../lib/api.js';
  import { relTime, fmtDuration } from '../lib/format.js';
  import Card from '../components/Card.svelte';
  import Icon from '../components/Icon.svelte';
  import Tile from '../components/Tile.svelte';
  import Badge from '../components/Badge.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Stepper from '../components/Stepper.svelte';
  import Toggle from '../components/Toggle.svelte';
  import MapView from '../components/MapView.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import BatteryRing from './auto/BatteryRing.svelte';
  import TyreView from './auto/TyreView.svelte';
  import TimeField from './auto/TimeField.svelte';
  import AutoData from './auto/AutoData.svelte';
  import Ritten from './auto/Ritten.svelte';
  import Kosten from './auto/Kosten.svelte';

  const VIEWS = [
    { value: 'bediening', label: 'Bediening', iconPath: mdiGestureTap },
    { value: 'data', label: 'Data', iconPath: mdiChartLine },
    { value: 'ritten', label: 'Ritten', iconPath: mdiMapMarkerPath },
    { value: 'kosten', label: 'Kosten', iconPath: mdiCurrencyEur },
  ];
  const storedView = sessionStorage.getItem('auto.view');
  let view = $state(VIEWS.some((v) => v.value === storedView) ? storedView : 'bediening');
  /** @param {string} v */
  function setView(v) {
    view = v;
    sessionStorage.setItem('auto.view', v);
  }

  const WAIT_MS = 90e3;
  const BOOT = E.openings.find((o) => o.entity.endsWith('_boot_status'))?.entity ?? '';

  /** @param {string} id */
  const s = (id) => $states[id];
  /** @param {string} id */
  const n = (id) => {
    const st = $states[id];
    const v = Number(st?.state);
    return st && !unavailable(st) && Number.isFinite(v) ? v : null;
  };
  /** @param {string} k */
  const flag = (k) => $household?.carFlags?.[k] ?? CAR_FLAGS.find((f) => f.key === k)?.default ?? true;

  // A-07 command feedback: a command stays "pending" until a watched entity changes or the timeout passes
  /** @type {Record<string, {watch:string[], snap:string[], until:number, want?:any}>} */
  let pending = $state({});
  let tick = $state(Date.now());

  /** @param {string[]} ids */
  const snapshot = (ids) => ids.map((id) => {
    const st = $states[id];
    return st ? `${st.state}|${st.last_updated}` : '';
  });

  /**
   * @param {string} key
   * @param {string} domain
   * @param {string} service
   * @param {string} target
   * @param {{ data?: object, watch?: string[], want?: any, ttl?: number }} [opts]
   */
  async function send(key, domain, service, target, { data = {}, watch = [target], want, ttl = WAIT_MS } = {}) {
    if (pending[key]) return;
    pending = { ...pending, [key]: { watch, snap: snapshot(watch), until: Date.now() + ttl, want } };
    try {
      await callService(domain, service, data, target, 'Commando verzonden…');
    } catch {
      const { [key]: _, ...rest } = pending;
      pending = rest;
    }
  }

  $effect(() => {
    const now = tick;
    const entries = Object.entries(pending);
    if (!entries.length) return;
    let changed = false;
    /** @type {typeof pending} */
    const next = {};
    for (const [k, p] of entries) {
      const cur = snapshot(p.watch);
      const same = cur.every((c, i) => c === p.snap[i]);
      if (now < p.until && same) next[k] = p;
      else changed = true;
    }
    if (changed) pending = next;
  });

  /** @type {string|undefined} */
  let lastErr;
  $effect(() => {
    const ev = $states[E.commandErrors];
    if (!ev || unavailable(ev)) return;
    if (lastErr === undefined) {
      lastErr = ev.state;
      return;
    }
    if (ev.state === lastErr) return;
    lastErr = ev.state;
    const a = ev.attributes ?? {};
    const msg = a.message ?? a.error ?? a.detail ?? a.reason ?? a.event_type ?? 'onbekende fout';
    toast(`Auto: commando mislukt – ${msg}`, 'error', 7000);
    pending = {};
  });

  onMount(() => {
    const t = setInterval(() => (tick = Date.now()), 1000);
    return () => clearInterval(t);
  });

  /** @param {string} k */
  const busy = (k) => !!pending[k];
  /** @param {string} k @param {any} fallback */
  const want = (k, fallback) => (pending[k] && pending[k].want !== undefined ? pending[k].want : fallback);

  /** @param {string} key @param {string} id */
  function toggleSwitch(key, id) {
    const on = isOn(s(id));
    send(key, 'switch', on ? 'turn_off' : 'turn_on', id, { want: !on });
  }
  /** @param {string} key @param {string} id */
  const switchOn = (key, id) => !!want(key, isOn(s(id)));

  // A-01 status
  const soc = $derived(n(E.soc));
  const range = $derived(n(E.range));
  const charging = $derived(isOn(s(E.charging)));
  const chargingPower = $derived(n(E.chargingPower));
  const targetSoc = $derived(n(E.targetSoc));
  const lastUpdate = $derived(s(E.lastUpdate));
  const reach = $derived(s(E.reachability));
  const mileage = $derived(n(E.mileage));
  const interior = $derived(n(E.interiorTemperature));
  const exterior = $derived(n(E.exteriorTemperature));
  const kw = $derived(chargingPower != null ? `${num(s(E.chargingPower))} kW` : 'Laden');

  const lockEntity = $derived(s(E.lock));
  const lockStatus = $derived(s(E.lockStatus));
  const lockKnown = $derived(!unavailable(lockEntity) || !unavailable(lockStatus));
  const lockedReal = $derived.by(() => {
    if (!unavailable(lockEntity)) return lockEntity.state === 'locked' || lockEntity.state === 'locking';
    if (!unavailable(lockStatus)) return attr(lockStatus, 'device_class') === 'lock' ? lockStatus.state === 'off' : lockStatus.state === 'on';
    return null;
  });
  const locked = $derived(!!want('lock', lockedReal));

  const warnings = $derived(E.openings.filter((o) => isOn(s(o.entity))).map((o) => `${o.label} open`));

  // A-03 charging
  /** @param {string} id */
  const minutes = (id) => {
    const v = n(id);
    if (v == null) return null;
    const u = attr(s(id), 'unit_of_measurement');
    return u === 's' ? v / 60 : u === 'h' ? v * 60 : v;
  };
  const remaining = $derived(minutes(E.remainingChargingTime));
  const duration = $derived(minutes(E.chargingDuration));
  const rangeAfter = $derived(n(E.estimatedRangeAfterCharging));
  const targetEnt = $derived(s(E.targetSoc));
  const limitEnt = $derived(s(E.chargingCurrentLimit));
  const limitOptions = $derived(/** @type {string[]} */ (attr(limitEnt, 'options') ?? []).map((o) => ({ value: o, label: o })));

  // A-04 climate
  const climate = $derived(s(E.climate));
  /** @type {Record<string,string>} */
  const HVAC_LABELS = { off: 'Uit', heat_cool: 'Aan', auto: 'Auto', heat: 'Warm', cool: 'Koel', fan_only: 'Ventilatie', dry: 'Droog' };
  const hvacModes = $derived(/** @type {string[]} */ (attr(climate, 'hvac_modes') ?? []).map((m) => ({ value: m, label: HVAC_LABELS[m] ?? m, color: m === 'off' ? '' : m === 'cool' ? 'var(--cool)' : 'var(--heat)' })));
  const hvacMode = $derived(want('hvac', climate?.state));
  const climateOn = $derived(!!climate && !unavailable(climate) && hvacMode !== 'off');
  /** @type {Record<string,string>} */
  const SEAT_LABELS = { off: 'Uit', low: 'Laag', medium: 'Midden', mid: 'Midden', high: 'Hoog' };
  /** @param {string} id */
  const seatOptions = (id) => /** @type {string[]} */ (attr(s(id), 'options') ?? []).map((o) => ({ value: o, label: SEAT_LABELS[String(o).toLowerCase()] ?? o }));
  const seats = [
    { key: 'seatL', label: 'Links', sw: E.seatLeft, lvl: E.seatLeftLevel },
    { key: 'seatR', label: 'Rechts', sw: E.seatRight, lvl: E.seatRightLevel },
  ];
  /** @param {string} key @param {string[]} watch @param {any} want @param {number} ttl */
  const hold = (key, watch, want, ttl) => (pending = { ...pending, [key]: { watch, snap: snapshot(watch), until: Date.now() + ttl, want } });
  /** @param {string} key */
  const release = (key) => {
    const { [key]: _, ...rest } = pending;
    pending = rest;
  };
  /** Resolve after at least minMs once cond() holds, or after maxMs. */
  const waitFor = (/** @type {() => boolean} */ cond, minMs, maxMs) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const dt = Date.now() - t0;
        if ((dt >= minMs && cond()) || dt >= maxMs) {
          clearInterval(iv);
          resolve(undefined);
        }
      }, 250);
    });
  /**
   * Dropdown: 'off' turns the switch off. A level is selected first; once the car accepted it, the switch is
   * (always, even when already on) turned on as a separate command – the car needs both to actually heat.
   */
  async function setSeat(/** @type {typeof seats[number]} */ seat, /** @type {string} */ v) {
    const lk = seat.key + 'L';
    if (busy(seat.key) || busy(lk)) return;
    if (v === 'off' || v === '0') {
      release(lk);
      return send(seat.key, 'switch', 'turn_off', seat.sw, { want: false });
    }
    const level = v !== 'on';
    hold(seat.key, [seat.sw], true, WAIT_MS);
    if (level) hold(lk, [seat.lvl], v, WAIT_MS);
    try {
      if (level) {
        await callService('select', 'select_option', { option: v }, seat.lvl, 'Niveau verzonden…');
        await waitFor(() => s(seat.lvl)?.state === v, 1500, 5000);
      }
      const wasOn = isOn(s(seat.sw));
      await callService('switch', 'turn_on', {}, seat.sw, 'Stoelverwarming aan…');
      // An already-on switch will not change state: don't keep the spinner for the full timeout.
      if (wasOn) hold(seat.key, [seat.sw], true, 10e3);
    } catch {
      release(seat.key);
      release(lk);
    }
  }

  // A-05 other actions
  /** @type {Record<string,string>} */
  const SCHED_LABELS = { disabled: 'Uit', 'until configured soc': 'Tot doel-%', 'until configured time': 'Tot eindtijd' };
  const schedEnt = $derived(s(E.scheduledChargingMode));
  const schedOptions = $derived(/** @type {string[]} */ (attr(schedEnt, 'options') ?? []).map((o) => ({ value: o, label: SCHED_LABELS[String(o).toLowerCase()] ?? o })));
  const schedMode = $derived(want('sched', schedEnt?.state));
  const schedActive = $derived(!!schedMode && String(schedMode).toLowerCase() !== 'disabled');
  const bootOpen = $derived(isOn(s(BOOT)));
  const windowButtons = [
    { key: 'winOpen', label: 'Openen', id: E.windowsOpen },
    { key: 'winClose', label: 'Sluiten', id: E.windowsClose },
    { key: 'winVent', label: 'Ventileren', id: E.windowsVentilate },
  ];

  const tyres = $derived(E.tyres.map((t) => ({ label: t.label, value: n(t.entity), unit: attr(s(t.entity), 'unit_of_measurement') ?? 'bar' })));
  const tyresKnown = $derived(tyres.some((t) => t.value != null));
  const tyreAlert = $derived(tyres.some((t) => t.value != null && (t.value < 2.0 || t.value > 3.2)));

  const actionsVisible = $derived(['openBoot', 'triggerAlarm', 'chargingPortLock', 'holidayMode', 'batteryHeating', 'windows', 'scheduledCharging'].some(flag));

  // A-06 location
  const tracker = $derived(s(E.location));
  const lat = $derived(Number(attr(tracker, 'latitude')));
  const lon = $derived(Number(attr(tracker, 'longitude')));
  const hasPos = $derived(!!tracker && Number.isFinite(lat) && Number.isFinite(lon));
  const homeZone = $derived(s('zone.home'));
  const zone = $derived(homeZone ? { lat: Number(attr(homeZone, 'latitude')), lon: Number(attr(homeZone, 'longitude')), radius: Number(attr(homeZone, 'radius') ?? 100) } : null);
  const carSvg = `<svg viewBox="0 0 24 24"><path d="${mdiCarElectric}"/></svg>`;
  const markers = $derived(hasPos ? [{ id: 'car', lat, lon, label: 'MG4', color: '#14b8a6', icon: carSvg }] : []);
  const where = $derived(!tracker || unavailable(tracker) ? '' : tracker.state === 'home' ? 'Thuis' : tracker.state === 'not_home' ? 'Niet thuis' : tracker.state);
  const distHome = $derived.by(() => {
    if (!hasPos || !zone || !Number.isFinite(zone.lat) || !Number.isFinite(zone.lon)) return null;
    const R = 6371, toR = Math.PI / 180;
    const dLat = (lat - zone.lat) * toR, dLon = (lon - zone.lon) * toR;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(zone.lat * toR) * Math.cos(lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  });
  /** @param {number} km */
  const fmtDist = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);
  const locSub = $derived([where, distHome != null && tracker?.state !== 'home' ? `${fmtDist(distHome)} van thuis` : ''].filter(Boolean).join(' · '));
  const gmaps = $derived(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
  const amaps = $derived(`https://maps.apple.com/?ll=${lat},${lon}&q=MG4`);
</script>

<div class="auto-root">
  <div class="views">
    <Segmented options={VIEWS} value={view} onchange={setView} />
  </div>

{#if view === 'data'}
  <div in:fly={{ y: 10, duration: 260 }}>
    <AutoData />
  </div>
{:else if view === 'ritten'}
  <div in:fly={{ y: 10, duration: 260 }}>
    <Ritten />
  </div>
{:else if view === 'kosten'}
  <div in:fly={{ y: 10, duration: 260 }}>
    <Kosten />
  </div>
{:else}
<div class="auto stagger" in:fly={{ y: 10, duration: 260 }}>
  <!-- A-01 Status header -->
  <Card class="hero {charging ? 'charging' : ''}" pad={false} accent={charging ? '#facc15' : '#14b8a6'}>
    <div class="hero-in">
      <div class="spread">
        <div class="row">
          <span class="car-ic"><Icon path={mdiCarElectric} size={26} /></span>
          <div>
            <h2>MG4 Electric</h2>
            <div class="tiny muted row upd">
              {#if lastUpdate && !unavailable(lastUpdate)}Bijgewerkt {relTime(lastUpdate.state)}{:else}Laatste update onbekend{/if}
              {#if reach && !unavailable(reach)}
                <span>·</span><Icon path={mdiCarConnected} size={13} />{reach.state === 'online' ? 'Online' : reach.state}
              {/if}
            </div>
          </div>
        </div>
        <button class="btn icon soft refresh" title="Ververs" aria-label="Ververs" disabled={!s(E.refresh) || busy('refresh')}
          onclick={() => send('refresh', 'button', 'press', E.refresh, { watch: [E.lastUpdate, E.soc] })}>
          <span class="ri" class:spin={busy('refresh')}><Icon path={mdiRefresh} size={22} /></span>
        </button>
      </div>

      {#if busy('refresh')}
        <div class="waiting small" transition:slide><span class="spinner"></span>Wacht op auto…</div>
      {/if}

      <div class="hero-main">
        <BatteryRing {soc} {charging} target={targetSoc} />
        <div class="hero-stats">
          <div class="range">
            <span class="tiny muted">Bereik</span>
            <span class="huge num">{range != null ? Math.round(range) : '–'}<small> km</small></span>
          </div>
          <div class="chips">
            {#if lockKnown}
              <span class="pill" class:locked class:unlocked={!locked}>
                <Icon path={locked ? mdiLock : mdiLockOpenVariant} size={15} />{locked ? 'Vergrendeld' : 'Ontgrendeld'}
              </span>
            {/if}
            {#if charging}
              <span class="pill charge" in:scale><Icon path={mdiLightningBolt} size={15} />{kw}</span>
            {/if}
            {#if interior != null}<span class="pill"><Icon path={mdiThermometer} size={15} />Binnen {num(s(E.interiorTemperature))}°</span>{/if}
            {#if exterior != null}<span class="pill"><Icon path={mdiThermometer} size={15} />Buiten {num(s(E.exteriorTemperature))}°</span>{/if}
            {#if mileage != null}<span class="pill"><Icon path={mdiCounter} size={15} />{Math.round(mileage).toLocaleString('nl-BE')} km</span>{/if}
          </div>
        </div>
      </div>

      {#if warnings.length}
        <div class="warnings">
          {#each warnings as w (w)}
            <span class="warn-chip" transition:scale={{ start: 0.85 }}><Icon path={mdiAlertCircle} size={16} />{w}</span>
          {/each}
        </div>
      {/if}
    </div>
  </Card>

  <div class="grid">
    <!-- A-02 Slot -->
    <Card title="Slot" iconPath={locked ? mdiLock : mdiLockOpenVariant} accent={locked ? 'var(--ok)' : 'var(--warn)'}>
      {#if unavailable(lockEntity)}
        <EmptyState iconPath={mdiLock} text="Niet beschikbaar" />
      {:else}
        <button class="lockbtn" class:locked class:busy={busy('lock')} disabled={busy('lock')}
          onclick={() => send('lock', 'lock', locked ? 'unlock' : 'lock', E.lock, { watch: [E.lock, E.lockStatus], want: !locked })}>
          <span class="lock-ic">
            {#key locked}
              <span class="lock-swap" in:scale={{ start: 0.4, duration: 450 }}><Icon path={locked ? mdiLock : mdiLockOpenVariant} size={34} /></span>
            {/key}
          </span>
          <span class="col lock-txt">
            <b>{busy('lock') ? 'Wacht op auto…' : locked ? 'Ontgrendelen' : 'Vergrendelen'}</b>
            <span class="small muted">{locked ? 'Auto is vergrendeld' : 'Auto is niet vergrendeld'}</span>
          </span>
          {#if busy('lock')}<span class="spinner"></span>{/if}
        </button>
      {/if}
    </Card>

    <!-- A-03 Opladen -->
    {#if charging}
      <div class="charge-wrap" transition:slide>
        <Card title="Opladen" iconPath={mdiEvStation} accent="#facc15" glow>
          {#snippet actions()}
            <Badge kind="warn" pulse text={kw} />
          {/snippet}
          <div class="flowbar" style="--from:{soc ?? 0}%;--to:{targetSoc ?? 100}%">
            <span class="fb-fill"></span>
            <span class="fb-target"></span>
          </div>
          <div class="tiny muted spread fb-legend">
            <span>Nu {soc != null ? `${Math.round(soc)}%` : '–'}</span><span>Doel {targetSoc != null ? `${Math.round(targetSoc)}%` : '–'}</span>
          </div>

          <div class="stats">
            <div class="st"><Icon path={mdiLightningBolt} size={20} /><span class="tiny">Vermogen</span><b class="num">{chargingPower != null ? kw : '–'}</b></div>
            <div class="st"><Icon path={mdiTimerSand} size={20} /><span class="tiny">Tijd tot vol</span><b class="num">{remaining != null ? fmtDuration(remaining) : '–'}</b></div>
            <div class="st"><Icon path={mdiTimerOutline} size={20} /><span class="tiny">Aan het laden</span><b class="num">{duration != null ? fmtDuration(duration) : '–'}</b></div>
            <div class="st"><Icon path={mdiMapMarkerDistance} size={20} /><span class="tiny">Bereik na laden</span><b class="num">{rangeAfter != null ? `${Math.round(rangeAfter)} km` : '–'}</b></div>
          </div>

          {#if targetEnt && !unavailable(targetEnt)}
            <div class="spread ctl">
              <span class="col"><b>Doel-laadniveau</b><span class="tiny muted">Stopt bij dit percentage</span></span>
              <Stepper value={Number(targetEnt.state)} step={Number(attr(targetEnt, 'step') ?? 10)} min={Number(attr(targetEnt, 'min') ?? 40)}
                max={Number(attr(targetEnt, 'max') ?? 100)} unit="%" digits={0} disabled={busy('target')}
                onchange={(v) => send('target', 'number', 'set_value', E.targetSoc, { data: { value: v } })} />
            </div>
          {/if}

          {#if limitEnt && !unavailable(limitEnt) && limitOptions.length}
            <div class="ctl col">
              <span class="row"><Icon path={mdiCurrentAc} size={18} /><b>Laadstroom</b></span>
              <Segmented size="sm" value={want('limit', limitEnt.state)} disabled={busy('limit')} options={limitOptions}
                onchange={(v) => send('limit', 'select', 'select_option', E.chargingCurrentLimit, { data: { option: v }, want: v })} />
            </div>
          {/if}

          <button class="btn danger block stop" disabled={busy('charge')} onclick={() => send('charge', 'switch', 'turn_off', E.charging)}>
            {#if busy('charge')}<span class="spinner"></span>Wacht op auto…{:else}<Icon path={mdiPower} size={20} />Laden stoppen{/if}
          </button>
        </Card>
      </div>
    {/if}

    <!-- A-04 Klimaat -->
    <Card title="Klimaat" iconPath={mdiFan} accent={climateOn ? 'var(--heat)' : ''} glow={climateOn}>
      {#snippet actions()}
        {#if busy('hvac') || busy('temp')}<Badge kind="info" pulse text="Wacht op auto…" />{:else if climateOn}<Badge kind="accent" text="Aan" />{/if}
      {/snippet}
      {#if !climate || unavailable(climate)}
        <EmptyState iconPath={mdiFan} text="Niet beschikbaar" />
      {:else}
        <div class="clim">
          <span class="fan" class:on={climateOn}><Icon path={mdiFan} size={44} /></span>
          <div class="col grow clim-temps">
            <span class="small muted">
              Binnen <b class="num">{interior != null ? `${num(s(E.interiorTemperature))}°` : '–'}</b> · Buiten <b class="num">{exterior != null ? `${num(s(E.exteriorTemperature))}°` : '–'}</b>
            </span>
            {#if attr(climate, 'temperature') != null}
              <Stepper value={Number(attr(climate, 'temperature'))} step={Number(attr(climate, 'target_temp_step') ?? 0.5)}
                min={Number(attr(climate, 'min_temp') ?? 16)} max={Number(attr(climate, 'max_temp') ?? 28)} disabled={busy('temp')}
                onchange={(v) => send('temp', 'climate', 'set_temperature', E.climate, { data: { temperature: v } })} />
            {/if}
          </div>
        </div>
        {#if hvacModes.length}
          <Segmented options={hvacModes} value={hvacMode} disabled={busy('hvac')}
            onchange={(v) => send('hvac', 'climate', 'set_hvac_mode', E.climate, { data: { hvac_mode: v }, want: v })} />
        {/if}
      {/if}

      <div class="grid-2 quick">
        <Tile label="Alles bestuurder" sub={busy('driver') ? 'Wacht op auto…' : 'Klimaat + stoel'} iconPath={mdiAccountTie} color="#f97316"
          busy={busy('driver')} disabled={!s(E.driverAll)}
          onclick={() => send('driver', 'script', 'turn_on', E.driverAll, { watch: [E.climate, E.seatLeft, E.frontDefrost] })} />
        <Tile label="Alles ontdooien" sub={busy('defrostAll') ? 'Wacht op auto…' : 'Voor + achter'} iconPath={mdiSnowflakeMelt} color="#38bdf8"
          busy={busy('defrostAll')} disabled={!s(E.defrostAll)}
          onclick={() => send('defrostAll', 'script', 'turn_on', E.defrostAll, { watch: [E.frontDefrost, E.rearDefrost, E.climate] })} />
        <Tile label="Voorruit" sub={busy('front') ? 'Wacht op auto…' : switchOn('front', E.frontDefrost) ? 'Ontdooit' : 'Uit'} iconPath={mdiCarDefrostFront}
          color="#38bdf8" active={switchOn('front', E.frontDefrost)} busy={busy('front')} disabled={unavailable(s(E.frontDefrost))}
          onclick={() => toggleSwitch('front', E.frontDefrost)}>
          {#if switchOn('front', E.frontDefrost)}<span class="heatwave"></span>{/if}
        </Tile>
        <Tile label="Achterruit" sub={busy('rear') ? 'Wacht op auto…' : switchOn('rear', E.rearDefrost) ? 'Ontdooit' : 'Uit'} iconPath={mdiCarDefrostRear}
          color="#38bdf8" active={switchOn('rear', E.rearDefrost)} busy={busy('rear')} disabled={unavailable(s(E.rearDefrost))}
          onclick={() => toggleSwitch('rear', E.rearDefrost)}>
          {#if switchOn('rear', E.rearDefrost)}<span class="heatwave"></span>{/if}
        </Tile>
        {#if flag('steeringWheel')}
          <Tile label="Stuurverwarming" sub={busy('wheel') ? 'Wacht op auto…' : switchOn('wheel', E.steeringWheel) ? 'Aan' : 'Uit'} iconPath={mdiSteering}
            color="var(--heat)" active={switchOn('wheel', E.steeringWheel)} busy={busy('wheel')} disabled={unavailable(s(E.steeringWheel))}
            onclick={() => toggleSwitch('wheel', E.steeringWheel)} />
        {/if}
      </div>

      <div class="section-title seat-title">Stoelverwarming</div>
      <div class="seats">
        {#each seats as seat (seat.key)}
          {@const on = switchOn(seat.key, seat.sw)}
          {@const na = unavailable(s(seat.sw))}
          {@const lvl = s(seat.lvl)}
          {@const opts = seatOptions(seat.lvl).filter((o) => String(o.value).toLowerCase() !== 'off')}
          {@const value = on ? (lvl && !unavailable(lvl) ? want(seat.key + 'L', lvl.state) : 'on') : 'off'}
          {@const working = busy(seat.key) || busy(seat.key + 'L')}
          <label class="seat" class:on>
            <span class="seat-ic">{#if working}<span class="spinner"></span>{:else}<Icon path={mdiCarSeatHeater} size={26} />{/if}</span>
            <span class="col grow" style="min-width:0">
              <b>{seat.label}</b>
              <span class="seat-sel">
                <select class="input" {value} disabled={na || working} onchange={(e) => setSeat(seat, e.currentTarget.value)} aria-label="Stoelverwarming {seat.label}">
                  <option value="off">Uit</option>
                  {#if opts.length && lvl && !unavailable(lvl)}
                    {#each opts as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
                  {:else}
                    <option value="on">Aan</option>
                  {/if}
                </select>
              </span>
              {#if na || working}<span class="tiny muted">{na ? 'Niet beschikbaar' : 'Wacht op auto…'}</span>{/if}
            </span>
          </label>
        {/each}
      </div>
    </Card>

    <!-- A-05 Overige acties -->
    {#if actionsVisible}
      <Card title="Overige acties" iconPath={mdiCarBack}>
        <div class="grid-2">
          {#if flag('openBoot')}
            <Tile label="Kofferbak openen" sub={busy('boot') ? 'Wacht op auto…' : bootOpen ? 'Staat open' : 'Gesloten'} iconPath={mdiCarBack}
              color="#8b5cf6" busy={busy('boot')} disabled={!s(E.openBoot)} active={bootOpen}
              onclick={() => send('boot', 'button', 'press', E.openBoot, { watch: BOOT ? [BOOT] : [], ttl: BOOT ? WAIT_MS : 10e3 })} />
          {/if}
          {#if flag('triggerAlarm')}
            <Tile label="Alarm activeren" sub={busy('alarm') ? 'Verzonden…' : 'Claxon + lichten'} iconPath={mdiAlarmLight} color="var(--danger)"
              busy={busy('alarm')} disabled={!s(E.triggerAlarm)}
              onclick={() => send('alarm', 'button', 'press', E.triggerAlarm, { watch: [], ttl: 10e3 })} />
          {/if}
          {#if flag('chargingPortLock')}
            <Tile label="Laadpoort" sub={busy('port') ? 'Wacht op auto…' : switchOn('port', E.chargingPortLock) ? 'Vergrendeld' : 'Ontgrendeld'} iconPath={mdiEvPlugType2}
              color="var(--ok)" active={switchOn('port', E.chargingPortLock)} busy={busy('port')} disabled={unavailable(s(E.chargingPortLock))}
              onclick={() => toggleSwitch('port', E.chargingPortLock)} />
          {/if}
          {#if flag('holidayMode')}
            <Tile label="Vakantiemodus" sub={busy('holiday') ? 'Wacht op auto…' : switchOn('holiday', E.holidayMode) ? 'Aan' : 'Uit'} iconPath={mdiPalmTree}
              color="#14b8a6" active={switchOn('holiday', E.holidayMode)} busy={busy('holiday')} disabled={unavailable(s(E.holidayMode))}
              onclick={() => toggleSwitch('holiday', E.holidayMode)} />
          {/if}
          {#if flag('batteryHeating')}
            <Tile label="Batterijverwarming" sub={busy('bheat') ? 'Wacht op auto…' : switchOn('bheat', E.batteryHeating) ? 'Verwarmt' : 'Uit'} iconPath={mdiBatteryHeart}
              color="var(--heat)" active={switchOn('bheat', E.batteryHeating)} busy={busy('bheat')} disabled={unavailable(s(E.batteryHeating))}
              onclick={() => toggleSwitch('bheat', E.batteryHeating)} />
          {/if}
        </div>

        {#if flag('windows')}
          <div class="section-title sub-title">Ramen</div>
          <div class="row wrap win">
            {#each windowButtons as w (w.key)}
              <button class="btn soft grow" disabled={!s(w.id) || busy(w.key)} onclick={() => send(w.key, 'button', 'press', w.id, { watch: [], ttl: 15e3 })}>
                {#if busy(w.key)}<span class="spinner"></span>{:else}<Icon path={mdiWindowOpenVariant} size={18} />{/if}{w.label}
              </button>
            {/each}
          </div>
        {/if}

        {#if flag('batteryHeating') && (s(E.batteryHeatingSchedule) || s(E.batteryHeatingTime))}
          <div class="sched">
            <div class="spread">
              <span class="row"><Icon path={mdiCalendarClock} size={18} /><b>Batterij voorverwarmen</b></span>
              <Toggle checked={switchOn('bheatSched', E.batteryHeatingSchedule)} disabled={unavailable(s(E.batteryHeatingSchedule)) || busy('bheatSched')}
                onchange={(v) => send('bheatSched', 'switch', v ? 'turn_on' : 'turn_off', E.batteryHeatingSchedule, { want: v })} />
            </div>
            {#if s(E.batteryHeatingTime) && !unavailable(s(E.batteryHeatingTime))}
              <div class="spread">
                <span class="small muted">Tijdstip</span>
                <TimeField value={s(E.batteryHeatingTime).state} disabled={busy('bheatTime')}
                  onchange={(v) => send('bheatTime', 'time', 'set_value', E.batteryHeatingTime, { data: { time: v } })} />
              </div>
            {/if}
          </div>
        {/if}

        {#if flag('scheduledCharging') && schedEnt && !unavailable(schedEnt)}
          <div class="sched">
            <span class="row"><Icon path={mdiEvStation} size={18} /><b class="grow">Gepland laden</b>{#if busy('sched')}<Badge kind="info" pulse text="Wacht…" />{/if}</span>
            {#if schedOptions.length}
              <Segmented size="sm" options={schedOptions} value={schedMode} disabled={busy('sched')}
                onchange={(v) => send('sched', 'select', 'select_option', E.scheduledChargingMode, { data: { option: v }, want: v })} />
            {/if}
            {#if schedActive}
              <div class="times" transition:slide>
                <div class="tfield"><span class="tiny muted">Start</span>
                  <TimeField value={s(E.scheduledChargingStart)?.state} disabled={unavailable(s(E.scheduledChargingStart)) || busy('schedStart')}
                    onchange={(v) => send('schedStart', 'time', 'set_value', E.scheduledChargingStart, { data: { time: v } })} />
                </div>
                <span class="arrow muted">→</span>
                <div class="tfield"><span class="tiny muted">Einde</span>
                  <TimeField value={s(E.scheduledChargingEnd)?.state} disabled={unavailable(s(E.scheduledChargingEnd)) || busy('schedEnd')}
                    onchange={(v) => send('schedEnd', 'time', 'set_value', E.scheduledChargingEnd, { data: { time: v } })} />
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </Card>
    {/if}

    {#if flag('tyres')}
      <Card title="Bandenspanning" iconPath={mdiCarTireAlert} accent={tyreAlert ? 'var(--danger)' : 'var(--ok)'}>
        {#snippet actions()}
          {#if tyresKnown}<Badge kind={tyreAlert ? 'danger' : 'ok'} pulse={tyreAlert} text={tyreAlert ? 'Controleren' : 'In orde'} />{/if}
        {/snippet}
        {#if tyresKnown}
          <TyreView {tyres} />
        {:else}
          <EmptyState iconPath={mdiCarTireAlert} text="Niet beschikbaar" />
        {/if}
      </Card>
    {/if}

    <!-- A-06 Locatie -->
    {#if flag('location')}
      <Card title="Locatie" iconPath={mdiMapMarker} subtitle={locSub} class="loc">
        {#if hasPos}
          <div in:fly={{ y: 12 }}>
            <MapView {markers} {zone} height="240px" zoom={15} />
          </div>
          <div class="row maplinks">
            <a class="btn soft grow" href={gmaps} target="_blank" rel="noopener noreferrer"><Icon path={mdiGoogleMaps} size={18} />Google Maps</a>
            <a class="btn soft grow" href={amaps} target="_blank" rel="noopener noreferrer"><Icon path={mdiOpenInNew} size={18} />Apple Kaarten</a>
          </div>
        {:else}
          <EmptyState iconPath={mdiMapMarker} text="Niet beschikbaar" />
        {/if}
      </Card>
    {/if}
  </div>
</div>
{/if}
</div>

<style>
  .auto-root { display: flex; flex-direction: column; gap: var(--gap); padding-bottom: 10px; }
  .views { max-width: 560px; width: 100%; margin: 0 auto; }
  .auto { display: flex; flex-direction: column; gap: var(--gap); }

  .hero-in { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 12px; }
  h2 { font-size: 1.25rem; margin: 0; }
  .upd { gap: 4px; flex-wrap: wrap; }
  .car-ic { width: 46px; height: 46px; flex: none; border-radius: 16px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #14b8a6, #0ea5e9); box-shadow: 0 8px 22px -8px #14b8a6; transition: background 0.6s; }
  :global(.card.hero.charging) .car-ic { background: linear-gradient(135deg, #facc15, #f97316); box-shadow: 0 8px 22px -6px #facc15; }
  .refresh { width: 44px; height: 44px; flex: none; }
  .ri { display: grid; place-items: center; }
  .waiting { display: flex; align-items: center; gap: 8px; color: var(--info); font-weight: 600; }
  .hero-main { display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; }
  .hero-stats { display: flex; flex-direction: column; gap: 12px; min-width: 0; flex: 1 1 180px; }
  .range { display: flex; flex-direction: column; }
  .range .huge { line-height: 1.05; }
  .range small { font-size: 0.45em; color: var(--text-2); font-weight: 700; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; background: var(--surface-2); color: var(--text-2); animation: pop 0.4s var(--spring); }
  .pill.locked { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
  .pill.unlocked { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
  .pill.charge { background: color-mix(in srgb, #facc15 22%, transparent); color: #ca8a04; animation: pop 0.4s var(--spring); }
  @keyframes charge-glow { 50% { box-shadow: 0 0 18px -2px color-mix(in srgb, #facc15 70%, transparent); } }
  .warnings { display: flex; flex-wrap: wrap; gap: 6px; }
  .warn-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 14px; font-weight: 700; font-size: 0.85rem; color: var(--warn); background: color-mix(in srgb, var(--warn) 15%, transparent); border: 1px solid color-mix(in srgb, var(--warn) 35%, transparent); animation: wiggle 0.6s ease-in-out 0.3s 2; }

  .spinner { width: 18px; height: 18px; flex: none; border-radius: 50%; border: 2.5px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; }

  .lockbtn {
    --lc: var(--warn);
    --glow: var(--lc);
    width: 100%; min-height: 88px; display: flex; align-items: center; gap: 16px; padding: 14px 18px; border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--lc) 40%, transparent); cursor: pointer; text-align: left; color: var(--text); font: inherit;
    background: linear-gradient(135deg, color-mix(in srgb, var(--lc) 18%, var(--surface-2)), var(--surface-2));
    transition: transform 0.2s var(--spring), background 0.5s, border-color 0.5s, box-shadow 0.5s;
    box-shadow: 0 12px 30px -18px var(--lc);
  }
  .lockbtn.locked { --lc: var(--ok); }
  .lockbtn:active { transform: scale(0.97); }
  .lockbtn:disabled { cursor: progress; }
  .lockbtn.busy { animation: glow 1.6s ease-in-out infinite; }
  .lock-ic { width: 60px; height: 60px; flex: none; border-radius: 20px; display: grid; place-items: center; color: #fff; background: var(--lc); box-shadow: 0 8px 24px -6px var(--lc); transition: background 0.5s; }
  .lock-swap { display: grid; place-items: center; }
  .lock-txt { flex: 1; gap: 2px; }
  .lock-txt b { font-size: 1.15rem; }

  .flowbar { position: relative; height: 16px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
  .fb-fill { position: absolute; top: 0; bottom: 0; left: 0; width: var(--from); border-radius: 999px; background: repeating-linear-gradient(-45deg, #facc15 0 10px, #f59e0b 10px 20px); background-size: 28.28px 28.28px; animation: stripes 0.9s linear infinite, grow 1.2s var(--ease); box-shadow: 0 0 16px -2px #facc15; transition: width 1s var(--ease); }
  .fb-target { position: absolute; top: 0; bottom: 0; left: calc(var(--to) - 2px); width: 3px; background: var(--text); opacity: 0.6; border-radius: 2px; }
  @keyframes stripes { to { background-position: 28.28px 0; } }
  @keyframes grow { from { width: 0; } }
  .fb-legend { margin: 4px 2px 12px; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .st { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); color: #d97706; }
  .st > :global(svg) { grid-row: 1 / 3; }
  .st span { color: var(--text-2); }
  .st b { color: var(--text); }
  .ctl { margin-top: 14px; gap: 8px; }
  .stop { margin-top: 16px; min-height: 48px; gap: 8px; }

  .clim { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
  .clim-temps { gap: 8px; align-items: flex-start; }
  .fan { width: 70px; height: 70px; flex: none; border-radius: 22px; display: grid; place-items: center; background: var(--surface-2); color: var(--text-3); transition: background 0.5s, color 0.5s, box-shadow 0.5s; }
  .fan.on { color: #fff; background: linear-gradient(135deg, var(--heat), #f97316); box-shadow: 0 10px 26px -10px var(--heat); }
  .fan.on :global(svg) { animation: spin 3s linear infinite; }
  .quick { margin-top: 14px; }
  .heatwave { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: linear-gradient(90deg, transparent, #38bdf8, transparent); background-size: 200% 100%; animation: shimmer 1.6s linear infinite; }
  .seat-title { margin-top: 16px; }
  .seats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .seat { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 16px; background: var(--surface-2); transition: background 0.4s; min-width: 0; }
  .seat b { line-height: 1.2; }
  .seat-sel select { width: 100%; margin-top: 4px; padding: 8px 28px 8px 10px; font-size: 0.9rem; text-overflow: ellipsis; background-position: calc(100% - 15px) 50%, calc(100% - 10px) 50%; }
  .seat.on { background: color-mix(in srgb, var(--heat) 14%, var(--surface-2)); }
  .seat-ic { width: 38px; height: 38px; flex: none; border-radius: 12px; display: grid; place-items: center; background: var(--surface-3); color: var(--text-2); transition: background 0.4s, color 0.4s, box-shadow 0.4s, transform 0.4s var(--spring); }
  .seat.on .seat-ic { background: var(--heat); color: #fff; box-shadow: 0 6px 18px -4px var(--heat); transform: rotate(-6deg); }


  .sub-title { margin-top: 14px; }
  .win { gap: 8px; }
  .win .btn { gap: 6px; min-height: 44px; }
  .sched { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; padding: 12px; border-radius: 16px; background: var(--surface-2); }
  .sched .row { gap: 8px; }
  .times { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .tfield { display: flex; flex-direction: column; gap: 4px; }
  .arrow { padding-bottom: 12px; font-weight: 800; }

  .maplinks { gap: 8px; margin-top: 12px; }
  .maplinks .btn { gap: 6px; min-height: 44px; text-decoration: none; }
</style>

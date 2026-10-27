<script>
  import { untrack } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { mdiPlay, mdiPause, mdiCrosshairsGps, mdiClockFast } from '@mdi/js';
  import { HOME } from '$shared/config.js';
  import { states, user } from '../../lib/api.js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import Slider from '../../components/Slider.svelte';

  /** @type {{ open?: boolean }} */
  let { open = $bindable(false) } = $props();

  const BR_API = 'https://image-lite.buienradar.nl/3.0/metadata/RadarMapRainWebMercatorNL?history=12&forecast=24&skip=0';
  // Area covered by the Buienradar Benelux images (web mercator, south-west / north-east corners).
  const BR_BOUNDS = L.latLngBounds([49.5, 0], [54.8, 10]);
  const RV_API = 'https://api.rainviewer.com/public/weather-maps.json';
  // RainViewer only serves radar tiles up to zoom 7; Leaflet upscales them beyond that.
  const RADAR_MAX_ZOOM = 7;
  const ZOOM = 8;

  /**
   * One radar image. `key` identifies its map layer; `forecast` frames come after the last observed image.
   * @typedef {{ time: number, key: string, url: string, forecast: boolean }} Frame
   */
  /** @type {Frame[]} */
  let frames = $state([]);
  let source = $state(/** @type {'buienradar'|'rainviewer'} */ ('buienradar'));
  let idx = $state(0);
  let playing = $state(true);
  let failed = $state(false);
  let loading = $state(true);

  const coord = (s) => {
    const lat = Number(s?.attributes?.latitude);
    const lon = Number(s?.attributes?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  };
  const me = $derived($user?.person ? coord($states[$user.person]) : null);
  const home = $derived(coord($states[HOME.zone]));
  const here = $derived(me ?? home ?? { lat: 51.13, lon: 4.34 });
  const hereLabel = $derived(me ? 'Jij' : 'Thuis');
  const inBenelux = (/** @type {{lat:number,lon:number}} */ p) => BR_BOUNDS.pad(-0.05).contains([p.lat, p.lon]);

  /** Index of the last observed (non-forecast) frame: "now" on the timeline. Forecast frames always come last. */
  const nowIdx = $derived(Math.max(0, frames.filter((f) => !f.forecast).length - 1));
  const hasForecast = $derived(frames.some((f) => f.forecast));
  const future = $derived(!!frames[idx]?.forecast);

  /** Buienradar: last hour + 2 hour forecast, Benelux only. Timestamps are UTC without zone. */
  async function loadBuienradar() {
    const r = await fetch(BR_API, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    const still = Date.parse(`${d.stilltimestamp}Z`) / 1000;
    /** @type {Frame[]} */
    const list = (d.times ?? []).map((t) => {
      const time = Date.parse(`${t.timestamp}Z`) / 1000;
      return { time, key: t.url, url: t.url, forecast: time > still };
    });
    return list.filter((f) => Number.isFinite(f.time));
  }

  /** RainViewer: last 2 hours, worldwide (its free API no longer has a forecast). */
  async function loadRainViewer() {
    const r = await fetch(RV_API, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    const past = (d.radar?.past ?? []).map((f) => ({ time: f.time, key: f.path, url: `${d.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, forecast: false }));
    const cast = (d.radar?.nowcast ?? []).map((f) => ({ time: f.time, key: f.path, url: `${d.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, forecast: true }));
    return [...past, ...cast];
  }

  async function load() {
    try {
      /** @type {'buienradar'|'rainviewer'} */
      const wanted = inBenelux(here) ? 'buienradar' : 'rainviewer';
      /** @type {'buienradar'|'rainviewer'} */
      let src = wanted;
      let list = [];
      try {
        list = wanted === 'buienradar' ? await loadBuienradar() : await loadRainViewer();
      } catch (err) {
        if (wanted !== 'buienradar') throw err;
      }
      if (!list.length && wanted === 'buienradar') {
        src = 'rainviewer';
        list = await loadRainViewer();
      }
      if (!list.length) throw new Error('no frames');
      const shownTime = frames[idx]?.time;
      const wasNow = !frames.length || idx === nowIdx;
      source = src;
      frames = list;
      const same = list.findIndex((f) => f.time === shownTime);
      idx = wasNow || same < 0 ? nowIdx : same;
      failed = false;
    } catch {
      failed = !frames.length;
    } finally {
      loading = false;
    }
  }

  function retry() {
    loading = true;
    failed = false;
    load();
  }

  $effect(() => {
    if (!open) return;
    untrack(() => {
      loading = !frames.length;
      playing = true;
      if (frames.length) idx = nowIdx;
      load();
    });
    const t = setInterval(load, 5 * 60e3);
    return () => clearInterval(t);
  });

  // Loop through the frames, pausing a little longer on "now" and on the last frame.
  $effect(() => {
    if (!open || !playing || frames.length < 2) return;
    const t = setTimeout(() => {
      idx = (idx + 1) % frames.length;
    }, idx === nowIdx || idx === frames.length - 1 ? 1600 : 500);
    return () => clearTimeout(t);
  });

  const hhmm = (/** @type {number} */ t) => new Date(t * 1000).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  /** Minutes relative to the last observed image. */
  const offset = (/** @type {number} */ i) => Math.round(((frames[i]?.time ?? 0) - (frames[nowIdx]?.time ?? 0)) / 60);
  const rel = (/** @type {number} */ min) => (min === 0 ? 'nu' : `${min > 0 ? '+' : '−'}${Math.abs(min) >= 60 && Math.abs(min) % 60 === 0 ? `${Math.abs(min) / 60} u` : `${Math.abs(min)} min`}`);
  function stamp(/** @type {number} */ i) {
    const f = frames[i];
    if (!f) return '–';
    const min = offset(i);
    if (min === 0) return `${hhmm(f.time)} · laatste beeld`;
    return `${hhmm(f.time)} · ${rel(min)}${f.forecast ? ' · verwachting' : ''}`;
  }

  // Timeline: solid past, a "now" line, and a hatched forecast part (filled lighter once played).
  const nowPct = $derived(frames.length > 1 ? (nowIdx / (frames.length - 1)) * 100 : 100);
  const track = $derived(
    hasForecast
      ? [
          `linear-gradient(90deg, transparent calc(${nowPct}% - 1.5px), var(--text) calc(${nowPct}% - 1.5px), var(--text) calc(${nowPct}% + 1.5px), transparent calc(${nowPct}% + 1.5px))`,
          `linear-gradient(90deg, var(--accent) min(var(--pct), ${nowPct}%), transparent min(var(--pct), ${nowPct}%))`,
          `linear-gradient(90deg, transparent ${nowPct}%, var(--future) ${nowPct}%, var(--future) var(--pct), transparent var(--pct))`,
          `linear-gradient(90deg, var(--surface-3) ${nowPct}%, transparent ${nowPct}%)`,
          'repeating-linear-gradient(135deg, var(--surface-3) 0 6px, var(--surface-2) 6px 12px)',
        ].join(', ')
      : '',
  );

  /** @type {L.Map|null} */
  let map = null;
  function recenter() {
    map?.setView([here.lat, here.lon], ZOOM);
  }

  /** Leaflet map with one tile layer per radar frame (all preloaded, only the current one visible). */
  function radarMap(/** @type {HTMLElement} */ el) {
    const m = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 5, maxZoom: 12 }).setView([here.lat, here.lon], ZOOM);
    map = m;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap', className: 'base-tile' }).addTo(m);
    /** @type {Map<string, L.TileLayer|L.ImageOverlay>} */
    const layers = new Map();
    const pin = L.marker([here.lat, here.lon], {
      icon: L.divIcon({ className: 'radar-me', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 1000,
      keyboard: false,
    }).addTo(m);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el);

    const stop = $effect.root(() => {
      $effect(() => {
        const seen = new Set();
        for (const f of frames) {
          seen.add(f.key);
          if (layers.has(f.key)) continue;
          const l = source === 'buienradar'
            ? L.imageOverlay(f.url, BR_BOUNDS, { opacity: 0, zIndex: 10, attribution: '© Buienradar' })
            : L.tileLayer(f.url, { opacity: 0, maxNativeZoom: RADAR_MAX_ZOOM, maxZoom: 12, zIndex: 10, attribution: '© RainViewer' });
          l.addTo(m);
          layers.set(f.key, l);
        }
        for (const [k, l] of layers) {
          if (seen.has(k)) continue;
          m.removeLayer(l);
          layers.delete(k);
        }
      });
      $effect(() => {
        const cur = frames[idx]?.key;
        for (const [k, l] of layers) l.setOpacity(k === cur ? 0.75 : 0);
      });
      $effect(() => {
        pin.setLatLng([here.lat, here.lon]);
      });
    });

    return {
      destroy() {
        stop();
        ro.disconnect();
        m.remove();
        map = null;
      },
    };
  }
</script>

<Sheet bind:open title="Buienradar">
  <div class="radar no-swipe">
    <div class="map" use:radarMap></div>
    {#if loading}<div class="ph skeleton"></div>{/if}
    {#if failed}
      <div class="ph err">
        <Icon name="wifiOff" size={28} />
        <span>Radarbeelden konden niet geladen worden</span>
        <button class="btn ghost" onclick={retry}>Opnieuw</button>
      </div>
    {/if}
    <button class="btn icon locate" title="Centreer op {hereLabel === 'Jij' ? 'jouw locatie' : 'thuis'}" onclick={recenter}><Icon path={mdiCrosshairsGps} size={18} /></button>
    {#if future}
      <div class="badge-future"><Icon path={mdiClockFast} size={16} /> Verwachting {rel(offset(idx))}</div>
    {/if}
  </div>

  <div class="time">
    <button class="btn icon soft" title={playing ? 'Pauzeer' : 'Afspelen'} disabled={frames.length < 2} onclick={() => (playing = !playing)}>
      <Icon path={playing ? mdiPause : mdiPlay} size={20} />
    </button>
    <div class="grow" class:future style="--future: color-mix(in srgb, var(--accent) 45%, var(--surface-3))">
      <Slider
        value={idx}
        min={0}
        max={Math.max(0, frames.length - 1)}
        step={1}
        disabled={frames.length < 2}
        label={future ? 'Verwachting' : 'Tijd'}
        format={stamp}
        {track}
        oninput={(v) => { playing = false; idx = v; }}
        onchange={(v) => { playing = false; idx = v; }}
      />
      {#if hasForecast}
        <div class="ticks tiny muted">
          <span>{rel(offset(0))}</span>
          <span class="now" style="left:{nowPct}%">Nu</span>
          <span class="fc">Verwachting {rel(offset(frames.length - 1))}</span>
        </div>
      {/if}
    </div>
  </div>
  <p class="tiny muted note">
    {hasForecast ? 'Neerslag van het afgelopen uur en verwachting voor de komende 2 uur' : 'Neerslag van de afgelopen 2 uur'}
    · <span class="dot"></span> {hereLabel === 'Jij' ? 'jouw locatie' : 'thuis'} · bron: {source === 'buienradar' ? 'Buienradar' : 'RainViewer'}
  </p>
</Sheet>

<style>
  .radar { position: relative; width: 100%; height: min(62dvh, 460px); border-radius: 16px; overflow: hidden; background: var(--surface-2); isolation: isolate; }
  .map { position: absolute; inset: 0; z-index: 0; }
  :global([data-mode='dark']) .map :global(.base-tile) { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6); }
  .map :global(.leaflet-control-attribution) { font-size: 9px; background: color-mix(in srgb, var(--surface-solid) 70%, transparent); color: var(--text-3); }
  .ph { position: absolute; inset: 0; z-index: 500; }
  .err { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-2); text-align: center; padding: 16px; background: var(--surface-2); }
  .locate { position: absolute; top: 10px; right: 10px; z-index: 600; background: var(--surface-solid); box-shadow: var(--shadow); }
  .time { display: flex; align-items: flex-start; gap: 12px; margin-top: 12px; }
  .time .btn { flex-shrink: 0; width: 38px; height: 38px; padding: 0; margin-top: 27px; }
  .future :global(.val) { color: var(--accent); }
  .ticks { position: relative; display: flex; justify-content: space-between; margin-top: 6px; height: 1.2em; }
  .ticks .now { position: absolute; transform: translateX(-50%); font-weight: 700; color: var(--text); }
  .ticks .fc { font-style: italic; }
  .badge-future {
    position: absolute; top: 10px; left: 10px; z-index: 600; display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; color: #fff;
    background: var(--gradient); box-shadow: var(--shadow);
  }
  .note { text-align: center; margin: 10px 0 0; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  :global(.radar-me span) {
    position: relative; display: block; width: 18px; height: 18px; border-radius: 50%; box-sizing: border-box;
    background: var(--accent); border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  :global(.radar-me span::after) {
    content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid var(--accent);
    animation: radar-ping 2s ease-out infinite;
  }
  @keyframes -global-radar-ping { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { :global(.radar-me span::after) { animation: none; } }
</style>

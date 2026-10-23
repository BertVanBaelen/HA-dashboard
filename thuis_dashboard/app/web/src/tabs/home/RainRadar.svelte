<script>
  import { untrack } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { mdiPlay, mdiPause, mdiCrosshairsGps } from '@mdi/js';
  import { HOME } from '$shared/config.js';
  import { states, user } from '../../lib/api.js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import Slider from '../../components/Slider.svelte';

  /** @type {{ open?: boolean }} */
  let { open = $bindable(false) } = $props();

  const API = 'https://api.rainviewer.com/public/weather-maps.json';
  // RainViewer only serves radar tiles up to zoom 7; Leaflet upscales them beyond that.
  const RADAR_MAX_ZOOM = 7;
  const ZOOM = 8;

  /** @type {{ time: number, path: string }[]} */
  let frames = $state([]);
  let host = $state('');
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

  async function load() {
    try {
      const r = await fetch(API, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const list = [...(d.radar?.past ?? []), ...(d.radar?.nowcast ?? [])];
      if (!list.length) throw new Error('no frames');
      const wasLatest = !frames.length || idx === frames.length - 1;
      host = d.host;
      frames = list;
      if (wasLatest || idx >= list.length) idx = list.length - 1;
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
      if (frames.length) idx = frames.length - 1;
      load();
    });
    const t = setInterval(load, 5 * 60e3);
    return () => clearInterval(t);
  });

  // Loop through the frames, pausing a little longer on the latest one.
  $effect(() => {
    if (!open || !playing || frames.length < 2) return;
    const t = setTimeout(() => {
      idx = (idx + 1) % frames.length;
    }, idx === frames.length - 1 ? 1600 : 650);
    return () => clearTimeout(t);
  });

  const hhmm = (/** @type {number} */ t) => new Date(t * 1000).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  function stamp(/** @type {number} */ i) {
    const f = frames[i];
    if (!f) return '–';
    const min = Math.round((f.time - frames[frames.length - 1].time) / 60);
    return `${hhmm(f.time)} · ${min === 0 ? 'laatste beeld' : `${min} min`}`;
  }

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
    /** @type {Map<string, L.TileLayer>} */
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
          seen.add(f.path);
          if (layers.has(f.path)) continue;
          const l = L.tileLayer(`${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
            opacity: 0, maxNativeZoom: RADAR_MAX_ZOOM, maxZoom: 12, zIndex: 10, attribution: '© RainViewer',
          });
          l.addTo(m);
          layers.set(f.path, l);
        }
        for (const [p, l] of layers) {
          if (seen.has(p)) continue;
          m.removeLayer(l);
          layers.delete(p);
        }
      });
      $effect(() => {
        const cur = frames[idx]?.path;
        for (const [p, l] of layers) l.setOpacity(p === cur ? 0.75 : 0);
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
  </div>

  <div class="time">
    <button class="btn icon soft" title={playing ? 'Pauzeer' : 'Afspelen'} disabled={frames.length < 2} onclick={() => (playing = !playing)}>
      <Icon path={playing ? mdiPause : mdiPlay} size={20} />
    </button>
    <div class="grow">
      <Slider
        value={idx}
        min={0}
        max={Math.max(0, frames.length - 1)}
        step={1}
        disabled={frames.length < 2}
        label="Tijd"
        format={stamp}
        oninput={(v) => { playing = false; idx = v; }}
        onchange={(v) => { playing = false; idx = v; }}
      />
    </div>
  </div>
  <p class="tiny muted note">Neerslag van de afgelopen 2 uur · <span class="dot"></span> {hereLabel === 'Jij' ? 'jouw locatie' : 'thuis'} · bron: RainViewer</p>
</Sheet>

<style>
  .radar { position: relative; width: 100%; height: min(62dvh, 460px); border-radius: 16px; overflow: hidden; background: var(--surface-2); isolation: isolate; }
  .map { position: absolute; inset: 0; z-index: 0; }
  :global([data-mode='dark']) .map :global(.base-tile) { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6); }
  .map :global(.leaflet-control-attribution) { font-size: 9px; background: color-mix(in srgb, var(--surface-solid) 70%, transparent); color: var(--text-3); }
  .ph { position: absolute; inset: 0; z-index: 500; }
  .err { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-2); text-align: center; padding: 16px; background: var(--surface-2); }
  .locate { position: absolute; top: 10px; right: 10px; z-index: 600; background: var(--surface-solid); box-shadow: var(--shadow); }
  .time { display: flex; align-items: flex-end; gap: 12px; margin-top: 12px; }
  .time .btn { flex-shrink: 0; width: 38px; height: 38px; padding: 0; }
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

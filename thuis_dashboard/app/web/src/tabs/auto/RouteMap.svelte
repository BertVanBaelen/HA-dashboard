<script>
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { mdiFlagCheckered, mdiLightningBolt, mdiEvStation } from '@mdi/js';

  /**
   * Leaflet map showing driven routes, start/finish markers, charge spots and HA zones.
   * Static maps (interactive=false) ignore touch so the page keeps scrolling; lazy maps only
   * initialise once scrolled into view.
   * @type {{ routes?: { id:string|number, path:[number,number][], color?:string, faded?:boolean }[],
   *   markers?: { lat:number, lon:number, kind:'start'|'end'|'ac'|'dc', title?:string }[],
   *   zones?: { lat:number, lon:number, radius:number, home?:boolean }[], height?:string, interactive?:boolean,
   *   lazy?:boolean, fitKey?:any, rounded?:boolean }}
   */
  let { routes = [], markers = [], zones = [], height = '220px', interactive = true, lazy = false, fitKey = null, rounded = true } = $props();

  /** @type {HTMLDivElement} */
  let el;
  /** @type {L.Map|null} */
  let map = null;
  /** @type {L.LayerGroup} */
  let layer;
  let lastFit = Symbol();
  /** @type {L.LatLngBounds|null} */
  let bounds = null;
  let moved = false;

  function fit() {
    if (!map || !bounds) return;
    if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 150) map.setView(bounds.getCenter(), 15);
    else map.fitBounds(bounds, { padding: interactive ? [28, 28] : [18, 18], maxZoom: 16 });
  }

  const svg = (/** @type {string} */ p) => `<svg viewBox="0 0 24 24"><path d="${p}"/></svg>`;
  const css = (/** @type {string} */ v, fb) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;

  function icon(kind) {
    const html = kind === 'end' ? svg(mdiFlagCheckered) : kind === 'dc' ? svg(mdiLightningBolt) : kind === 'ac' ? svg(mdiEvStation) : '';
    return L.divIcon({ className: `route-pin ${kind}`, html: `<span>${html}</span>`, iconSize: kind === 'start' ? [16, 16] : [28, 28], iconAnchor: kind === 'start' ? [8, 8] : [14, 14] });
  }

  function render() {
    if (!map) return;
    layer.clearLayers();
    const accent = css('--accent', '#3b82f6');
    for (const z of zones) {
      L.circle([z.lat, z.lon], { radius: z.radius, color: z.home ? accent : '#94a3b8', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(layer);
    }
    /** @type {[number, number][]} */
    const pts = [];
    const ordered = [...routes].sort((a, b) => Number(!!b.faded) - Number(!!a.faded));
    for (const r of ordered) {
      if (r.path.length < 2) continue;
      const color = r.color ?? accent;
      if (r.faded) {
        L.polyline(r.path, { color, weight: 3, opacity: 0.35, interactive: false }).addTo(layer);
      } else {
        L.polyline(r.path, { color: '#fff', weight: 8, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layer);
        L.polyline(r.path, { color, weight: 4.5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layer);
        pts.push(...r.path);
      }
    }
    for (const m of markers) {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue;
      L.marker([m.lat, m.lon], { icon: icon(m.kind), title: m.title ?? '', interactive: false, keyboard: false }).addTo(layer);
      pts.push([m.lat, m.lon]);
    }
    if (!pts.length) for (const r of routes) pts.push(...r.path);
    if (fitKey !== lastFit && pts.length) {
      lastFit = fitKey;
      bounds = L.latLngBounds(pts);
      moved = false;
      fit();
    }
  }

  function init() {
    if (map || !el) return;
    const opts = interactive
      ? { zoomControl: false, zoomSnap: 0.25 }
      : { zoomControl: false, zoomSnap: 0.25, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false };
    map = L.map(el, opts).setView([51.13, 4.34], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on('dragstart', () => (moved = true));
    el.addEventListener('wheel', () => (moved = true), { passive: true });
    el.addEventListener('touchstart', () => (moved = true), { passive: true });
    render();
  }

  onMount(() => {
    /** @type {IntersectionObserver|undefined} */
    let io;
    if (lazy && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((e) => {
        if (e.some((x) => x.isIntersecting)) {
          init();
          io?.disconnect();
        }
      }, { rootMargin: '200px' });
      io.observe(el);
    } else init();
    const ro = new ResizeObserver(() => {
      if (!map) return;
      map.invalidateSize();
      if (!moved) fit();
    });
    ro.observe(el);
    return () => {
      io?.disconnect();
      ro.disconnect();
      map?.remove();
      map = null;
    };
  });

  $effect(() => {
    routes;
    markers;
    zones;
    fitKey;
    render();
  });
</script>

<div class="routemap" class:no-swipe={interactive} class:static={!interactive} class:rounded style="height:{height}" bind:this={el}></div>

<style>
  .routemap { width: 100%; overflow: hidden; z-index: 0; background: linear-gradient(135deg, var(--surface-2), var(--surface-3)); }
  .routemap.rounded { border-radius: var(--radius-sm); }
  .routemap.static { pointer-events: none; }
  :global([data-mode='dark']) .routemap :global(.leaflet-tile) { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6); }
  .routemap :global(.leaflet-control-attribution) { font-size: 8px; padding: 0 4px; background: color-mix(in srgb, var(--surface-solid) 70%, transparent); color: var(--text-3); }
  .routemap :global(.leaflet-control-attribution a) { color: inherit; }
  :global(.route-pin span) {
    display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%;
    border: 2.5px solid #fff; box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.45); box-sizing: border-box;
  }
  :global(.route-pin svg) { width: 16px; height: 16px; fill: #fff; }
  :global(.route-pin.start span) { background: #22c55e; }
  :global(.route-pin.end span) { background: #0f172a; }
  :global(.route-pin.ac span) { background: #16a34a; }
  :global(.route-pin.dc span) { background: linear-gradient(135deg, #f59e0b, #ef4444); }
</style>

<script>
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  /**
   * OpenStreetMap view with avatar markers and an optional home zone circle.
   * @type {{ markers?: {id:string,lat:number,lon:number,label?:string,color?:string,picture?:string,icon?:string}[],
   *   zone?: {lat:number,lon:number,radius:number}|null, height?: string, zoom?: number }}
   */
  let { markers = [], zone = null, height = '260px', zoom = 14 } = $props();

  let el;
  let map;
  let layer;
  let fitted = false;

  function markerIcon(m) {
    const inner = m.picture ? `<img src="${m.picture}" alt="">` : m.icon ? m.icon : (m.label ?? '?').slice(0, 1);
    return L.divIcon({
      className: 'dash-marker',
      html: `<span style="--mc:${m.color ?? 'var(--accent)'}">${inner}</span>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }

  function render() {
    if (!map) return;
    layer.clearLayers();
    if (zone) {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';
      L.circle([zone.lat, zone.lon], { radius: zone.radius, color: c, weight: 1, fillOpacity: 0.12 }).addTo(layer);
    }
    const pts = [];
    for (const m of markers) {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue;
      L.marker([m.lat, m.lon], { icon: markerIcon(m), title: m.label }).addTo(layer);
      pts.push([m.lat, m.lon]);
    }
    if (!fitted && pts.length) {
      if (pts.length === 1) map.setView(pts[0], zoom);
      else map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
      fitted = true;
    }
  }

  onMount(() => {
    map = L.map(el, { zoomControl: false, attributionControl: true }).setView(zone ? [zone.lat, zone.lon] : [51.13, 4.34], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    render();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.remove();
    };
  });

  $effect(() => {
    markers;
    zone;
    render();
  });

  export function recenter() {
    fitted = false;
    render();
  }
</script>

<div class="map no-swipe" style="height:{height}" bind:this={el}></div>

<style>
  .map { width: 100%; border-radius: var(--radius-sm); overflow: hidden; z-index: 0; background: var(--surface-2); }
  :global([data-mode='dark']) .map :global(.leaflet-tile) { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6); }
  :global(.dash-marker span) {
    display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%;
    background: var(--mc); color: #fff; font-weight: 800; font-size: 1rem;
    border: 3px solid #fff; box-shadow: 0 6px 16px -4px var(--mc); overflow: hidden;
    animation: pop 0.5s var(--spring);
  }
  :global(.dash-marker img) { width: 100%; height: 100%; object-fit: cover; }
  :global(.dash-marker svg) { width: 22px; height: 22px; fill: #fff; }
  .map :global(.leaflet-control-attribution) { font-size: 9px; background: color-mix(in srgb, var(--surface-solid) 70%, transparent); color: var(--text-3); }
</style>

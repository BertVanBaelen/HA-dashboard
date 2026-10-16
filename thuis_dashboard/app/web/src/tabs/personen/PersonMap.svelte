<script>
  import { onMount } from 'svelte';
  import L from 'leaflet';
  // @ts-ignore
  import 'leaflet/dist/leaflet.css';

  /**
   * @type {{ people?: {key:string,name:string,lat:number,lon:number,color:string,picture?:string|null,home?:boolean,accuracy?:number}[],
   *   zone?: {lat:number,lon:number,radius:number}|null, selected?: string|null, onselect?: (key:string) => void, height?: string }}
   */
  let { people = [], zone = null, selected = null, onselect, height = '300px' } = $props();

  /** @type {HTMLDivElement} */
  let el;
  let map = $state(/** @type {L.Map|null} */ (null));
  /** @type {L.LayerGroup} */
  let zoneLayer;
  /** @type {Map<string, {marker: L.Marker, circle: L.Circle, sig: string}>} */
  const items = new Map();
  let fitted = false;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  function icon(p, sel) {
    const inner = p.picture ? `<img src="${esc(p.picture)}" alt="">` : esc(p.name.slice(0, 1));
    return L.divIcon({
      className: 'pm-marker',
      html: `<span class="pm-pin${p.home ? ' home' : ''}${sel ? ' sel' : ''}" style="--mc:${p.color}"><span class="pm-face">${inner}</span><span class="pm-name">${esc(p.name)}</span></span>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }

  export function fitAll(animate = true) {
    if (!map) return;
    /** @type {[number, number][]} */
    const pts = people.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => [p.lat, p.lon]);
    if (zone) pts.push([zone.lat, zone.lon]);
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], 15, { animate });
    else if (animate) map.flyToBounds(pts, { padding: [50, 50], maxZoom: 16, duration: 0.9 });
    else map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
  }

  export function focus(key) {
    const p = people.find((x) => x.key === key);
    if (!map || !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;
    map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), 15), { duration: 0.9 });
  }

  function sync() {
    if (!map) return;
    zoneLayer.clearLayers();
    if (zone) {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--ok').trim() || '#22c55e';
      L.circle([zone.lat, zone.lon], { radius: zone.radius, color: c, weight: 2, dashArray: '6 6', fillOpacity: 0.12, interactive: false }).addTo(zoneLayer);
    }
    const seen = new Set();
    for (const p of people) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
      seen.add(p.key);
      const sel = selected === p.key;
      const sig = `${p.picture}|${p.home}|${sel}|${p.color}`;
      let it = items.get(p.key);
      if (!it) {
        const circle = L.circle([p.lat, p.lon], { radius: p.accuracy || 0, color: p.color, weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
        const marker = L.marker([p.lat, p.lon], { icon: icon(p, sel), title: p.name, riseOnHover: true }).addTo(map);
        const key = p.key;
        marker.on('click', () => onselect?.(key));
        it = { marker, circle, sig };
        items.set(p.key, it);
      } else {
        it.marker.setLatLng([p.lat, p.lon]);
        it.circle.setLatLng([p.lat, p.lon]).setRadius(p.accuracy || 0);
        if (it.sig !== sig) {
          it.marker.setIcon(icon(p, sel));
          it.sig = sig;
        }
      }
      it.marker.setZIndexOffset(sel ? 1000 : 0);
    }
    for (const [k, it] of items) {
      if (!seen.has(k)) {
        it.marker.remove();
        it.circle.remove();
        items.delete(k);
      }
    }
    if (!fitted && seen.size) {
      fitAll(false);
      fitted = true;
    }
  }

  onMount(() => {
    const m = L.map(el, { zoomControl: false, attributionControl: true }).setView(zone ? [zone.lat, zone.lon] : [51.13, 4.34], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    zoneLayer = L.layerGroup().addTo(m);
    map = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      items.clear();
      m.remove();
      map = null;
    };
  });

  $effect(() => {
    people;
    zone;
    selected;
    map;
    sync();
  });
</script>

<div class="pmap no-swipe" style="height:{height}" bind:this={el}></div>

<style>
  .pmap { width: 100%; z-index: 0; background: var(--surface-2); }
  :global([data-mode='dark']) .pmap :global(.leaflet-tile) { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9) saturate(0.6); }
  .pmap :global(.leaflet-control-attribution) { font-size: 9px; background: color-mix(in srgb, var(--surface-solid) 70%, transparent); color: var(--text-3); }
  .pmap :global(.pm-marker) { background: none; border: none; }
  .pmap :global(.pm-pin) { position: relative; display: block; width: 48px; height: 48px; animation: pop 0.6s var(--spring); }
  .pmap :global(.pm-face) {
    display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; overflow: hidden;
    background: var(--mc); color: #fff; font-weight: 800; font-size: 1.2rem;
    border: 3px solid var(--surface-solid); box-shadow: 0 0 0 2px var(--mc), 0 8px 20px -6px var(--mc);
    transition: transform 0.35s var(--spring);
  }
  .pmap :global(.pm-face img) { width: 100%; height: 100%; object-fit: cover; }
  .pmap :global(.pm-pin.home .pm-face) { --pulse: var(--mc); }
  .pmap :global(.pm-pin.sel .pm-face) { transform: scale(1.18); }
  .pmap :global(.pm-name) {
    position: absolute; left: 50%; top: calc(100% + 4px); transform: translateX(-50%);
    padding: 1px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; white-space: nowrap;
    background: var(--mc); color: #fff; box-shadow: 0 4px 10px -4px var(--mc);
  }
</style>

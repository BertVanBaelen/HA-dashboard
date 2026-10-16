export function haversine(a, b) {
  const R = 6371e3;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtDistance(m) {
  if (!Number.isFinite(m)) return '–';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  if (m < 10000) return `${(m / 1000).toLocaleString('nl-BE', { maximumFractionDigits: 1 })} km`;
  return `${Math.round(m / 1000).toLocaleString('nl-BE')} km`;
}

export function coords(...sources) {
  for (const s of sources) {
    const lat = Number(s?.attributes?.latitude);
    const lon = Number(s?.attributes?.longitude);
    if (s?.attributes?.latitude != null && Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  return null;
}

export const isAbsoluteUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

function isApple() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

export function mapsUrl(pos, address) {
  const q = pos ? `${pos.lat},${pos.lon}` : address ?? '';
  if (isApple()) return `https://maps.apple.com/?q=${encodeURIComponent(address || q)}${pos ? `&ll=${q}` : ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

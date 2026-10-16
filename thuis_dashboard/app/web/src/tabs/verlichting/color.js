const COLOR_MODES = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const modes = (s) => s?.attributes?.supported_color_modes ?? [];
export const supportsColor = (s) => modes(s).some((m) => COLOR_MODES.includes(m));
export const supportsTemp = (s) => modes(s).includes('color_temp');
export const supportsBrightness = (s) => {
  const m = modes(s);
  return m.length ? m.some((x) => x !== 'onoff') : s?.attributes?.brightness != null;
};
export const brightnessPct = (s) => {
  const b = s?.attributes?.brightness;
  return b != null ? clamp(Math.round((b / 255) * 100), 1, 100) : 100;
};
export const isTempMode = (s) => s?.attributes?.color_mode === 'color_temp';

/** Approximate RGB for a colour temperature in kelvin (Tanner Helland). */
export function kelvinToRgb(k) {
  const t = clamp(k, 1000, 40000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  return [r, g, b].map((v) => Math.round(clamp(v, 0, 255)));
}

export function hsToRgb(h, s) {
  const sat = s / 100;
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (1 - sat * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

/** @param {number[]} rgb */
export function rgbToHs(rgb) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  return [Math.round(h), max ? Math.round((d / max) * 100) : 0];
}

/** Display colour of a lamp (null when off). */
export function lampRgb(s) {
  if (s?.state !== 'on') return null;
  const a = s.attributes ?? {};
  if (a.color_mode === 'color_temp' && a.color_temp_kelvin) return kelvinToRgb(a.color_temp_kelvin);
  if (Array.isArray(a.rgb_color)) return a.rgb_color;
  if (Array.isArray(a.hs_color)) return hsToRgb(a.hs_color[0], a.hs_color[1]);
  if (a.color_temp_kelvin) return kelvinToRgb(a.color_temp_kelvin);
  return kelvinToRgb(2900);
}

export const css = (rgb, alpha = 1) => (rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` : 'transparent');

export function presetRgb(cfg) {
  if (!cfg?.on) return null;
  if (cfg.rgb) return cfg.rgb;
  return kelvinToRgb(cfg.colorTemp ?? 2900);
}

/** True when the current lamp states roughly match a preset. */
export function presetMatches(preset, states) {
  const entries = Object.entries(preset?.lights ?? {});
  if (!entries.length) return false;
  return entries.every(([id, cfg]) => {
    const s = states[id];
    if (!s || s.state === 'unavailable') return true;
    if (!cfg.on) return s.state !== 'on';
    if (s.state !== 'on') return false;
    if (cfg.brightness != null && Math.abs(brightnessPct(s) - cfg.brightness) > 3) return false;
    const a = s.attributes ?? {};
    if (cfg.rgb) return a.color_mode !== 'color_temp' && Array.isArray(a.rgb_color) && a.rgb_color.every((v, i) => Math.abs(v - cfg.rgb[i]) < 12);
    if (cfg.colorTemp) return a.color_mode === 'color_temp' && Math.abs((a.color_temp_kelvin ?? 0) - cfg.colorTemp) < 120;
    return true;
  });
}

export const TEMP_TRACK = 'linear-gradient(90deg,#ff8a2b,#ffb46b 22%,#ffe3c2 45%,#fff6ec 60%,#e6efff 78%,#a9c8ff)';

export const SWATCHES = [
  [255, 140, 60],
  [255, 80, 40],
  [255, 40, 90],
  [230, 60, 255],
  [120, 80, 255],
  [40, 120, 255],
  [0, 210, 255],
  [40, 230, 140],
  [180, 255, 60],
  [255, 220, 40],
];

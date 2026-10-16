<script>
  import { onMount, untrack } from 'svelte';
  import uPlot from 'uplot';
  // @ts-ignore
  import 'uplot/dist/uPlot.min.css';
  import { fmtNum } from '../../lib/format.js';
  import { valueAt } from './data.js';

  /**
   * Theme-aware uPlot wrapper with gradient fills, touch cursor and tooltip.
   * @type {{ data: import('./data.js').ChartData, series: import('./data.js').SeriesDef[],
   *   axes?: Record<string, {unit?: string, range?: number[], zero?: boolean, digits?: number}>,
   *   stacked?: boolean, hidden?: number[], height?: number }}
   */
  let { data, series, axes = {}, stacked = false, hidden = [], height = 220 } = $props();

  /** @type {HTMLDivElement} */
  let wrap;
  /** @type {HTMLDivElement} */
  let target;
  /** @type {any} */
  let u = null;
  let themeTick = $state(0);
  let tip = $state({ show: false, left: 0, idx: /** @type {number|null} */ (null), flip: false });
  let colors = $state(/** @type {string[]} */ ([]));

  const nl = 'nl-BE';
  const probe = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

  function rgba(color, a) {
    if (!probe) return color;
    probe.fillStyle = '#000';
    probe.fillStyle = color;
    const c = String(probe.fillStyle);
    let r = 0, g = 0, b = 0;
    if (c.startsWith('#')) {
      r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16);
    } else {
      const m = c.match(/[\d.]+/g) ?? [];
      [r, g, b] = m.map(Number);
    }
    return `rgba(${r},${g},${b},${a})`;
  }

  const gradient = (color, a0, a1) => (/** @type {any} */ self) => {
    const { top, height: h } = self.bbox;
    if (!Number.isFinite(top) || !h) return rgba(color, a0);
    const g = self.ctx.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, rgba(color, a0));
    g.addColorStop(1, rgba(color, a1));
    return g;
  };

  const span = $derived(data.end - data.start);

  function fmtX(t, long = false) {
    const d = new Date(t * 1000);
    const day = d.toLocaleDateString(nl, { day: 'numeric', month: 'short' }).replace('.', '');
    const time = d.toLocaleTimeString(nl, { hour: '2-digit', minute: '2-digit' });
    if (long) {
      const wd = d.toLocaleDateString(nl, { weekday: 'short' }).replace('.', '');
      return data.period === 'day' ? `${wd} ${day}` : `${wd} ${day} · ${time}`;
    }
    return span <= 36 * 3600 ? time : day;
  }

  const unitFor = (key) => axes[key]?.unit ?? series.find((s) => (s.axis ?? 'y') === key)?.unit ?? '';
  const fmtAxis = (v, key) => {
    const digits = axes[key]?.digits ?? (Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 1);
    const unit = unitFor(key);
    return `${fmtNum(v, digits)}${unit === '%' || unit.startsWith('°') ? unit : ''}`;
  };

  function scaleRange(key) {
    const a = axes[key] ?? {};
    if (a.range) return () => a.range;
    return (/** @type {any} */ _self, min, max) => {
      if (min == null || max == null) return [0, 1];
      const pad = (max - min) * 0.12 || Math.max(1, Math.abs(max) * 0.1);
      const lo = a.zero || stacked ? 0 : min - pad;
      return [lo, max + pad];
    };
  }

  function build(width) {
    const cs = getComputedStyle(document.documentElement);
    const css = (v) => (v.startsWith('--') ? cs.getPropertyValue(v).trim() || '#888' : v);
    const text3 = css('--text-3');
    const grid = css('--border');
    const solid = css('--surface-solid');
    const font = `500 11px ${cs.getPropertyValue('--font').trim() || 'system-ui, sans-serif'}`;
    const cols = series.map((s) => css(s.color));
    colors = cols;
    const hasBars = series.some((s) => s.type === 'bar');
    const usesY2 = series.some((s) => s.axis === 'y2');

    const sOpts = series.map((s, i) => {
      const col = cols[i];
      /** @type {any} */
      const o = {
        label: s.label,
        scale: s.axis ?? 'y',
        stroke: col,
        width: 2,
        spanGaps: true,
        show: !untrack(() => hidden).includes(i),
        points: { show: false },
      };
      if (s.dash) o.dash = [6, 5];
      if (s.type === 'bar') {
        o.paths = uPlot.paths.bars({ size: [s.size ?? 0.6, 40], align: 0, gap: 1 });
        o.fill = gradient(col, 0.95, 0.4);
        o.width = 0;
      } else if (s.type === 'step' || stacked) {
        o.paths = uPlot.paths.stepped({ align: 1 });
      } else {
        o.paths = uPlot.paths.spline();
      }
      if (stacked) {
        o.fill = gradient(col, 0.6, 0.2);
        o.width = 1.5;
      } else if (s.type === 'area') {
        o.fill = gradient(col, 0.38, 0.02);
        o.width = 2.5;
      }
      return o;
    });

    const axis = (scale, side) => ({
      scale,
      side,
      stroke: text3,
      font,
      size: 46,
      gap: 4,
      space: 32,
      ticks: { show: false },
      grid: side === 3 ? { stroke: grid, width: 1 } : { show: false },
      values: (/** @type {any} */ _self, vals) => vals.map((v) => fmtAxis(v, scale)),
    });

    const step = data.step ?? (data.x.length > 1 ? data.x[1] - data.x[0] : 3600);
    const xr = hasBars && data.x.length
      ? [data.x[0] - step * 0.6, data.x[data.x.length - 1] + step * 0.6]
      : [data.start, data.end];

    /** @type {any} */
    const opts = {
      width,
      height,
      padding: [10, usesY2 ? 0 : 10, 0, 0],
      legend: { show: false },
      series: [{}, ...sOpts],
      bands: stacked ? series.slice(1).map((_, i) => ({ series: [i + 2, i + 1] })) : [],
      scales: {
        x: { time: true, range: () => xr },
        y: { range: scaleRange('y') },
        ...(usesY2 ? { y2: { range: scaleRange('y2') } } : {}),
      },
      axes: [
        {
          stroke: text3,
          font,
          size: 30,
          space: 64,
          gap: 6,
          ticks: { show: false },
          grid: { show: false },
          values: (/** @type {any} */ _self, splits) => splits.map((t) => fmtX(t)),
        },
        axis('y', 3),
        ...(usesY2 ? [axis('y2', 1)] : []),
      ],
      cursor: {
        y: false,
        drag: { x: false, y: false, setScale: false },
        points: {
          size: 11,
          width: 2.5,
          fill: solid,
          stroke: (/** @type {any} */ _self, si) => cols[si - 1],
        },
      },
      hooks: { setCursor: [onCursor] },
    };
    return opts;
  }

  function onCursor(self) {
    const idx = self.cursor.idx;
    const left = self.cursor.left;
    if (idx == null || left == null || left < 0) {
      tip.show = false;
      return;
    }
    const off = self.over.getBoundingClientRect().left - wrap.getBoundingClientRect().left;
    tip.left = left + off;
    tip.idx = idx;
    tip.flip = left > self.over.clientWidth / 2;
    tip.show = true;
  }

  function onTouch(/** @type {TouchEvent} */ e) {
    const t = e.touches[0];
    if (!t || !u) return;
    const r = u.over.getBoundingClientRect();
    u.setCursor({ left: Math.max(0, Math.min(r.width, t.clientX - r.left)), top: Math.max(0, Math.min(r.height, t.clientY - r.top)) });
  }

  function create() {
    u?.destroy();
    u = null;
    tip.show = false;
    const width = wrap?.clientWidth;
    if (!width) return;
    u = new uPlot(build(width), [data.x, ...data.ys], target);
    u.over.addEventListener('touchstart', onTouch, { passive: true });
    u.over.addEventListener('touchmove', onTouch, { passive: true });
  }

  $effect(() => {
    data; series; axes; stacked; height; themeTick;
    untrack(create);
  });

  $effect(() => {
    const h = hidden;
    if (!u) return;
    series.forEach((_, i) => {
      const show = !h.includes(i);
      if (u.series[i + 1].show !== show) u.setSeries(i + 1, { show });
    });
  });

  onMount(() => {
    let lastW = wrap.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      if (u) u.setSize({ width: w, height });
      else create();
    });
    ro.observe(wrap);
    const mo = new MutationObserver(() => themeTick++);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode', 'data-accent'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
      u?.destroy();
      u = null;
    };
  });

  const rows = $derived(
    tip.idx == null
      ? []
      : series
          .map((s, i) => ({ s, i, v: valueAt(data.raw[i], tip.idx, data.hold[i]) }))
          .filter((r) => !hidden.includes(r.i)),
  );
</script>

<div class="u-wrap no-swipe chart" bind:this={wrap} style="height:{height}px">
  <div bind:this={target}></div>
  {#if tip.show && tip.idx != null}
    <div class="tip" class:flip={tip.flip} style="left:{tip.left}px">
      <div class="tiny faint t-time">{fmtX(data.x[tip.idx], true)}</div>
      {#each rows as r (r.i)}
        <div class="t-row">
          <span class="dot" style="background:{colors[r.i]}"></span>
          <span class="t-label ellipsis">{r.s.label}</span>
          <b class="num">{r.v == null ? '–' : `${fmtNum(r.v, r.s.digits ?? 1)}${r.s.unit ? ` ${r.s.unit}` : ''}`}</b>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chart { position: relative; width: 100%; user-select: none; -webkit-user-select: none; }
  .chart :global(.u-over) { touch-action: pan-y; }
  .chart :global(.u-cursor-x) { border-right: 1.5px dashed var(--text-3); }
  .chart :global(.u-cursor-pt) { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); }
  .tip {
    position: absolute; top: 4px; z-index: 5; pointer-events: none;
    transform: translateX(14px);
    min-width: 140px; max-width: 220px; padding: 8px 10px; border-radius: 12px;
    background: var(--surface-solid); border: 1px solid var(--border); box-shadow: var(--shadow-lg);
    font-size: 0.8rem;
  }
  .tip.flip { transform: translateX(calc(-100% - 14px)); }
  .t-time { margin-bottom: 4px; text-transform: capitalize; }
  .t-row { display: flex; align-items: center; gap: 6px; line-height: 1.6; }
  .t-label { flex: 1; color: var(--text-2); }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
</style>

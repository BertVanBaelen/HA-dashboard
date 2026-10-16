<script>
  import { hsToRgb, css } from './color.js';

  /** @type {{ hs?: number[]|null, disabled?: boolean, onchange?: (hs:number[])=>void }} */
  let { hs = null, disabled = false, onchange } = $props();

  let el = $state(/** @type {HTMLDivElement|null} */ (null));
  let drag = $state(/** @type {number[]|null} */ (null));
  const cur = $derived(drag ?? hs);
  const pos = $derived.by(() => {
    if (!cur) return null;
    const a = (cur[0] * Math.PI) / 180;
    const r = cur[1] / 100;
    return { x: 50 + Math.cos(a) * r * 50, y: 50 + Math.sin(a) * r * 50 };
  });

  function pick(e) {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const dx = e.clientX - (b.left + b.width / 2);
    const dy = e.clientY - (b.top + b.height / 2);
    const h = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
    const s = Math.round(Math.min(1, Math.hypot(dx, dy) / (b.width / 2)) * 100);
    return [h, s];
  }
  function down(e) {
    if (disabled) return;
    el?.setPointerCapture(e.pointerId);
    drag = pick(e);
  }
  function move(e) {
    if (drag) drag = pick(e);
  }
  function up() {
    if (!drag) return;
    const v = drag;
    onchange?.(v);
    setTimeout(() => { if (drag === v) drag = null; }, 1500);
  }
</script>

<div
  class="wheel no-swipe"
  class:disabled
  bind:this={el}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="slider"
  aria-label="Kleur"
  aria-valuenow={cur?.[0] ?? 0}
  tabindex="-1"
>
  <div class="sat"></div>
  {#if pos && cur}
    <span class="knob" class:active={!!drag} style="left:{pos.x}%;top:{pos.y}%;--c:{css(hsToRgb(cur[0], cur[1]))}"></span>
  {/if}
</div>

<style>
  .wheel {
    position: relative; width: min(240px, 70vw); aspect-ratio: 1; border-radius: 50%; margin: 0 auto;
    background: conic-gradient(from 90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    box-shadow: 0 10px 40px -12px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.15);
    touch-action: none; cursor: crosshair;
  }
  .wheel.disabled { opacity: 0.5; cursor: default; }
  .sat { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(closest-side, #fff, rgba(255, 255, 255, 0)); pointer-events: none; }
  .knob {
    position: absolute; width: 30px; height: 30px; border-radius: 50%; transform: translate(-50%, -50%);
    background: var(--c); border: 3px solid #fff; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4), 0 0 18px var(--c);
    transition: transform 0.25s var(--spring); pointer-events: none;
  }
  .knob.active { transform: translate(-50%, -50%) scale(1.3); }
</style>

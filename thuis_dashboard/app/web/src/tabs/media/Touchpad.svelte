<script>
  import { mdiGestureTap, mdiChevronUp, mdiChevronDown, mdiChevronLeft, mdiChevronRight } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';
  import { buzz } from './hold.js';

  /** @type {{ onnav: (dir: 'up'|'down'|'left'|'right'|'ok') => void, disabled?: boolean }} */
  let { onnav, disabled = false } = $props();

  const STEP = 42;
  const ARROWS = { up: mdiChevronUp, down: mdiChevronDown, left: mdiChevronLeft, right: mdiChevronRight };

  /** @type {HTMLDivElement} */
  let pad;
  let active = $state(false);
  let ripples = $state(/** @type {{id:number,x:number,y:number}[]} */ ([]));
  let flash = $state(/** @type {{id:number,dir:string}|null} */ (null));
  let dot = $state({ x: 0, y: 0 });
  let start = { x: 0, y: 0, t: 0 };
  let origin = { x: 0, y: 0 };
  let moved = false;
  let lastDir = /** @type {any} */ (null);
  let repeatT = 0;
  let repeatI = 0;
  let seq = 0;

  function fire(/** @type {'up'|'down'|'left'|'right'|'ok'} */ dir) {
    buzz(dir === 'ok' ? 14 : 6);
    onnav(dir);
    if (dir !== 'ok') flash = { id: ++seq, dir };
  }

  function clearRepeat() {
    clearTimeout(repeatT);
    clearInterval(repeatI);
  }

  function local(/** @type {PointerEvent} */ e) {
    const r = pad.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(/** @type {PointerEvent} */ e) {
    if (disabled) return;
    pad.setPointerCapture(e.pointerId);
    const p = local(e);
    start = { ...p, t: Date.now() };
    origin = p;
    dot = p;
    moved = false;
    lastDir = null;
    active = true;
  }

  function move(/** @type {PointerEvent} */ e) {
    if (!active) return;
    const p = local(e);
    dot = p;
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < STEP) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    moved = true;
    origin = p;
    lastDir = dir;
    fire(dir);
    clearRepeat();
    repeatT = setTimeout(() => {
      repeatI = setInterval(() => lastDir && fire(lastDir), 200);
    }, 550);
  }

  function up(/** @type {PointerEvent} */ e) {
    if (!active) return;
    active = false;
    clearRepeat();
    const p = local(e);
    if (!moved && Date.now() - start.t < 500 && Math.hypot(p.x - start.x, p.y - start.y) < 14) {
      ripples = [...ripples, { id: ++seq, ...p }];
      fire('ok');
    }
  }

  function cancel() {
    active = false;
    clearRepeat();
  }
</script>

<div
  bind:this={pad}
  class="pad no-swipe"
  class:active
  class:disabled
  role="application"
  aria-label="Touchpad: veeg om te navigeren, tik voor OK"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={cancel}
  oncontextmenu={(e) => e.preventDefault()}
>
  <div class="grid-bg"></div>
  <div class="hint">
    <Icon path={mdiGestureTap} size={34} />
    <span class="small">Veeg om te navigeren · tik voor OK</span>
  </div>
  {#each Object.entries(ARROWS) as [dir, path] (dir)}
    <span class="edge {dir}" class:lit={flash?.dir === dir}>
      {#key flash?.dir === dir ? flash.id : 0}<span class="ic"><Icon {path} size={30} /></span>{/key}
    </span>
  {/each}
  {#if active}<span class="finger" style="left:{dot.x}px;top:{dot.y}px"></span>{/if}
  {#each ripples as r (r.id)}
    <span class="ripple" style="left:{r.x}px;top:{r.y}px" onanimationend={() => (ripples = ripples.filter((x) => x.id !== r.id))}></span>
  {/each}
</div>

<style>
  .pad {
    position: relative; height: 250px; border-radius: 24px; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
    background: radial-gradient(120% 90% at 50% 0%, var(--accent-soft), transparent 70%), var(--surface-2);
    border: 1px solid var(--border); cursor: grab;
    transition: box-shadow 0.3s, border-color 0.3s, transform 0.3s var(--spring);
  }
  .pad.active { cursor: grabbing; border-color: color-mix(in srgb, var(--accent) 45%, transparent); box-shadow: inset 0 0 0 1px var(--accent-soft), 0 12px 36px -16px var(--accent); transform: scale(0.995); }
  .pad.disabled { opacity: 0.5; pointer-events: none; }
  .grid-bg {
    position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
    background-image: radial-gradient(circle, var(--border) 1.2px, transparent 1.4px);
    background-size: 22px 22px;
    mask-image: radial-gradient(circle at center, #000 30%, transparent 75%);
  }
  .hint { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-3); pointer-events: none; transition: opacity 0.3s; }
  .active .hint { opacity: 0.25; }
  .edge { position: absolute; display: grid; place-items: center; color: var(--text-3); pointer-events: none; opacity: 0.55; transition: color 0.2s, opacity 0.2s; }
  .edge.up { top: 8px; left: 50%; transform: translateX(-50%); }
  .edge.down { bottom: 8px; left: 50%; transform: translateX(-50%); }
  .edge.left { left: 8px; top: 50%; transform: translateY(-50%); }
  .edge.right { right: 8px; top: 50%; transform: translateY(-50%); }
  .edge.lit { color: var(--accent); opacity: 1; }
  .edge.lit .ic { animation: nudge 0.35s var(--spring); }
  .up .ic { --nx: 0; --ny: -8px; }
  .down .ic { --nx: 0; --ny: 8px; }
  .left .ic { --nx: -8px; --ny: 0; }
  .right .ic { --nx: 8px; --ny: 0; }
  .ic { display: block; filter: drop-shadow(0 0 0 transparent); }
  .lit .ic { filter: drop-shadow(0 0 10px var(--accent)); }
  @keyframes nudge { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(var(--nx), var(--ny)) scale(1.25); } 100% { transform: translate(0, 0) scale(1); } }
  .finger {
    position: absolute; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%);
    animation: pop 0.25s var(--spring);
  }
  .ripple {
    position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; pointer-events: none;
    border: 2px solid var(--accent); background: var(--accent-soft);
    animation: ripple 0.55s var(--ease) forwards;
  }
  @keyframes ripple { from { transform: scale(0.4); opacity: 1; } to { transform: scale(6); opacity: 0; } }
</style>

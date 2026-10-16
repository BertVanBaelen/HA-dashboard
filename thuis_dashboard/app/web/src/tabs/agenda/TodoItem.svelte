<script>
  import { tick } from 'svelte';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ item: {uid:string, summary:string, status:string, _tmp?: boolean}, checked: boolean, celebrate?: boolean, color?: string, ontoggle: () => void, onrename: (s: string) => void, ondelete: () => void }} */
  let { item, checked, celebrate = false, color = 'var(--accent)', ontoggle, onrename, ondelete } = $props();

  const CONFETTI = ['#f59e0b', '#ec4899', '#22c55e', '#3b82f6', '#8b5cf6', '#06b6d4'];
  let editing = $state(false);
  let draft = $state('');
  let input = $state(/** @type {HTMLInputElement|null} */ (null));
  let dx = $state(0);
  let dragging = $state(false);
  let sx = 0;
  let sy = 0;
  let lock = /** @type {null|'x'|'y'} */ (null);
  let suppress = false;

  async function edit() {
    if (item._tmp || checked) return;
    draft = item.summary;
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }
  function save() {
    if (!editing) return;
    editing = false;
    const v = draft.trim();
    if (v && v !== item.summary) onrename(v);
  }
  function key(e) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') editing = false;
  }

  function down(e) {
    if (editing || item._tmp || (e.pointerType === 'mouse' && e.button !== 0)) return;
    sx = e.clientX;
    sy = e.clientY;
    lock = null;
    dragging = true;
  }
  function move(e) {
    if (!dragging) return;
    const x = e.clientX - sx;
    const y = e.clientY - sy;
    if (!lock && (Math.abs(x) > 8 || Math.abs(y) > 8)) {
      lock = Math.abs(x) > Math.abs(y) ? 'x' : 'y';
      if (lock === 'x') /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture?.(e.pointerId);
    }
    if (lock === 'x') dx = Math.min(0, x);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (lock === 'x') {
      suppress = true;
      setTimeout(() => (suppress = false), 50);
    }
    if (lock === 'x' && dx < -90) {
      dx = -600;
      navigator.vibrate?.(10);
      setTimeout(ondelete, 160);
    } else dx = 0;
    lock = null;
  }
  function cancel() {
    dragging = false;
    lock = null;
    dx = 0;
  }
  function clickCapture(e) {
    if (suppress) {
      e.stopPropagation();
      e.preventDefault();
    }
  }
</script>

<div class="wrapper" class:tmp={item._tmp}>
  <div class="behind" style="opacity:{Math.min(1, -dx / 90)}">
    <Icon name="delete" size={22} style="transform:scale({-dx > 90 ? 1.25 : 1})" />
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="item no-swipe"
    class:checked
    class:dragging
    style="--c:{color};transform:translateX({dx}px)"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={cancel}
    onclickcapture={clickCapture}
  >
    <button class="check" class:on={checked} onclick={ontoggle} disabled={item._tmp} aria-label={checked ? 'Niet afgewerkt' : 'Afvinken'}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
      {#if celebrate}
        <span class="burst" aria-hidden="true">
          {#each CONFETTI.concat(CONFETTI) as c, i}<i style="--a:{i * 30 + 8}deg;--k:{c};--r:{22 + (i % 3) * 7}px"></i>{/each}
        </span>
      {/if}
    </button>
    {#if editing}
      <input class="input edit" bind:this={input} bind:value={draft} onblur={save} onkeydown={key} maxlength="200" />
    {:else}
      <button class="text" onclick={edit} title={checked ? '' : 'Tik om te bewerken'}><span class="s">{item.summary}</span></button>
    {/if}
    <button class="btn icon ghost del" onclick={ondelete} disabled={item._tmp} aria-label="Verwijderen"><Icon name="delete" size={20} /></button>
  </div>
</div>

<style>
  .wrapper { position: relative; border-radius: var(--radius-sm); overflow: hidden; }
  .tmp { opacity: 0.6; }
  .behind {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding-right: 20px;
    background: var(--danger); color: #fff; border-radius: var(--radius-sm);
  }
  .item {
    position: relative; display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 8px; min-height: 54px;
    background: var(--surface-2); border-radius: var(--radius-sm); touch-action: pan-y; user-select: none;
    transition: transform 0.3s var(--spring), background 0.3s;
  }
  .item.dragging { transition: none; }
  .check {
    position: relative; flex-shrink: 0; width: 44px; height: 44px; border: 0; background: none; cursor: pointer; display: grid; place-items: center;
  }
  .check::before {
    content: ''; position: absolute; width: 26px; height: 26px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--c) 60%, var(--text-3));
    transition: background 0.25s, border-color 0.25s, transform 0.35s var(--spring);
  }
  .check:active::before { transform: scale(0.8); }
  .check svg { position: relative; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 22; stroke-dashoffset: 22; transition: stroke-dashoffset 0.35s 0.08s var(--ease); }
  .check.on::before { background: var(--c); border-color: var(--c); animation: pop 0.45s var(--spring); box-shadow: 0 4px 14px -4px var(--c); }
  .check.on svg { stroke-dashoffset: 0; }
  .burst { position: absolute; inset: 50% auto auto 50%; pointer-events: none; }
  .burst i {
    position: absolute; width: 6px; height: 6px; border-radius: 2px; background: var(--k); left: -3px; top: -3px;
    animation: confetti 0.7s cubic-bezier(0.15, 0.8, 0.3, 1) forwards;
  }
  .burst i:nth-child(odd) { border-radius: 50%; }
  @keyframes confetti {
    0% { transform: rotate(var(--a)) translateY(0) scale(1); opacity: 1; }
    100% { transform: rotate(var(--a)) translateY(calc(-1 * var(--r))) rotate(180deg) scale(0.2); opacity: 0; }
  }
  .text { flex: 1; min-width: 0; border: 0; background: none; text-align: left; cursor: text; padding: 10px 2px; font-size: 1rem; color: var(--text); }
  .s {
    background-image: linear-gradient(currentColor, currentColor); background-repeat: no-repeat; background-position: 0 55%; background-size: 0% 2px;
    transition: background-size 0.35s var(--ease), color 0.3s; word-break: break-word;
  }
  .checked .s { background-size: 100% 2px; color: var(--text-3); }
  .checked .text { cursor: default; }
  .edit { flex: 1; padding: 8px 10px; }
  .del { color: var(--text-3); opacity: 0.7; }
  .del:hover { color: var(--danger); opacity: 1; }
</style>

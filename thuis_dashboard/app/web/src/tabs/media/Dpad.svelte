<script>
  import { mdiChevronUp, mdiChevronDown, mdiChevronLeft, mdiChevronRight } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';
  import { hold } from './hold.js';

  /** @type {{ onnav: (dir: 'up'|'down'|'left'|'right'|'ok') => void, disabled?: boolean }} */
  let { onnav, disabled = false } = $props();
</script>

<div class="dpad no-swipe" class:disabled>
  <button class="arrow up" aria-label="Omhoog" {disabled} use:hold={{ fn: () => onnav('up') }}><Icon path={mdiChevronUp} size={34} /></button>
  <button class="arrow left" aria-label="Links" {disabled} use:hold={{ fn: () => onnav('left') }}><Icon path={mdiChevronLeft} size={34} /></button>
  <button class="ok" aria-label="OK" {disabled} use:hold={{ fn: () => onnav('ok'), repeat: false }}>OK</button>
  <button class="arrow right" aria-label="Rechts" {disabled} use:hold={{ fn: () => onnav('right') }}><Icon path={mdiChevronRight} size={34} /></button>
  <button class="arrow down" aria-label="Omlaag" {disabled} use:hold={{ fn: () => onnav('down') }}><Icon path={mdiChevronDown} size={34} /></button>
</div>

<style>
  .dpad {
    position: relative; width: min(250px, 100%); aspect-ratio: 1; margin: 0 auto; border-radius: 50%;
    display: grid; grid-template: 1fr 1.15fr 1fr / 1fr 1.15fr 1fr; touch-action: manipulation; -webkit-touch-callout: none;
    background: conic-gradient(from 45deg, var(--surface-2), var(--surface-3), var(--surface-2), var(--surface-3), var(--surface-2));
    border: 1px solid var(--border); box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.08), var(--shadow);
  }
  .disabled { opacity: 0.5; }
  button { border: 0; background: none; cursor: pointer; color: var(--text-2); display: grid; place-items: center; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; transition: color 0.2s, transform 0.2s var(--spring); }
  .arrow { border-radius: 50%; }
  .arrow:global(.held) { color: var(--accent); transform: scale(0.88); filter: drop-shadow(0 0 8px var(--accent)); }
  .up { grid-area: 1 / 2; }
  .left { grid-area: 2 / 1; }
  .right { grid-area: 2 / 3; }
  .down { grid-area: 3 / 2; }
  .ok {
    grid-area: 2 / 2; border-radius: 50%; margin: 4px; font-weight: 800; font-size: 1.1rem; letter-spacing: 0.05em; color: #fff;
    background: var(--gradient); box-shadow: 0 10px 24px -8px var(--accent), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .ok:global(.held) { transform: scale(0.9); box-shadow: 0 4px 12px -6px var(--accent); }
</style>

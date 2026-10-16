<script>
  import { mdiVolumeMinus, mdiVolumePlus, mdiVolumeOff } from '@mdi/js';
  import Icon from '../../components/Icon.svelte';
  import { hold } from './hold.js';

  /** @type {{ ondown: () => void, onup: () => void, onmute: () => void, label?: string, disabled?: boolean, interval?: number }} */
  let { ondown, onup, onmute, label = 'Volume', disabled = false, interval = 220 } = $props();
  let pulse = $state(0);
  let dir = $state('');
  const bump = (/** @type {string} */ d, /** @type {() => void} */ fn) => () => {
    dir = d;
    pulse++;
    fn();
  };
</script>

<div class="vol no-swipe" class:disabled>
  <button class="side" aria-label="Volume omlaag" {disabled} use:hold={{ fn: bump('down', ondown), interval }}>
    <Icon path={mdiVolumeMinus} size={28} />
  </button>
  <div class="mid">
    <div class="waves {dir}">
      {#key pulse}
        {#each [0, 1, 2, 3, 4, 5, 6] as i}<i style="--i:{i}"></i>{/each}
      {/key}
    </div>
    <span class="tiny muted">{label}</span>
    <button class="mute" aria-label="Dempen" {disabled} use:hold={{ fn: bump('mute', onmute), repeat: false }}>
      <Icon path={mdiVolumeOff} size={20} /><span>Mute</span>
    </button>
  </div>
  <button class="side" aria-label="Volume omhoog" {disabled} use:hold={{ fn: bump('up', onup), interval }}>
    <Icon path={mdiVolumePlus} size={28} />
  </button>
</div>

<style>
  .vol { display: grid; grid-template-columns: 76px 1fr 76px; gap: 10px; align-items: stretch; touch-action: none; }
  .disabled { opacity: 0.5; }
  button { border: 0; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; transition: transform 0.2s var(--spring), background 0.2s, color 0.2s; }
  .side {
    min-height: 92px; border-radius: 22px; display: grid; place-items: center; color: var(--accent);
    background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .side:global(.held) { transform: scale(0.92); background: var(--accent); color: #fff; box-shadow: 0 10px 26px -10px var(--accent); }
  .mid { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 22px; background: var(--surface-2); border: 1px solid var(--border); }
  .waves { display: flex; align-items: center; gap: 4px; height: 26px; }
  .waves i { display: block; width: 4px; height: calc(8px + var(--i) * 2.6px); border-radius: 2px; background: var(--text-3); opacity: 0.6; }
  .waves.up i { animation: wave-up 0.5s var(--ease) calc(var(--i) * 35ms) both; }
  .waves.down i { animation: wave-down 0.5s var(--ease) calc((6 - var(--i)) * 35ms) both; }
  .waves.mute i { animation: wave-mute 0.6s var(--ease) both; }
  @keyframes wave-up { 40% { background: var(--accent); opacity: 1; transform: scaleY(1.5); } }
  @keyframes wave-down { 40% { background: var(--accent); opacity: 1; transform: scaleY(0.4); } }
  @keyframes wave-mute { 30% { transform: scaleY(0.2); background: var(--danger); opacity: 1; } }
  .mute {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; min-height: 40px; border-radius: 999px;
    background: var(--surface-3); color: var(--text-2); font-weight: 600; font-size: 0.85rem;
  }
  .mute:global(.held) { transform: scale(0.94); background: var(--danger); color: #fff; }
</style>

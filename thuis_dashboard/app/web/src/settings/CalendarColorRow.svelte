<script>
  import { slide } from 'svelte/transition';
  import { household, saveHousehold } from '../lib/api.js';
  import { colorFor, PALETTE } from '../lib/colors.js';
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';

  /** @type {{ id: string, label: string, checked: boolean, onchange: (v: boolean) => void, open: boolean, ontoggleopen: () => void }} */
  let { id, label, checked, onchange, open, ontoggleopen } = $props();
  let preview = $state(/** @type {string|null} */ (null));

  const custom = $derived($household?.calendarColors?.[id] ?? null);
  const color = $derived(preview ?? colorFor(id, $household));

  function save(c) {
    preview = null;
    const next = { ...($household?.calendarColors ?? {}) };
    if (c) next[id] = c;
    else delete next[id];
    saveHousehold({ calendarColors: next });
  }
</script>

<div class="calrow" class:open style="--c:{color}">
  <div class="head">
    <button class="dot" onclick={ontoggleopen} aria-label="Kleur van {label} kiezen" aria-expanded={open}>
      <span></span>
    </button>
    <span class="grow ellipsis">{label}</span>
    <Toggle {checked} {onchange} />
  </div>
  {#if open}
    <div class="picker" transition:slide={{ duration: 260 }}>
      <div class="sw">
        {#each PALETTE as p (p)}
          <button class="swatch" class:sel={color.toLowerCase() === p} style="--s:{p}" onclick={() => save(p)} aria-label="Kleur {p}">
            {#if color.toLowerCase() === p}<Icon name="check" size={16} />{/if}
          </button>
        {/each}
        <label class="swatch custom" class:sel={!!custom && !PALETTE.includes(custom.toLowerCase())} title="Eigen kleur">
          <input type="color" value={color} oninput={(e) => (preview = e.currentTarget.value)} onchange={(e) => save(e.currentTarget.value)} aria-label="Eigen kleur" />
        </label>
      </div>
      {#if custom}
        <button class="btn ghost sm reset" onclick={() => save(null)}>Standaardkleur</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .calrow { border-radius: 12px; transition: background 0.25s; }
  .calrow.open { background: color-mix(in srgb, var(--c) 8%, transparent); }
  .head { display: flex; align-items: center; gap: 8px; padding: 6px 8px; }
  .dot { width: 34px; height: 34px; border-radius: 11px; border: 0; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; background: color-mix(in srgb, var(--c) 18%, transparent); transition: transform 0.2s var(--spring); }
  .dot:active { transform: scale(0.9); }
  .dot span { width: 16px; height: 16px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px -1px var(--c); transition: background 0.3s, transform 0.3s var(--spring); }
  .open .dot span { transform: scale(1.2); }
  .picker { padding: 4px 8px 10px 50px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .sw { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch {
    width: 32px; height: 32px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; color: #fff;
    background: var(--s); box-shadow: 0 3px 10px -4px var(--s); transition: transform 0.25s var(--spring), box-shadow 0.25s; animation: pop 0.35s var(--spring) both;
  }
  .swatch:hover { transform: scale(1.1); }
  .swatch.sel { box-shadow: 0 0 0 3px var(--surface-2), 0 0 0 5px var(--s); }
  .custom { --s: var(--text-3); background: conic-gradient(#ef4444, #f59e0b, #a3e635, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444); position: relative; overflow: hidden; }
  .custom.sel { --s: var(--c); }
  .custom input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; border: 0; padding: 0; }
  .reset { padding: 4px 8px; }
</style>

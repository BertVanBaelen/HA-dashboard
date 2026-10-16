<script>
  /** @type {{ label: string, initial?: string, picture?: string|null, color: string, active: boolean, count: number, onclick: () => void }} */
  let { label, initial = '', picture = null, color, active, count, onclick } = $props();
  let broken = $state(false);
</script>

<button class="pchip" class:active style="--pc:{color}" {onclick} aria-pressed={active} title={`${label}: ${count} agenda${count === 1 ? '' : "'s"}`}>
  <span class="av">
    {#if picture && !broken}<img src={picture} alt="" onerror={() => (broken = true)} />{:else}{(initial || label[0] || '?').toUpperCase()}{/if}
  </span>
  <span class="lbl">{label}</span>
  <span class="cnt num">{count}</span>
</button>

<style>
  .pchip {
    display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 4px 12px 4px 4px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-weight: 700; font-size: 0.9rem; white-space: nowrap;
    transition: background 0.3s var(--ease), color 0.3s, border-color 0.3s, transform 0.2s var(--spring), box-shadow 0.3s;
  }
  .pchip:active { transform: scale(0.93); }
  .pchip.active {
    background: linear-gradient(135deg, var(--pc), color-mix(in srgb, var(--pc) 70%, #000)); color: #fff; border-color: transparent;
    box-shadow: 0 8px 20px -8px var(--pc);
  }
  .av {
    width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; flex-shrink: 0;
    background: color-mix(in srgb, var(--pc) 22%, var(--surface-3)); color: var(--pc); font-weight: 800;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--pc) 45%, transparent); transition: box-shadow 0.3s, filter 0.3s;
    filter: grayscale(0.6);
  }
  .active .av { box-shadow: 0 0 0 2px #fff; color: #fff; background: color-mix(in srgb, #fff 25%, var(--pc)); filter: none; animation: pop 0.45s var(--spring); }
  .av img { width: 100%; height: 100%; object-fit: cover; }
  .cnt {
    font-size: 0.72rem; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center;
    background: color-mix(in srgb, var(--pc) 16%, transparent); color: var(--pc); transition: background 0.3s, color 0.3s;
  }
  .active .cnt { background: rgba(255, 255, 255, 0.25); color: #fff; }
</style>

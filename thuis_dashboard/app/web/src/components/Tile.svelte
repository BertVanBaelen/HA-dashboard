<script>
  import Icon from './Icon.svelte';
  /**
   * Square-ish action/toggle tile with a glowing icon when active.
   * @type {{ label: string, sub?: string, icon?: string, iconPath?: string, active?: boolean, color?: string, busy?: boolean,
   *   disabled?: boolean, onclick?: () => void, children?: import('svelte').Snippet }}
   */
  let { label, sub = '', icon = '', iconPath = '', active = false, color = '', busy = false, disabled = false, onclick, children } = $props();
</script>

<button class="tile" class:active class:busy {disabled} style={color ? `--tile-color:${color}` : ''} onclick={onclick}>
  <span class="ic">
    {#if busy}<span class="spinner"></span>{:else}<Icon name={icon} path={iconPath} size={24} />{/if}
  </span>
  <span class="txt">
    <span class="label ellipsis">{label}</span>
    {#if sub}<span class="sub ellipsis">{sub}</span>{/if}
  </span>
  {@render children?.()}
</button>

<style>
  .tile {
    --tile-color: var(--accent);
    display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 14px;
    min-height: 112px; padding: 14px; text-align: left; cursor: pointer; border-radius: var(--radius);
    border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    transition: transform 0.2s var(--spring), background 0.35s var(--ease), border-color 0.35s, box-shadow 0.35s;
    position: relative; overflow: hidden; width: 100%;
  }
  .tile::after {
    content: ''; position: absolute; inset: 0; opacity: 0; transition: opacity 0.4s var(--ease);
    background: radial-gradient(140% 100% at 0% 0%, color-mix(in srgb, var(--tile-color) 30%, transparent), transparent 70%);
    pointer-events: none;
  }
  .tile.active::after { opacity: 1; }
  .tile.active { border-color: color-mix(in srgb, var(--tile-color) 45%, transparent); box-shadow: var(--shadow), 0 10px 30px -14px var(--tile-color); }
  .tile:active { transform: scale(0.95); }
  .tile:disabled { opacity: 0.5; cursor: default; }
  .ic {
    width: 44px; height: 44px; border-radius: 15px; display: grid; place-items: center; position: relative; z-index: 1;
    background: var(--surface-2); color: var(--text-2);
    transition: background 0.35s var(--ease), color 0.35s, transform 0.4s var(--spring), box-shadow 0.35s;
  }
  .active .ic { background: var(--tile-color); color: #fff; box-shadow: 0 6px 20px -4px var(--tile-color); transform: rotate(-6deg) scale(1.05); }
  .txt { display: flex; flex-direction: column; min-width: 0; width: 100%; position: relative; z-index: 1; }
  .label { font-weight: 700; }
  .sub { font-size: 0.8rem; color: var(--text-2); }
  .spinner { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid currentColor; border-right-color: transparent; animation: spin 0.8s linear infinite; }
</style>

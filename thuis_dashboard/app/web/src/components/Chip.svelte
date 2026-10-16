<script>
  import Icon from './Icon.svelte';
  /** @type {{ label?: string, icon?: string, iconPath?: string, active?: boolean, color?: string, onclick?: () => void, disabled?: boolean, children?: import('svelte').Snippet }} */
  let { label = '', icon = '', iconPath = '', active = false, color = '', onclick, disabled = false, children } = $props();
</script>

<button class="chip" class:active {disabled} style={color ? `--chip-color:${color}` : ''} onclick={onclick}>
  {#if icon || iconPath}<Icon name={icon} path={iconPath} size={18} />{/if}
  {#if label}<span>{label}</span>{/if}
  {@render children?.()}
</button>

<style>
  .chip {
    --chip-color: var(--accent);
    display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border);
    background: var(--surface-2); padding: 8px 14px; border-radius: 999px; cursor: pointer; font-weight: 600; font-size: 0.88rem;
    transition: background 0.25s var(--ease), color 0.25s, border-color 0.25s, transform 0.18s var(--spring), box-shadow 0.25s;
    white-space: nowrap;
  }
  .chip:active { transform: scale(0.93); }
  .chip.active { background: var(--chip-color); color: #fff; border-color: transparent; box-shadow: 0 6px 16px -6px var(--chip-color); }
  .chip:disabled { opacity: 0.45; cursor: default; }
</style>

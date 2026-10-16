<script>
  import Icon from './Icon.svelte';
  /**
   * Segmented control with a sliding pill.
   * @type {{ options: {value:any,label:string,icon?:string,iconPath?:string,color?:string}[], value?: any, onchange?: (v:any)=>void, disabled?: boolean, size?: 'sm'|'md'|'lg' }}
   */
  let { options = [], value, onchange, disabled = false, size = 'md' } = $props();
  const idx = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
  const active = $derived(options.findIndex((o) => o.value === value) >= 0);
  const color = $derived(options[idx]?.color ?? '');
</script>

<div class="seg {size}" class:disabled style="--n:{options.length};--i:{idx};{color ? `--seg-color:${color}` : ''}">
  {#if active}<span class="pill"></span>{/if}
  {#each options as o (o.value)}
    <button class:sel={o.value === value} {disabled} onclick={() => o.value !== value && onchange?.(o.value)}>
      {#if o.icon || o.iconPath}<Icon name={o.icon} path={o.iconPath} size={size === 'lg' ? 22 : 18} />{/if}
      <span>{o.label}</span>
    </button>
  {/each}
</div>

<style>
  .seg {
    --seg-color: var(--accent);
    position: relative; display: grid; grid-template-columns: repeat(var(--n), 1fr);
    background: var(--surface-2); border-radius: 16px; padding: 4px; gap: 0; border: 1px solid var(--border);
  }
  .disabled { opacity: 0.6; }
  .pill {
    position: absolute; top: 4px; bottom: 4px; left: 4px;
    width: calc((100% - 8px) / var(--n));
    transform: translateX(calc(var(--i) * 100%));
    background: var(--seg-color); border-radius: 12px;
    box-shadow: 0 6px 18px -6px var(--seg-color);
    transition: transform 0.45s var(--spring), background 0.3s;
  }
  button {
    position: relative; z-index: 1; border: 0; background: none; cursor: pointer; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; padding: 9px 6px;
    color: var(--text-2); transition: color 0.3s; font-size: 0.9rem; min-width: 0;
  }
  button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lg button { padding: 14px 6px; font-size: 1rem; flex-direction: column; gap: 4px; }
  .sm button { padding: 6px 4px; font-size: 0.8rem; }
  button.sel { color: #fff; }
  button:active { transform: scale(0.96); }
</style>

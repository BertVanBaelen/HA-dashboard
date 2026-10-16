<script>
  import Icon from './Icon.svelte';
  /** @type {{ icon?: string, iconPath?: string, title?: string, text?: string, children?: import('svelte').Snippet }} */
  let { icon = 'info', iconPath = '', title = '', text = '', children } = $props();
</script>

<div class="empty">
  <span class="ic float"><Icon name={icon} path={iconPath} size={30} /></span>
  {#if title}<strong>{title}</strong>{/if}
  {#if text}<span class="muted small">{text}</span>{/if}
  {@render children?.()}
</div>

<style>
  .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 22px 12px; }
  .ic { width: 60px; height: 60px; border-radius: 20px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); margin-bottom: 4px; }
</style>

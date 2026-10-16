<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';
  /**
   * Bottom sheet (phone) / centered dialog (wide screens).
   * @type {{ open?: boolean, title?: string, onclose?: () => void, children?: import('svelte').Snippet, footer?: import('svelte').Snippet, wide?: boolean }}
   */
  let { open = $bindable(false), title = '', onclose, children, footer, wide = false } = $props();
  function close() {
    open = false;
    onclose?.();
  }
  function portal(node) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
  function onkey(e) {
    if (open && e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if open}
<div use:portal>
  <div class="backdrop" transition:fade={{ duration: 220 }} onclick={close} role="presentation"></div>
  <div class="sheet" class:wide role="dialog" aria-modal="true" aria-label={title} transition:fly={{ y: 400, duration: 420, easing: cubicOut, opacity: 1 }}>
    <div class="grab"></div>
    <header class="spread">
      <h2>{title}</h2>
      <button class="btn icon ghost" onclick={close} aria-label="Sluiten"><Icon name="close" /></button>
    </header>
    <div class="body">{@render children?.()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(5, 8, 20, 0.45); backdrop-filter: blur(4px); z-index: 90; }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 91;
    max-height: 88dvh; display: flex; flex-direction: column;
    background: var(--surface-solid); border-radius: 28px 28px 0 0; box-shadow: var(--shadow-lg);
    padding: 8px 18px calc(18px + var(--safe-bottom));
    border: 1px solid var(--border);
  }
  @media (min-width: 760px) {
    .sheet { left: 50%; right: auto; bottom: auto; top: 50%; transform: translate(-50%, -50%); width: min(520px, 92vw); border-radius: 28px; max-height: 84dvh; }
    .sheet.wide { width: min(820px, 94vw); }
    .grab { display: none; }
  }
  .grab { width: 42px; height: 5px; border-radius: 3px; background: var(--surface-3); margin: 4px auto 6px; }
  header { padding: 6px 0 10px; }
  h2 { font-size: 1.2rem; }
  .body { overflow-y: auto; overscroll-behavior: contain; padding-bottom: 6px; margin: 0 -4px; padding-inline: 4px; }
  footer { padding-top: 12px; display: flex; gap: 10px; justify-content: flex-end; }
</style>

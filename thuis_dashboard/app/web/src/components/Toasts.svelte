<script>
  import { flip } from 'svelte/animate';
  import { fly, fade } from 'svelte/transition';
  import { toasts } from '../lib/api.js';
  import Icon from './Icon.svelte';
</script>

<div class="toasts">
  {#each $toasts as t (t.id)}
    <div class="toast {t.kind}" animate:flip={{ duration: 300 }} in:fly={{ y: -30, duration: 400 }} out:fade={{ duration: 200 }}>
      <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'ok' ? 'check' : 'info'} size={20} />
      <span>{t.text}</span>
    </div>
  {/each}
</div>

<style>
  .toasts { position: fixed; top: calc(10px + var(--safe-top)); left: 50%; transform: translateX(-50%); z-index: 200; display: flex; flex-direction: column; gap: 8px; width: min(440px, 92vw); pointer-events: none; }
  .toast { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 16px; background: var(--surface-solid); box-shadow: var(--shadow-lg); border: 1px solid var(--border); font-weight: 600; font-size: 0.9rem; }
  .ok { color: var(--ok); } .error { color: var(--danger); } .info { color: var(--accent-text); }
  .toast span { color: var(--text); }
</style>

<script>
  /** @type {{ label: string, children?: import('svelte').Snippet }} */
  let { label, children } = $props();
</script>

<!-- svelte-ignore a11y_label_has_associated_control -->
<label class="setrow">
  <span class="lbl">{label}</span>
  <span class="ctl">{@render children?.()}</span>
</label>

<style>
  .setrow { display: grid; grid-template-columns: minmax(110px, 40%) 1fr; align-items: center; gap: 12px; margin: 8px 0; }
  .lbl { color: var(--text-2); font-size: 0.9rem; }
  .ctl { min-width: 0; }
</style>

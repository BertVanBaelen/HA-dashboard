<script>
  /** @type {{ text?: string, kind?: 'ok'|'warn'|'danger'|'info'|'accent'|'neutral', pulse?: boolean, children?: import('svelte').Snippet }} */
  let { text = '', kind = 'neutral', pulse = false, children } = $props();
</script>

<span class="badge {kind}" class:pulsing={pulse}>{#if pulse}<span class="dot"></span>{/if}{text}{@render children?.()}</span>

<style>
  .badge { --c: var(--text-2); display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); white-space: nowrap; }
  .ok { --c: var(--ok); } .warn { --c: var(--warn); } .danger { --c: var(--danger); } .info { --c: var(--info); } .accent { --c: var(--accent); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--c); --pulse: var(--c); animation: pulse-ring 1.6s infinite; }
</style>

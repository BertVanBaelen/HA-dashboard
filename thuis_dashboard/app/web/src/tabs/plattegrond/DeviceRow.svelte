<script>
  import Icon from '../../components/Icon.svelte';
  /**
   * One device line in the room sheet: glowing icon, label/sub and controls on the right.
   * @type {{ iconPath: string, label: string, sub?: string, active?: boolean, color?: string, spin?: boolean, dim?: boolean,
   *   children?: import('svelte').Snippet, below?: import('svelte').Snippet }}
   */
  let { iconPath, label, sub = '', active = false, color = 'var(--accent)', spin = false, dim = false, children, below } = $props();
</script>

<div class="dev" class:active class:dim style="--dc:{color}">
  <div class="line">
    <span class="ic" class:spin={spin && active}><Icon path={iconPath} size={22} /></span>
    <span class="txt">
      <span class="label ellipsis">{label}</span>
      {#if sub}<span class="sub ellipsis">{sub}</span>{/if}
    </span>
    <span class="ctl">{@render children?.()}</span>
  </div>
  {#if below}<div class="below">{@render below()}</div>{/if}
</div>

<style>
  .dev {
    display: flex; flex-direction: column; gap: 12px; padding: 12px; border-radius: var(--radius-sm);
    background: var(--surface-2); border: 1px solid var(--border);
    transition: border-color 0.4s var(--ease), box-shadow 0.4s var(--ease), background 0.4s;
  }
  .dev.active { border-color: color-mix(in srgb, var(--dc) 45%, var(--border)); box-shadow: 0 10px 28px -18px var(--dc); }
  .dev.dim { opacity: 0.6; }
  .line { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .ic {
    width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; flex-shrink: 0;
    background: var(--surface-3); color: var(--text-3);
    transition: background 0.4s var(--ease), color 0.3s, box-shadow 0.5s var(--ease);
  }
  .active .ic { background: var(--dc); color: #fff; box-shadow: 0 0 18px -2px var(--dc); }
  .active .ic :global(svg) { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3)); }
  .ic.spin :global(svg) { animation: spin 1.6s linear infinite; }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .label { font-weight: 600; }
  .sub { font-size: 0.8rem; color: var(--text-2); }
  .ctl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .below { display: flex; flex-direction: column; gap: 10px; }
  @media (prefers-reduced-motion: reduce) {
    .ic.spin :global(svg) { animation: none; }
  }
</style>

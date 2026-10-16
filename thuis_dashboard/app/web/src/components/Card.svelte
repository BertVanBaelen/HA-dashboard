<script>
  import Icon from './Icon.svelte';
  /**
   * Glassy card with optional header.
   * @type {{ title?: string, icon?: string, iconPath?: string, subtitle?: string, accent?: string, glow?: boolean,
   *   onclick?: () => void, class?: string, header?: import('svelte').Snippet, actions?: import('svelte').Snippet,
   *   children?: import('svelte').Snippet, pad?: boolean }}
   */
  let { title = '', icon = '', iconPath = '', subtitle = '', accent = '', glow = false, onclick, class: cls = '', header, actions, children, pad = true } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
  class="card {cls}"
  class:clickable={!!onclick}
  class:glow
  class:pad
  style={accent ? `--card-accent:${accent}` : ''}
  onclick={onclick}
  onkeydown={(e) => onclick && (e.key === 'Enter' || e.key === ' ') && onclick()}
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
>
  {#if header}
    {@render header()}
  {:else if title || icon || actions}
    <header class="spread">
      <div class="row grow">
        {#if icon || iconPath}
          <span class="card-icon"><Icon name={icon} path={iconPath} size={20} /></span>
        {/if}
        <div class="grow">
          {#if title}<h3>{title}</h3>{/if}
          {#if subtitle}<div class="small muted ellipsis">{subtitle}</div>{/if}
        </div>
      </div>
      {#if actions}<div class="row">{@render actions()}</div>{/if}
    </header>
  {/if}
  {@render children?.()}
</section>

<style>
  .card {
    --card-accent: var(--accent);
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease), border-color 0.35s, background 0.4s;
    overflow: hidden;
  }
  .card.pad { padding: 16px; }
  .card::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--card-accent) 10%, transparent), transparent 60%);
    pointer-events: none;
    opacity: 0.9;
  }
  .card > :global(*) { position: relative; }
  .card.glow { border-color: color-mix(in srgb, var(--card-accent) 40%, transparent); box-shadow: var(--shadow), 0 0 0 1px color-mix(in srgb, var(--card-accent) 20%, transparent), 0 10px 40px -12px color-mix(in srgb, var(--card-accent) 50%, transparent); }
  .clickable { cursor: pointer; }
  .clickable:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .clickable:active { transform: scale(0.98); }
  header { margin-bottom: 12px; }
  h3 { font-size: 1rem; }
  .card-icon {
    width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center;
    background: color-mix(in srgb, var(--card-accent) 16%, transparent);
    color: var(--card-accent);
  }
</style>

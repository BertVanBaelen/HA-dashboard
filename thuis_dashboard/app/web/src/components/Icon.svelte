<script>
  import { icons } from '../lib/icons.js';
  /** @type {{ name?: string, path?: string, size?: number|string, class?: string, style?: string }} */
  let { name = '', path = '', size = 22, class: cls = '', style = '' } = $props();
  const d = $derived(path || icons[name] || icons.info);
</script>

<svg class="icon {cls}" {style} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path {d} /></svg>

<style>
  .icon { fill: currentColor; flex-shrink: 0; display: block; transition: transform 0.3s var(--spring); }
</style>

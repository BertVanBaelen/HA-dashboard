<script>
  /** @type {{ checked?: boolean, disabled?: boolean, onchange?: (v: boolean) => void, label?: string, color?: string }} */
  let { checked = false, disabled = false, onchange, label = '', color = '' } = $props();
</script>

<button
  class="toggle"
  class:on={checked}
  {disabled}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  style={color ? `--toggle-color:${color}` : ''}
  onclick={(e) => { e.stopPropagation(); onchange?.(!checked); }}
>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    --toggle-color: var(--accent);
    width: 50px; height: 30px; border-radius: 999px; border: 0; padding: 0; cursor: pointer;
    background: var(--surface-3); position: relative; flex-shrink: 0;
    transition: background 0.3s var(--ease), box-shadow 0.3s;
  }
  .toggle.on { background: var(--toggle-color); box-shadow: 0 4px 14px -4px var(--toggle-color); }
  .toggle:disabled { opacity: 0.5; cursor: default; }
  .knob {
    position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%;
    background: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    transition: transform 0.35s var(--spring), width 0.2s var(--ease);
  }
  .toggle:active .knob { width: 30px; }
  .on .knob { transform: translateX(20px); }
  .on:active .knob { transform: translateX(14px); }
</style>

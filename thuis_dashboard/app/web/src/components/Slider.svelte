<script>
  /**
   * Chunky slider. `onchange` fires on release; `oninput` while dragging.
   * @type {{ value?: number, min?: number, max?: number, step?: number, disabled?: boolean, color?: string,
   *   track?: string, onchange?: (v:number)=>void, oninput?: (v:number)=>void, label?: string, format?: (v:number)=>string }}
   */
  let { value = 0, min = 0, max = 100, step = 1, disabled = false, color = '', track = '', onchange, oninput, label = '', format } = $props();
  let local = $state(0);
  let dragging = $state(false);
  $effect(() => { if (!dragging) local = value; });
  const pct = $derived(((local - min) / (max - min || 1)) * 100);
</script>

<div class="slider" class:disabled style="--pct:{pct}%;{color ? `--slider-color:${color};` : ''}{track ? `--slider-track:${track};` : ''}">
  {#if label || format}
    <div class="spread small"><span class="muted">{label}</span><span class="num val">{format ? format(local) : local}</span></div>
  {/if}
  <input
    type="range" {min} {max} {step} {disabled} aria-label={label}
    bind:value={local}
    onpointerdown={() => (dragging = true)}
    oninput={() => { dragging = true; oninput?.(Number(local)); }}
    onchange={() => { dragging = false; onchange?.(Number(local)); }}
  />
</div>

<style>
  .slider { --slider-color: var(--accent); --slider-track: linear-gradient(90deg, var(--slider-color) var(--pct), var(--surface-3) var(--pct)); display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .disabled { opacity: 0.5; }
  .val { font-weight: 600; }
  input { -webkit-appearance: none; appearance: none; width: 100%; height: 38px; border-radius: 14px; background: var(--slider-track); outline: none; margin: 0; cursor: pointer; overflow: hidden; transition: box-shadow 0.2s; }
  input:focus-visible { box-shadow: 0 0 0 3px var(--accent-soft); }
  input::-webkit-slider-thumb { -webkit-appearance: none; width: 6px; height: 22px; border-radius: 3px; background: #fff; box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.0), 0 2px 8px rgba(0, 0, 0, 0.35); margin-right: 8px; transition: transform 0.2s var(--spring); }
  input:active::-webkit-slider-thumb { transform: scaleY(1.2); }
  input::-moz-range-thumb { width: 6px; height: 22px; border-radius: 3px; background: #fff; border: 0; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); }
</style>

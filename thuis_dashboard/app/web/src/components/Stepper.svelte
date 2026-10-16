<script>
  import Icon from './Icon.svelte';
  /** @type {{ value: number, step?: number, min?: number, max?: number, unit?: string, digits?: number, disabled?: boolean, onchange?: (v:number)=>void, debounce?: number }} */
  let { value, step = 0.5, min = -Infinity, max = Infinity, unit = '°', digits = 1, disabled = false, onchange, debounce = 900 } = $props();
  let local = $state(null);
  let bump = $state(0);
  let timer;
  const shown = $derived(local ?? value);
  function change(d) {
    const next = Math.min(max, Math.max(min, Math.round(((shown ?? 0) + d) / step) * step));
    local = next;
    bump++;
    clearTimeout(timer);
    timer = setTimeout(() => {
      onchange?.(next);
      setTimeout(() => (local = null), 1500);
    }, debounce);
  }
</script>

<div class="stepper" class:disabled>
  <button class="btn icon" {disabled} onclick={() => change(-step)} aria-label="Lager"><Icon name="minus" /></button>
  {#key bump}
    <span class="val num" class:pending={local != null}>{shown == null ? '–' : Number(shown).toFixed(digits).replace('.', ',')}<small>{unit}</small></span>
  {/key}
  <button class="btn icon" {disabled} onclick={() => change(step)} aria-label="Hoger"><Icon name="plus" /></button>
</div>

<style>
  .stepper { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .disabled { opacity: 0.5; }
  .val { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; animation: pop 0.35s var(--spring); min-width: 4ch; text-align: center; }
  .val small { font-size: 1rem; font-weight: 600; color: var(--text-2); margin-left: 2px; }
  .pending { color: var(--accent-text); }
  .btn.icon { width: 48px; height: 48px; }
</style>

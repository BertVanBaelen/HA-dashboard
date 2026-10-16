<script>
  /** @type {{ value: string|null|undefined, disabled?: boolean, onchange: (v:string)=>void }} */
  let { value, disabled = false, onchange } = $props();
  const short = $derived(typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5).padStart(5, '0') : '');
</script>

<input
  class="input time"
  type="time"
  value={short}
  {disabled}
  onchange={(e) => {
    const v = e.currentTarget.value;
    if (v && v !== short) onchange(`${v}:00`);
  }}
/>

<style>
  .time { width: auto; min-width: 110px; min-height: 44px; font-variant-numeric: tabular-nums; font-weight: 700; text-align: center; }
</style>

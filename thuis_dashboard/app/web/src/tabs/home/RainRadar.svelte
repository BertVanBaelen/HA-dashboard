<script>
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';

  /** @type {{ open?: boolean }} */
  let { open = $bindable(false) } = $props();

  const BASE = 'https://image.buienradar.nl/2.0/image/animation/RadarMapRainBE?height=512&width=500&renderBackground=True&renderBranding=False&renderText=True';
  let stamp = $state(Date.now());
  let loaded = $state(false);
  let failed = $state(false);
  const src = $derived(`${BASE}&t=${Math.floor(stamp / 60e3)}`);

  function reload() {
    loaded = false;
    failed = false;
    stamp = Date.now();
  }

  $effect(() => {
    if (!open) return;
    reload();
    const t = setInterval(reload, 5 * 60e3);
    return () => clearInterval(t);
  });
</script>

<Sheet bind:open title="Buienradar">
  <div class="radar">
    {#if !loaded && !failed}<div class="ph skeleton"></div>{/if}
    {#if failed}
      <div class="ph err">
        <Icon name="wifiOff" size={28} />
        <span>Radarbeeld kon niet geladen worden</span>
        <button class="btn ghost" onclick={reload}>Opnieuw</button>
      </div>
    {:else}
      {#key src}
        <img {src} alt="Neerslagradar België" class:loaded onload={() => (loaded = true)} onerror={() => (failed = true)} />
      {/key}
    {/if}
  </div>
  <p class="tiny muted note">Neerslag van de afgelopen en komende uren · bron: Buienradar</p>
</Sheet>

<style>
  .radar { position: relative; width: 100%; max-width: 500px; margin: 0 auto; aspect-ratio: 500 / 512; border-radius: 16px; overflow: hidden; background: var(--surface-2); }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity 0.3s; }
  img.loaded { opacity: 1; }
  .ph { position: absolute; inset: 0; }
  .err { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-2); text-align: center; padding: 16px; }
  .note { text-align: center; margin: 10px 0 0; }
</style>

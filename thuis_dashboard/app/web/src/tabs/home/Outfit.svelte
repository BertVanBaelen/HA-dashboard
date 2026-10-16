<script>
  import { fly } from 'svelte/transition';

  /**
   * @type {{ temp: number|null, feel?: number|null, min?: number|null, max?: number|null, rainMm?: number, rainProb?: number, wind?: number|null, uv?: number|null, cond?: string }}
   */
  let { temp, feel = null, min = null, max = null, rainMm = 0, rainProb = 0, wind = null, uv = null, cond = '' } = $props();

  const advice = $derived.by(() => {
    const t = feel ?? temp;
    if (t == null || Number.isNaN(t)) return null;
    const lo = Math.min(t, min ?? t);
    const hi = Math.max(t, max ?? t);
    const rain = rainMm >= 0.3 || rainProb >= 60 || ['rainy', 'pouring', 'lightning-rainy'].includes(cond);
    const heavy = rainMm >= 5 || cond === 'pouring';
    const windy = (wind ?? 0) >= 30;
    const sunny = cond === 'sunny' || cond === 'partlycloudy';
    const items = [];
    const tips = [];

    if (rain) {
      if (windy || heavy) items.push({ e: '🧥', l: 'Regenjas', c: '#3b82f6' });
      else items.push({ e: '☂️', l: 'Paraplu', c: '#3b82f6' });
      tips.push(windy ? 'Regen én wind – laat de paraplu maar thuis' : heavy ? 'Flinke buien op komst' : 'Neem een paraplu mee');
    }
    if (t >= 22) {
      items.push({ e: '🩳', l: 'Korte broek', c: '#f59e0b' }, { e: '👕', l: 'T-shirt', c: '#f97316' });
      tips.push('Lekker warm, luchtig aankleden');
    } else if (t >= 17) {
      items.push({ e: '👕', l: 'T-shirt', c: '#f97316' });
      if (lo < 14) items.push({ e: '🧶', l: 'Vestje', c: '#a855f7' });
      tips.push(lo < 14 ? 'Neem een vestje mee voor later' : 'Aangenaam weer');
    } else if (t >= 10) {
      items.push({ e: '🧶', l: 'Trui', c: '#a855f7' });
      if (lo < 8 && !(rain && items[0].l === 'Regenjas')) items.push({ e: '🧥', l: 'Jas', c: '#64748b' });
      tips.push('Fris – trek een trui aan');
    } else if (t >= 5) {
      if (!items.some((i) => i.l === 'Regenjas')) items.push({ e: '🧥', l: 'Warme jas', c: '#64748b' });
      items.push({ e: '🧣', l: 'Sjaal', c: '#ef4444' });
      tips.push('Koud, kleed je warm aan');
    } else {
      items.push({ e: '🧥', l: 'Dikke jas', c: '#64748b' }, { e: '🧣', l: 'Muts & sjaal', c: '#ef4444' }, { e: '🧤', l: 'Handschoenen', c: '#06b6d4' });
      tips.push(t <= 0 ? 'Het vriest! Pas op voor gladheid' : 'Bijna vriesweer, pak je goed in');
    }
    if (!rain && sunny && (hi >= 20 || (uv ?? 0) >= 5)) {
      items.push({ e: '🕶️', l: 'Zonnebril', c: '#eab308' });
      if ((uv ?? 0) >= 5 || hi >= 25) {
        items.push({ e: '🧴', l: 'Zonnecrème', c: '#fb923c' });
        tips.push('Vergeet je zonnecrème niet');
      }
    }
    if (windy && !rain) {
      items.push({ e: '🌬️', l: 'Windjack', c: '#0ea5e9' });
      tips.push('Het waait stevig');
    }
    return { items: items.slice(0, 4), tip: tips.slice(0, 2).join(' · ') };
  });
</script>

{#if advice}
  <div class="outfit">
    <div class="items">
      {#each advice.items as it, i (it.l)}
        <div class="item" style="--c:{it.c}; --d:{i * 0.12}s" in:fly={{ y: 16, delay: 150 + i * 90, duration: 450 }}>
          <span class="bubble"><span class="emo" style="animation-delay:{1 + i * 0.4}s">{it.e}</span></span>
          <span class="lbl">{it.l}</span>
        </div>
      {/each}
    </div>
    {#if advice.tip}<p class="tip">{advice.tip}</p>{/if}
  </div>
{/if}

<style>
  .outfit { display: flex; flex-direction: column; gap: 10px; }
  .items { display: flex; justify-content: space-around; gap: 8px; flex-wrap: wrap; }
  .item { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 64px; flex: 1; }
  .bubble { width: 62px; height: 62px; border-radius: 22px; display: grid; place-items: center; background: color-mix(in srgb, var(--c) 18%, var(--surface-2)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 30%, transparent), 0 10px 22px -12px var(--c); animation: bounce-in 0.7s var(--spring) var(--d) both; transition: transform 0.3s var(--spring); }
  .item:hover .bubble { transform: scale(1.08) rotate(-4deg); }
  .emo { font-size: 2rem; line-height: 1; display: inline-block; animation: sway 3.2s ease-in-out infinite; }
  .lbl { font-size: 0.78rem; font-weight: 650; color: var(--text-2); text-align: center; }
  .tip { margin: 0; text-align: center; font-size: 0.85rem; color: var(--text-2); }
  @keyframes bounce-in {
    0% { transform: scale(0.3) translateY(10px); opacity: 0; }
    60% { transform: scale(1.12) translateY(-3px); opacity: 1; }
    100% { transform: scale(1) translateY(0); }
  }
  @keyframes sway {
    0%, 100% { transform: translateY(0) rotate(0); }
    25% { transform: translateY(-3px) rotate(-6deg); }
    50% { transform: translateY(0) rotate(0); }
    75% { transform: translateY(-2px) rotate(5deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .emo, .bubble { animation: none; }
  }
</style>

<script>
  import { fmtTime } from '../../lib/format.js';

  import Icon from '../../components/Icon.svelte';

  /** @type {{ hours: any[], onclick?: () => void }} */
  let { hours, onclick } = $props();

  const WET = 0.1;
  const mmFmt = (v) => (v ?? 0).toLocaleString('nl-BE', { maximumFractionDigits: 1, minimumFractionDigits: v > 0 && v < 10 ? 1 : 0 });

  const slots = $derived(
    hours.slice(0, 5).map((h, i) => ({
      key: h.datetime,
      label: i === 0 ? 'Nu' : fmtTime(h.datetime).slice(0, 2) + ':00',
      mm: Math.max(0, Number(h.precipitation) || 0),
      prob: h.precipitation_probability != null ? Number(h.precipitation_probability) : null,
    })),
  );
  const max = $derived(Math.max(1, ...slots.map((s) => s.mm)));
  const total = $derived(slots.reduce((a, s) => a + s.mm, 0));
  const firstWet = $derived(slots.findIndex((s) => s.mm >= WET));
  const wet = $derived(firstWet >= 0);

  const summary = $derived.by(() => {
    if (!wet) return { text: `Droog de komende ${slots.length} uur`, emoji: '☀️' };
    if (firstWet === 0) {
      const dry = slots.findIndex((s, i) => i > 0 && slots.slice(i).every((x) => x.mm < WET));
      if (dry > 0) return { text: `Regen tot ${slots[dry].label}, daarna droog`, emoji: '🌦️' };
      return { text: `Het regent – ${mmFmt(total)} mm de komende ${slots.length} uur`, emoji: '🌧️' };
    }
    const from = slots.slice(firstWet).reduce((a, s) => a + s.mm, 0);
    return { text: `Regen verwacht vanaf ${slots[firstWet].label} (${mmFmt(from)} mm)`, emoji: '☔' };
  });

  const drops = (mm) => (mm < WET ? 0 : mm < 0.8 ? 1 : mm < 2 ? 2 : 3);
</script>

<svelte:element this={onclick ? 'button' : 'div'} type={onclick ? 'button' : undefined} class="rain-chart" class:wet class:tap={!!onclick} {onclick} role={onclick ? 'button' : undefined} aria-label={onclick ? 'Toon buienradar' : undefined}>
  <div class="sum">
    <span class="emoji" class:bob={wet}>{summary.emoji}</span>
    <span class="txt">{summary.text}</span>
    {#if onclick}<span class="radar-hint"><Icon name="radar" size={14} />Radar<Icon name="chevronRight" size={14} /></span>{/if}
  </div>
  <div class="bars">
    {#each slots as s, i (s.key)}
      {@const h = (s.mm / max) * 100}
      <div class="slot" class:now={i === 0}>
        <span class="val num" class:zero={s.mm < WET} style="animation-delay:{0.25 + i * 0.08}s">{s.mm < WET ? '0' : mmFmt(s.mm)}<small>mm</small></span>
        <div class="track">
          {#if s.prob != null}
            <span class="prob" style="--h:{Math.min(100, s.prob)}%; animation-delay:{i * 0.08}s"></span>
          {/if}
          <span class="fill" class:empty={s.mm < WET} style="--h:{s.mm < WET ? 4 : Math.max(8, h)}%; animation-delay:{0.1 + i * 0.08}s"></span>
          {#each { length: drops(s.mm) } as _, d}
            <span class="drop" style="left:{25 + d * 25}%; animation-delay:{(i * 0.37 + d * 0.53) % 1.4}s"></span>
          {/each}
        </div>
        <span class="lbl">{s.label}</span>
        {#if s.prob != null}<span class="pct">{Math.round(s.prob)}%</span>{/if}
      </div>
    {/each}
  </div>
</svelte:element>

<style>
  .rain-chart { margin: 0 14px 12px; padding: 12px 12px 10px; border-radius: 18px; background: var(--surface-2); display: flex; flex-direction: column; gap: 10px; }
  .rain-chart.tap { font: inherit; color: inherit; text-align: inherit; border: 0; cursor: pointer; transition: transform 0.15s var(--ease); width: calc(100% - 28px); }
  .rain-chart.tap:active { transform: scale(0.98); }
  .radar-hint { margin-left: auto; display: inline-flex; align-items: center; gap: 2px; font-size: 0.75rem; font-weight: 600; color: var(--info); white-space: nowrap; }
  .rain-chart.wet { background: color-mix(in srgb, var(--info) 10%, var(--surface-2)); }
  .sum { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 0.92rem; }
  .emoji { font-size: 1.25rem; display: inline-block; animation: pop 0.6s var(--spring); }
  .emoji.bob { animation: pop 0.6s var(--spring); }
  .bars { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .slot { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
  .val { font-size: 0.78rem; font-weight: 700; color: var(--info); opacity: 0; animation: fade-up 0.4s var(--ease) forwards; white-space: nowrap; }
  .val small { font-size: 0.62rem; font-weight: 600; margin-left: 1px; opacity: 0.8; }
  .val.zero { color: var(--text-3); }
  .track { position: relative; width: 100%; max-width: 46px; height: 74px; border-radius: 12px; background: var(--surface-3); overflow: hidden; }
  .prob, .fill { position: absolute; left: 0; right: 0; bottom: 0; height: var(--h); transform-origin: bottom; transform: scaleY(0); animation: grow 0.8s var(--spring) forwards; }
  .prob { background: color-mix(in srgb, var(--info) 16%, transparent); border-top: 1px dashed color-mix(in srgb, var(--info) 45%, transparent); }
  .fill { border-radius: 10px 10px 0 0; background: linear-gradient(180deg, #60a5fa, #2563eb); box-shadow: 0 -4px 14px -4px color-mix(in srgb, #3b82f6 60%, transparent); }
  .fill.empty { background: var(--text-3); opacity: 0.35; box-shadow: none; }
  .drop { position: absolute; top: -10px; width: 3px; height: 9px; border-radius: 0 0 3px 3px / 0 0 4px 4px; background: linear-gradient(#93c5fd00, #60a5fa); animation: fall 1.4s linear infinite; }
  .slot.now .lbl { color: var(--accent); font-weight: 800; }
  .lbl { font-size: 0.75rem; font-weight: 600; color: var(--text-2); }
  .pct { font-size: 0.66rem; color: var(--text-3); margin-top: -3px; }
  @keyframes grow { to { transform: scaleY(1); } }
  @keyframes fall {
    0% { transform: translateY(0); opacity: 0; }
    15% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateY(70px); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .drop { display: none; }
  }
</style>

<script>
  import { onDestroy } from 'svelte';
  import Icon from '../../components/Icon.svelte';
  import { relTime } from '../../lib/format.js';
  import { loadBody } from './news.js';

  /**
   * One news item. Only the top card of the stack is interactive: it can be swiped away
   * sideways and shows the full article (when readable) below the summary.
   * @type {{ item: any, source: any, top?: boolean, ondismiss?: () => void }}
   */
  let { item, source, top = false, ondismiss } = $props();

  let imgFailed = $state(false);
  let body = $state(/** @type {{readable:boolean, blocks:any[], error?:string}|null} */ (null));
  $effect(() => {
    if (!top || !item.readable) return;
    let alive = true;
    loadBody(item.id).then((r) => alive && (body = r));
    return () => (alive = false);
  });

  const full = $derived(body?.readable && body.blocks.length > 0);
  const note = $derived(
    item.premium
      ? 'Betalend artikel: je leest het volledig op de site.'
      : !item.readable
        ? (source?.note ?? 'Van dit bericht is enkel de samenvatting beschikbaar.')
        : 'Het volledige artikel kon niet geladen worden.',
  );

  // ---- swipe ----
  let dx = $state(0);
  let dragging = $state(false);
  let gone = $state(false);
  /** @type {{x:number,y:number,t:number,id:number,axis:null|'x'|'y'}|null} */
  let start = null;
  let timer = 0;
  onDestroy(() => clearTimeout(timer));

  function down(e) {
    if (!top || gone || e.button > 0 || e.target.closest('a, button')) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, axis: null };
  }
  function move(e) {
    if (!start || e.pointerId !== start.id) return;
    const mx = e.clientX - start.x;
    const my = e.clientY - start.y;
    if (!start.axis) {
      if (Math.hypot(mx, my) < 8) return;
      start.axis = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
      if (start.axis === 'x') {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging = true;
      }
    }
    if (start.axis === 'x') dx = mx;
  }
  function up(e) {
    if (!start || e.pointerId !== start.id) return;
    const s = start;
    start = null;
    if (s.axis !== 'x') return;
    dragging = false;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - s.t);
    if (Math.abs(dx) > 110 || (speed > 0.6 && Math.abs(dx) > 40)) away(Math.sign(dx));
    else dx = 0;
  }
  export function away(dir = 1) {
    if (gone) return;
    gone = true;
    dx = dir * (innerWidth + 120);
    timer = setTimeout(() => ondismiss?.(), 260);
  }
</script>

<article
  class="card"
  class:top
  class:dragging
  class:gone
  style="--src:{source?.color ?? 'var(--accent)'};transform:translateX({dx}px) rotate({dx * 0.025}deg);opacity:{gone ? 0 : 1 - Math.min(Math.abs(dx) / 700, 0.4)}"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
>
  <div class="hero">
    {#if item.image && !imgFailed}
      <img src={item.image} alt="" referrerpolicy="no-referrer" loading={top ? 'eager' : 'lazy'} draggable="false" onerror={() => (imgFailed = true)} />
    {:else}
      <div class="noimg"><Icon name="newspaper" size={44} /></div>
    {/if}
    <div class="shade"></div>
    {#if top}
      <button class="btn icon close" onclick={() => away(1)} aria-label="Wegdoen" title="Wegdoen"><Icon name="close" size={20} /></button>
    {/if}
    <div class="cover-text">
      <span class="badge">{source?.name ?? item.source}{#if item.big}<Icon name="star" size={12} />{/if}</span>
      <h2>{item.title}</h2>
      {#if top}<span class="more"><Icon name="chevronDown" size={22} /></span>{/if}
    </div>
  </div>

  {#if top}
  <div class="content">
    <div class="meta tiny">
      <span>{relTime(item.published)}</span>
      {#if item.big}
        <span class="bigtag"><Icon name="star" size={13} />Groot nieuws</span>
        {#each item.why as w (w)}<span class="why">{w}</span>{/each}
      {/if}
      {#if item.premium}<span class="why">Betalend</span>{/if}
    </div>
    {#if item.summary}<p class="lead">{item.summary}</p>{/if}

      {#if item.readable && !body}
        <div class="loading">
          {#each [96, 88, 92, 60] as w (w)}<div class="skeleton line" style="width:{w}%"></div>{/each}
        </div>
      {:else if full}
        <div class="body">
          {#each body.blocks as b, i (i)}
            {#if b.t === 'h'}<h3>{b.text}</h3>
            {:else if b.t === 'li'}<p class="li">{b.text}</p>
            {:else if b.t === 'quote'}<blockquote>{b.text}</blockquote>
            {:else if b.t === 'img'}
              <figure>
                <img src={b.src} alt={b.caption ?? ''} loading="lazy" referrerpolicy="no-referrer" draggable="false" onerror={(e) => e.currentTarget.closest('figure')?.remove()} />
                {#if b.caption}<figcaption class="tiny muted">{b.caption}</figcaption>{/if}
              </figure>
            {:else}<p>{b.text}</p>{/if}
          {/each}
        </div>
      {:else}
        <p class="note small"><Icon name="info" size={18} />{note}</p>
      {/if}

      {#if !item.readable || body}
        <div class="actions">
          <a class="btn soft" href={item.url} target="_blank" rel="noopener noreferrer"><Icon name="openInNew" size={18} />{full ? 'Origineel' : 'Lees op de site'}</a>
          <button class="btn primary" onclick={() => away(1)}><Icon name="check" size={18} />{full ? 'Gelezen' : 'Volgende'}</button>
        </div>
      {/if}
  </div>
  {/if}
</article>

<style>
  .card {
    background: var(--surface-solid);
    border: 1px solid var(--border);
    border-radius: 26px;
    box-shadow: var(--shadow);
    overflow: hidden;
    touch-action: pan-y;
    transition: transform 0.28s var(--ease), opacity 0.28s var(--ease);
    will-change: transform;
  }
  .card.dragging { transition: none; user-select: none; cursor: grabbing; }
  .card.gone { pointer-events: none; }
  .hero { position: relative; height: var(--cover-h, 70dvh); background: color-mix(in srgb, var(--src) 22%, #111827); }
  .hero img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
  .noimg { position: absolute; inset: 0; display: grid; place-items: center; padding-bottom: 30%; color: #fff; background: radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--src) 70%, transparent), transparent 75%); }
  .shade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgb(0 0 0 / 0.25), transparent 22%, transparent 45%, rgb(0 0 0 / 0.82)); pointer-events: none; }
  .cover-text { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 20px 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; color: #fff; }
  .cover-text h2 { font-size: clamp(1.45rem, 4.8vw, 2rem); line-height: 1.2; text-shadow: 0 2px 12px rgb(0 0 0 / 0.5); }
  .badge { display: inline-flex; align-items: center; gap: 4px; background: var(--src); color: #fff; font-weight: 800; font-size: 0.78rem; padding: 4px 10px; border-radius: 999px; box-shadow: 0 4px 14px -4px rgb(0 0 0 / 0.5); }
  .more { align-self: center; opacity: 0.75; animation: nudge 2.2s ease-in-out infinite; }
  @keyframes nudge { 50% { transform: translateY(4px); } }
  .close { position: absolute; top: 10px; right: 10px; background: rgb(0 0 0 / 0.45); color: #fff; backdrop-filter: blur(6px); }
  .close:hover { background: rgb(0 0 0 / 0.6); }
  .content { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--text-3); font-weight: 600; }
  .bigtag { display: inline-flex; align-items: center; gap: 3px; color: var(--src); font-weight: 800; }
  .why { background: var(--surface-2); padding: 2px 8px; border-radius: 999px; }
  h2 { margin: 0; font-size: 1.32rem; line-height: 1.25; letter-spacing: -0.01em; }
  .lead { margin: 0; font-weight: 600; color: var(--text-2); line-height: 1.5; }
  .body { display: flex; flex-direction: column; gap: 12px; line-height: 1.62; font-size: 1.02rem; margin-top: 4px; }
  .body p, .body h3, .body blockquote, .body figure { margin: 0; }
  .body h3 { font-size: 1.08rem; margin-top: 6px; }
  .body .li { padding-left: 18px; position: relative; }
  .body .li::before { content: ''; position: absolute; left: 4px; top: 0.68em; width: 6px; height: 6px; border-radius: 50%; background: var(--src); }
  .body blockquote { border-left: 3px solid var(--src); padding: 2px 0 2px 14px; font-style: italic; color: var(--text-2); }
  .body figure img { width: 100%; border-radius: 14px; display: block; }
  .body figcaption { margin-top: 4px; }
  .loading { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
  .line { height: 14px; border-radius: 7px; }
  .note { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); color: var(--text-2); }
  .actions { display: flex; gap: 8px; margin-top: 6px; }
  .actions .btn { flex: 1; justify-content: center; text-decoration: none; }
</style>

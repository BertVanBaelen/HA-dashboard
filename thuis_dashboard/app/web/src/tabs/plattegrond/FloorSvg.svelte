<script>
  import { doorGeometry, shellRect } from '$shared/layout.js';
  import Furniture from './Furniture.svelte';

  /** @type {{ layout: any, uid?: string, inline?: boolean }} */
  let { layout, uid = 'fp', inline = false } = $props();

  const vb = $derived(layout?.viewBox ?? [0, 0, 300, 520]);
  const rooms = $derived(layout?.rooms ?? []);
  const decks = $derived(rooms.filter((r) => r.floor === 'deck'));
  const inside = $derived(rooms.filter((r) => r.floor !== 'deck'));
  const shell = $derived(shellRect(rooms));
  const doors = $derived((layout?.doors ?? []).map((d) => ({ id: d.id, ...doorGeometry(d) })));
  const range = (from, to, step) => Array.from({ length: Math.max(0, Math.floor((to - from) / step) + 1) }, (_, i) => from + i * step);
  const planks = (r) => range(r.rect[0] + 10, r.rect[0] + r.rect[2] - 10, 10);
  const steps = (r) => Array.from({ length: Math.max(0, Math.round((r.rect[3] - 8) / 8)) }, (_, i) => r.rect[1] + 6 + i * 8);
  const fill = (kind) => (kind === 'tile' ? `url(#${uid}-tile)` : kind === 'wood' ? `url(#${uid}-wood)` : undefined);
</script>

<svg class="floor" class:inline viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs>
    <pattern id="{uid}-tile" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" class="f-tile" />
      <path d="M10 0V10H0" class="tile-line" />
    </pattern>
    <pattern id="{uid}-wood" width="60" height="9" patternUnits="userSpaceOnUse">
      <rect width="60" height="9" class="f-wood" />
      <path d="M0 9H60M22 0V9M52 0V4.5" class="wood-line" />
    </pattern>
    {#each rooms as r (r.id)}
      <clipPath id="{uid}-c-{r.id}"><rect x={r.rect[0]} y={r.rect[1]} width={r.rect[2]} height={r.rect[3]} /></clipPath>
    {/each}
  </defs>

  {#each decks as r (r.id)}
    <rect x={r.rect[0]} y={r.rect[1]} width={r.rect[2]} height={r.rect[3]} class="f-deck" />
    {#each planks(r) as x (x)}<line x1={x} y1={r.rect[1] + 4} x2={x} y2={r.rect[1] + r.rect[3]} class="deck-line" />{/each}
  {/each}
  {#each layout?.decor ?? [] as d (d.id)}
    {#if d.kind === 'rail'}<line x1={d.x} y1={d.y} x2={d.x + (d.w ?? 20)} y2={d.y} class="rail" />{:else}<circle cx={d.x} cy={d.y} r="7" class="plant" />{/if}
  {/each}
  {#each decks as r (r.id)}
    {#if r.furniture}<g clip-path="url(#{uid}-c-{r.id})"><Furniture kind={r.furniture} rect={r.rect} /></g>{/if}
  {/each}

  {#if shell}<rect x={shell[0]} y={shell[1]} width={shell[2]} height={shell[3]} rx="2" class="wall" />{/if}
  {#each inside as r (r.id)}
    <rect x={r.rect[0]} y={r.rect[1]} width={r.rect[2]} height={r.rect[3]} class="floor-{r.floor}" fill={fill(r.floor)} />
  {/each}
  {#each doors as d (d.id)}<rect x={d.gap[0]} y={d.gap[1]} width={d.gap[2]} height={d.gap[3]} class="floor-plain" />{/each}
  {#each layout?.windows ?? [] as w (w.id)}
    {@const [x, y, ww, h] = w.rect}
    <rect {x} {y} width={ww} height={h} class="win" />
    {#if ww > h}<line x1={x} y1={y + h / 2} x2={x + ww} y2={y + h / 2} class="win-line" />{:else}<line x1={x + ww / 2} y1={y} x2={x + ww / 2} y2={y + h} class="win-line" />{/if}
  {/each}
  {#each doors as d (d.id)}{#if d.path}<path d={d.path} class="door" />{/if}{/each}

  {#each inside as r (r.id)}
    {#if r.floor === 'stair'}
      {@const [x, y, w, h] = r.rect}
      {#each steps(r) as sy (sy)}<line x1={x + 4} y1={sy} x2={x + w - 4} y2={sy} class="stair" />{/each}
      <path d="M{x + w / 2} {y + h - 6} V{y + 10} M{x + w / 2 - 5} {y + 16} L{x + w / 2} {y + 9} L{x + w / 2 + 5} {y + 16}" class="stair-arrow" />
    {/if}
    {#if r.furniture}<g clip-path="url(#{uid}-c-{r.id})"><Furniture kind={r.furniture} rect={r.rect} /></g>{/if}
  {/each}
</svg>

<style>
  .floor {
    --wall: #3a4256; --wood: #f4ede1; --wood-line: #e6dccb; --tile: #eef2f6; --tile-line: #dde4ec; --plain: #f1efe9;
    --deck: #e3ead8; --deck-line: #cfd9c1; --furn: #ffffff; --furn-stroke: #b6b1a6; --win: #bfe0f5; --door: #9aa3b5; --rug: #e9dfcf; --plant: #9fcf8a;
    position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: -2; pointer-events: none;
  }
  .floor.inline { position: static; z-index: auto; }
  :global([data-mode='dark']) .floor {
    --wall: #8796b8; --wood: #232b40; --wood-line: #2a3349; --tile: #1f2739; --tile-line: #283146; --plain: #222a3d;
    --deck: #1d2a2a; --deck-line: #253434; --furn: #2c354d; --furn-stroke: #4a5574; --win: #3b6d96; --door: #64708d; --rug: #2a3248; --plant: #3f7a4c;
  }
  .wall { fill: var(--wall); }
  .floor-wood { fill: var(--wood); }
  .floor-tile { fill: var(--tile); }
  .floor-plain, .floor-stair { fill: var(--plain); }
  .floor-deck { fill: var(--deck); }
  .f-wood { fill: var(--wood); }
  .f-tile { fill: var(--tile); }
  .wood-line { stroke: var(--wood-line); stroke-width: 0.6; fill: none; }
  .tile-line { stroke: var(--tile-line); stroke-width: 0.6; fill: none; }
  .f-deck { fill: var(--deck); }
  .deck-line { stroke: var(--deck-line); stroke-width: 1; }
  .rail { stroke: var(--wall); stroke-width: 2; stroke-dasharray: 2 4; }
  .win { fill: var(--win); }
  .win-line { stroke: var(--wall); stroke-width: 0.8; opacity: 0.5; }
  .door { fill: none; stroke: var(--door); stroke-width: 1; stroke-dasharray: 3 2; }
  .stair { stroke: var(--furn-stroke); stroke-width: 1; }
  .stair-arrow { fill: none; stroke: var(--door); stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
  .floor :global(.furn) { fill: var(--furn); stroke: var(--furn-stroke); stroke-width: 1; }
  .floor :global(.furn.soft) { fill: color-mix(in srgb, var(--furn-stroke) 18%, var(--furn)); }
  .floor :global(.furn.dark) { fill: var(--wall); stroke: none; }
  .floor :global(.furn-line) { fill: none; stroke: var(--furn-stroke); stroke-width: 1; }
  .floor :global(.rug) { fill: var(--rug); opacity: 0.8; }
  .floor :global(.plant) { fill: var(--plant); opacity: 0.85; }
</style>

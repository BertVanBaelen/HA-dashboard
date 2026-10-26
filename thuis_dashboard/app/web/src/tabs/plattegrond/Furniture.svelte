<script>
  /** Furniture drawings in the coordinates of the original plan; moved along with the room. */
  const ORIGIN = { terrace: [0, 0], mistique: [6, 50], bedroom: [102, 50], storage: [156, 180], bathroom: [6, 272], kitchen: [6, 380], living: [96, 272] };

  /** @type {{ kind: string, rect: number[] }} */
  let { kind, rect } = $props();
  const o = $derived(ORIGIN[kind] ?? [rect[0], rect[1]]);
</script>

<g transform="translate({rect[0] - o[0]} {rect[1] - o[1]})">
  {#if kind === 'terrace'}
    <rect x="120" y="12" width="34" height="20" rx="4" class="furn" />
    <circle cx="114" cy="22" r="5" class="furn" /><circle cx="160" cy="22" r="5" class="furn" />
  {:else if kind === 'mistique'}
    <rect x="12" y="140" width="46" height="20" rx="3" class="furn" />
    <circle cx="35" cy="128" r="7" class="furn" />
    <rect x="70" y="60" width="22" height="40" rx="3" class="furn" />
  {:else if kind === 'bedroom'}
    <rect x="150" y="62" width="74" height="88" rx="5" class="furn" />
    <rect x="156" y="68" width="29" height="16" rx="4" class="furn soft" />
    <rect x="189" y="68" width="29" height="16" rx="4" class="furn soft" />
    <path d="M150 96 H224" class="furn-line" />
    <rect x="130" y="64" width="14" height="14" rx="3" class="furn" />
    <rect x="230" y="64" width="14" height="14" rx="3" class="furn" />
    <rect x="270" y="90" width="18" height="70" rx="2" class="furn" />
  {:else if kind === 'storage'}
    <rect x="266" y="186" width="22" height="76" rx="2" class="furn" />
    {#each [204, 222, 240] as y (y)}<line x1="266" y1={y} x2="288" y2={y} class="furn-line" />{/each}
  {:else if kind === 'bathroom'}
    <rect x="10" y="300" width="32" height="70" rx="12" class="furn" />
    <rect x="15" y="306" width="22" height="58" rx="9" class="furn soft" />
    <rect x="58" y="296" width="28" height="16" rx="5" class="furn" />
    <circle cx="72" cy="304" r="4" class="furn-line" />
    <ellipse cx="78" cy="356" rx="7" ry="9" class="furn" />
    <rect x="70" y="366" width="16" height="7" rx="2" class="furn" />
  {:else if kind === 'kitchen'}
    <rect x="6" y="386" width="20" height="128" class="furn" />
    <rect x="26" y="494" width="62" height="20" class="furn" />
    {#each [[16, 404], [16, 420]] as [cx, cy] (cy)}<circle {cx} {cy} r="5" class="furn-line" />{/each}
    <rect x="9" y="446" width="14" height="22" rx="3" class="furn soft" />
    <rect x="42" y="420" width="30" height="44" rx="4" class="furn" />
  {:else if kind === 'living'}
    <rect x="200" y="280" width="72" height="6" rx="2" class="furn dark" />
    <rect x="180" y="362" width="104" height="80" rx="10" class="rug" />
    <rect x="206" y="384" width="52" height="28" rx="6" class="furn" />
    <path d="M176 470 H286 V500 H176 Z M176 470 V500 M286 470 V500" class="furn" />
    <rect x="180" y="474" width="102" height="10" rx="4" class="furn soft" />
    <rect x="110" y="410" width="40" height="70" rx="5" class="furn" />
    {#each [[104, 424], [104, 446], [104, 468], [156, 424], [156, 446], [156, 468]] as [cx, cy], i (i)}<circle {cx} {cy} r="4.5" class="furn" />{/each}
    <circle cx="282" cy="296" r="7" class="plant" />
  {/if}
</g>

<script>
  import { flip } from 'svelte/animate';
  import { mdiBatteryAlert, mdiBatteryCharging, mdiBattery } from '@mdi/js';
  import { states, household, topology } from '../../lib/api.js';
  import { allOpenings } from '../../lib/rooms.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { collectBatteries, levelColor } from './data.js';

  const items = $derived(collectBatteries($states, $household, allOpenings($topology)));
  const low = $derived(items.filter((i) => i.low).length);
</script>

<Card title="Batterijen" iconPath={mdiBattery} subtitle={items.length ? `${items.length} apparaten · laagste eerst` : ''} accent={low ? 'var(--danger)' : 'var(--ok)'} glow={low > 0}>
  {#snippet actions()}
    {#if low}<Badge kind="danger" pulse text="{low} laag" />{:else if items.length}<Badge kind="ok" text="Alles OK" />{/if}
  {/snippet}

  {#if !items.length}
    <EmptyState iconPath={mdiBattery} text="Geen batterijen gevonden" />
  {:else}
    <div class="list">
      {#each items as b, i (b.id)}
        {@const c = b.na ? 'var(--text-3)' : levelColor(b.pct ?? 100)}
        <div class="bat" class:low={b.low} class:na={b.na} style="--c:{c};--d:{i * 60}ms" animate:flip={{ duration: 400 }}>
          <span class="bic" class:charging={b.charging}>
            <Icon path={b.low ? mdiBatteryAlert : b.charging ? mdiBatteryCharging : b.icon} size={20} />
          </span>
          <div class="grow body">
            <div class="spread top">
              <span class="ellipsis lbl">{b.label}</span>
              <span class="val num">
                {#if b.na}<span class="faint small">Niet beschikbaar</span>
                {:else if b.binary}{b.low ? 'Laag' : 'OK'}
                {:else}{Math.round(b.pct ?? 0)}%{/if}
              </span>
            </div>
            <div class="bar"><span class="fill" class:charging={b.charging} style="width:{b.na ? 0 : b.pct}%"></span></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Card>

<style>
  .list { display: flex; flex-direction: column; gap: 6px; }
  .bat { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: var(--radius-sm); transition: background 0.3s; animation: fade-up 0.5s var(--ease) both; animation-delay: var(--d); }
  .bat.low { background: color-mix(in srgb, var(--danger) 11%, transparent); box-shadow: inset 3px 0 0 var(--danger); }
  .bat.na { opacity: 0.6; }
  .bic { width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent); transition: color 0.4s, background 0.4s; }
  .low .bic { --pulse: var(--danger); animation: pulse-ring 1.6s infinite; }
  .bic.charging :global(.icon) { --glow: var(--ok); }
  .body { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .top { gap: 8px; }
  .lbl { font-weight: 600; font-size: 0.92rem; }
  .val { font-weight: 800; color: var(--c); font-size: 0.9rem; flex-shrink: 0; }
  .bar { height: 8px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
  .fill { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 70%, transparent), var(--c)); box-shadow: 0 0 10px -2px var(--c); transition: width 0.9s var(--spring), background 0.4s; animation: grow 1.1s var(--ease) both; animation-delay: calc(var(--d) + 150ms); }
  .fill.charging { background-image: linear-gradient(90deg, color-mix(in srgb, var(--c) 60%, transparent), var(--c), color-mix(in srgb, var(--c) 60%, transparent)); background-size: 200% 100%; animation: grow 1.1s var(--ease) both, shimmer 2s linear infinite; }
  @keyframes grow { from { width: 0; } }
</style>

<script>
  import { mdiClockOutline, mdiMapMarkerOutline, mdiTextBoxOutline, mdiCalendarBlankOutline } from '@mdi/js';
  import { states, name } from '../../lib/api.js';
  import Sheet from '../../components/Sheet.svelte';
  import Icon from '../../components/Icon.svelte';
  import { fmtRange } from './util.js';

  /** @type {{ open?: boolean, event: any }} */
  let { open = $bindable(false), event } = $props();

  const cal = $derived(event ? name($states[event.calendar]) || event.calendar : '');
  const desc = $derived(
    (event?.description ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim(),
  );
</script>

<Sheet bind:open title={event?.summary ?? ''}>
  {#if event}
    <div class="detail" style="--c:{event.color}">
      <div class="hero">
        <span class="ic"><Icon path={mdiCalendarBlankOutline} size={26} /></span>
        <div class="col" style="gap:2px;min-width:0">
          <strong class="ellipsis">{event.summary}</strong>
          <span class="small muted">{cal}</span>
        </div>
      </div>
      <div class="line"><Icon path={mdiClockOutline} size={20} /><span>{fmtRange(event)}</span></div>
      {#if event.location}
        <a class="line link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener">
          <Icon path={mdiMapMarkerOutline} size={20} /><span>{event.location}</span>
        </a>
      {/if}
      {#if desc}
        <div class="line"><Icon path={mdiTextBoxOutline} size={20} /><span class="desc">{desc}</span></div>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .detail { display: flex; flex-direction: column; gap: 10px; }
  .hero {
    display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: var(--radius-sm);
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 22%, transparent), color-mix(in srgb, var(--c) 6%, transparent));
    border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
  }
  .ic { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--c); color: #fff; flex-shrink: 0; box-shadow: 0 8px 20px -8px var(--c); animation: pop 0.5s var(--spring); }
  .line { display: flex; align-items: flex-start; gap: 12px; padding: 8px 4px; color: var(--text); }
  .line :global(.icon) { color: var(--c); margin-top: 1px; }
  .link { text-decoration: none; }
  .link span { text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--c) 50%, transparent); text-underline-offset: 3px; }
  .desc { white-space: pre-wrap; word-break: break-word; color: var(--text-2); font-size: 0.92rem; }
</style>

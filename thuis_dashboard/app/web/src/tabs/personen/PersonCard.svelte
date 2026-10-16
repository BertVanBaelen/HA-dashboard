<script>
  import { fly, scale } from 'svelte/transition';
  import { mdiMapMarkerDistance, mdiCrosshairsGps, mdiOpenInNew, mdiWalk, mdiShoePrint, mdiPowerPlug, mdiLightningBolt, mdiHomeVariant, mdiMapMarkerQuestion, mdiMapMarkerRadius, mdiCellphone } from '@mdi/js';
  import { fmtTime, isSameDay, fmtDate, relTime } from '../../lib/format.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';
  import Badge from '../../components/Badge.svelte';
  import PersonAgenda from './PersonAgenda.svelte';
  import { fmtDistance, mapsUrl } from './geo.js';

  /**
   * @type {{ p: any, now: Date, agenda?: { active: any[], next: any[] }, selected?: boolean, onclick?: () => void }}
   * p = { key, name, color, person, tracker, battery, batteryState, charger, geocoded, hasGeocoded, steps, activity, pos, distance, picture }
   */
  let { p, now, agenda = { active: [], next: [] }, selected = false, onclick } = $props();

  const bad = (s) => !s || s.state === 'unavailable' || s.state === 'unknown' || s.state === '';
  const st = $derived(p.person?.state ?? 'unknown');
  const home = $derived(st === 'home');
  const away = $derived(st === 'not_home');
  const known = $derived(!bad(p.person));
  const label = $derived(home ? 'Thuis' : away ? 'Weg' : known ? st : 'Onbekend');
  const kind = $derived(home ? 'ok' : away ? 'neutral' : known ? 'info' : 'warn');

  function since(d, n) {
    if (!d) return '';
    const t = new Date(d);
    const when = isSameDay(t, n) ? fmtTime(t) : `${fmtDate(t)} ${fmtTime(t)}`;
    return `sinds ${when}`;
  }

  const lastChanged = $derived(p.person?.last_changed);
  const sinceText = $derived(since(lastChanged, now));
  const relText = $derived(now && relTime(lastChanged));
  const updatedText = $derived(now && relTime(p.tracker?.last_updated ?? p.person?.last_updated));

  const address = $derived(bad(p.geocoded) ? (p.tracker?.attributes?.address ?? null) : p.geocoded.state);
  const placeText = $derived(address ?? (home ? 'Thuis' : known && !away ? st : p.pos ? `${p.pos.lat.toFixed(4)}, ${p.pos.lon.toFixed(4)}` : null));
  const url = $derived(p.pos || address ? mapsUrl(p.pos, address) : null);

  const level = $derived(bad(p.battery) ? null : Math.round(Number(p.battery.state)));
  const bstate = $derived(bad(p.batteryState) ? '' : String(p.batteryState.state).toLowerCase());
  const charging = $derived(bstate === 'charging');
  const full = $derived(bstate === 'full');
  const low = $derived(level != null && level < 20);
  const chargerLabels = { ac: 'Stopcontact', usb: 'USB', wireless: 'Draadloos' };
  const charger = $derived(bad(p.charger) ? null : chargerLabels[String(p.charger.state).toLowerCase()] ?? null);
  const batColor = $derived(charging || full ? 'var(--ok)' : low ? 'var(--danger)' : level != null && level < 40 ? 'var(--warn)' : 'var(--ok)');
  const batText = $derived(charging ? (charger ? `Laadt op · ${charger}` : 'Laadt op') : full ? 'Volledig opgeladen' : low ? 'Batterij bijna leeg' : 'Op batterij');

  const steps = $derived(bad(p.steps) ? null : Number(p.steps.state));
  const activityLabels = { still: 'Stilstaand', stationary: 'Stilstaand', walking: 'Wandelen', running: 'Lopen', on_foot: 'Te voet', in_vehicle: 'In de auto', automotive: 'In de auto', on_bicycle: 'Fietsen', cycling: 'Fietsen', tilting: 'Kantelen', unknown: 'Onbekend' };
  const activity = $derived(bad(p.activity) ? null : activityLabels[String(p.activity.state).toLowerCase()] ?? p.activity.state);
</script>

<Card class="pcard {selected ? 'selected' : ''} {home ? 'is-home' : ''}" accent={p.color} glow={selected} {onclick}>
  <div class="top" style="--pc:{p.color}">
    <span class="avatar" class:home class:unknown={!known}>
      <span class="ring"></span>
      <span class="face">
        {#if p.picture}<img src={p.picture} alt="" />{:else}{p.name.slice(0, 1)}{/if}
      </span>
      <span class="dot"><Icon path={home ? mdiHomeVariant : known ? mdiMapMarkerRadius : mdiMapMarkerQuestion} size={12} /></span>
    </span>
    <div class="who col">
      <div class="row nm">
        <h3>{p.name}</h3>
        {#key label}
          <span in:scale={{ start: 0.7, duration: 300 }}><Badge text={label} {kind} pulse={home} /></span>
        {/key}
      </div>
      {#if lastChanged}
        <span class="small muted">{sinceText} · {relText}</span>
      {/if}
    </div>
    <span class="focus" class:on={selected} title="Toon op kaart"><Icon path={mdiCrosshairsGps} size={20} /></span>
  </div>

  <div class="rows">
    {#if placeText}
      {#if url}
        <a class="line place" href={url} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <span class="ic"><Icon name="mapMarker" size={18} /></span>
          <span class="grow txt">{placeText}{#if !address && away && !p.hasGeocoded}<span class="tiny faint hint">Geen adressensor</span>{/if}</span>
          <Icon path={mdiOpenInNew} size={16} class="faint" />
        </a>
      {:else}
        <div class="line place">
          <span class="ic"><Icon name="mapMarker" size={18} /></span>
          <span class="grow txt">{placeText}</span>
        </div>
      {/if}
    {:else}
      <div class="line"><span class="ic"><Icon name="mapMarker" size={18} /></span><span class="muted">Locatie niet beschikbaar</span></div>
    {/if}

    <PersonAgenda active={agenda.active} next={agenda.next} {now} />

    <div class="stats">
      <div class="stat">
        <span class="ic" style="--ic:{home ? 'var(--ok)' : p.color}"><Icon path={home ? mdiHomeVariant : mdiMapMarkerDistance} size={18} /></span>
        <span class="col">
          <span class="tiny muted">Afstand tot thuis</span>
          {#key p.distance == null ? '-' : Math.round(p.distance / 50)}
            <b class="num" in:fly={{ y: 6, duration: 250 }}>{home ? 'Thuis' : p.distance == null ? '–' : fmtDistance(p.distance)}</b>
          {/key}
        </span>
      </div>
      <div class="stat">
        <span class="ic" style="--ic:var(--info)"><Icon path={mdiCrosshairsGps} size={18} /></span>
        <span class="col">
          <span class="tiny muted">Locatie bijgewerkt</span>
          <b>{updatedText}</b>
        </span>
      </div>
      {#if steps != null && Number.isFinite(steps)}
        <div class="stat" in:scale={{ start: 0.9 }}>
          <span class="ic" style="--ic:#f59e0b"><Icon path={mdiShoePrint} size={18} /></span>
          <span class="col"><span class="tiny muted">Stappen vandaag</span><b class="num">{steps.toLocaleString('nl-BE')}</b></span>
        </div>
      {/if}
      {#if activity}
        <div class="stat" in:scale={{ start: 0.9 }}>
          <span class="ic" style="--ic:#8b5cf6"><Icon path={mdiWalk} size={18} /></span>
          <span class="col"><span class="tiny muted">Activiteit</span><b>{activity}</b></span>
        </div>
      {/if}
    </div>

    <div class="battery" class:charging class:low style="--bc:{batColor}">
      <span class="ic phone"><Icon path={mdiCellphone} size={18} /></span>
      {#if level == null || !Number.isFinite(level)}
        <span class="muted small grow">Batterij niet beschikbaar</span>
      {:else}
        <div class="col grow bt">
          <div class="spread">
            <span class="small">{batText}</span>
            <b class="num pct">{level}%</b>
          </div>
          <div class="bar"><span class="fill" style="width:{Math.max(3, Math.min(100, level))}%"></span></div>
        </div>
        <span class="bolt" class:show={charging}>
          <Icon path={charger && charger !== 'Draadloos' ? mdiPowerPlug : mdiLightningBolt} size={20} />
        </span>
      {/if}
    </div>
  </div>
</Card>

<style>
  :global(.card.pcard) { transition: transform 0.35s var(--spring), box-shadow 0.35s; }
  :global(.card.pcard.selected) { transform: translateY(-2px); box-shadow: 0 0 0 2px var(--card-accent), var(--shadow-lg); }
  .top { display: flex; align-items: center; gap: 14px; }
  .avatar { position: relative; width: 68px; height: 68px; flex-shrink: 0; display: grid; place-items: center; }
  .ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, var(--pc), color-mix(in srgb, var(--pc) 30%, transparent), var(--pc)); opacity: 0.5; transition: opacity 0.4s; }
  .avatar.home .ring { background: conic-gradient(from 0deg, var(--ok), color-mix(in srgb, var(--ok) 20%, transparent), var(--ok)); opacity: 1; }
  .face { position: relative; width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--pc); color: #fff; font-weight: 800; font-size: 1.5rem; border: 3px solid var(--surface-solid); transition: filter 0.4s, transform 0.4s var(--spring); }
  .avatar.unknown .face { filter: grayscale(0.8) opacity(0.7); }
  .face img { width: 100%; height: 100%; object-fit: cover; }
  .dot { position: absolute; right: -2px; bottom: -2px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--text-3); border: 3px solid var(--surface-solid); transition: background 0.4s; }
  .avatar.home .dot { background: var(--ok); --pulse: var(--ok); }
  :global(.card.pcard:active) .face { transform: scale(0.94); }
  .who { gap: 2px; min-width: 0; flex: 1; }
  .nm { gap: 8px; flex-wrap: wrap; }
  h3 { margin: 0; font-size: 1.25rem; }
  .focus { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; color: var(--text-3); background: var(--surface-2); transition: color 0.3s, background 0.3s, transform 0.4s var(--spring); }
  .focus.on { color: #fff; background: var(--pc); transform: rotate(90deg); }

  .rows { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
  .line { display: flex; align-items: center; gap: 10px; padding: 10px 12px; min-height: 44px; border-radius: 14px; background: var(--surface-2); color: var(--text); text-decoration: none; }
  a.line { transition: background 0.2s, transform 0.2s var(--spring); }
  a.line:hover { background: var(--surface-3); }
  a.line:active { transform: scale(0.98); }
  .txt { display: flex; flex-direction: column; font-weight: 600; line-height: 1.3; }
  .hint { font-weight: 500; }
  .ic { --ic: var(--accent); width: 34px; height: 34px; flex-shrink: 0; border-radius: 11px; display: grid; place-items: center; color: var(--ic); background: color-mix(in srgb, var(--ic) 15%, transparent); }
  .place .ic { --ic: var(--pc, var(--accent)); }

  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 14px; background: var(--surface-2); min-width: 0; }
  .stat .col { gap: 0; min-width: 0; }
  .stat b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .battery { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); transition: background 0.4s; }
  .battery.charging { background: color-mix(in srgb, var(--ok) 12%, var(--surface-2)); }
  .battery.low { background: color-mix(in srgb, var(--danger) 12%, var(--surface-2)); }
  .phone { --ic: var(--bc); }
  .bt { gap: 6px; }
  .pct { color: var(--bc); font-size: 1.05rem; }
  .low .pct { animation: pop 0.6s var(--spring); }
  .bar { position: relative; height: 10px; border-radius: 5px; background: var(--surface-3); overflow: hidden; }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; background: var(--bc); transition: width 0.8s var(--ease), background 0.4s; }
  .charging .fill {
    background-image: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.55) 50%, transparent 70%), linear-gradient(var(--bc), var(--bc));
    background-size: 200% 100%, 100% 100%;
    animation: shimmer 1.6s linear infinite;
  }
  .bolt { width: 0; opacity: 0; color: var(--ok); overflow: hidden; transition: width 0.3s var(--ease), opacity 0.3s; display: grid; place-items: center; }
  .bolt.show { width: 24px; opacity: 1; --glow: var(--ok); }

</style>

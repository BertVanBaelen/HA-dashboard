<script>
  import { onMount } from 'svelte';
  import { mdiBellRingOutline, mdiBellOffOutline } from '@mdi/js';
  import { PEOPLE } from '$shared/config.js';
  import { prefs, user, savePrefs } from '../../lib/api.js';
  import Card from '../../components/Card.svelte';
  import Icon from '../../components/Icon.svelte';

  const OPTIONS = [
    { label: '1 uur', ms: 3600e3 },
    { label: '2 uur', ms: 2 * 3600e3 },
    { label: '4 uur', ms: 4 * 3600e3 },
    { label: '8 uur', ms: 8 * 3600e3 },
    { label: 'Tot morgen', ms: null },
  ];

  let now = $state(Date.now());
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 15e3);
    return () => clearInterval(t);
  });

  const until = $derived(Number($prefs?.presenceWatchUntil) || 0);
  const active = $derived(until > now);
  const hasNotify = $derived(!!$prefs?.notifyService || !!PEOPLE.find((p) => p.person === $user?.person)?.notify);

  const left = $derived.by(() => {
    const m = Math.max(0, Math.round((until - now) / 60e3));
    return m >= 60 ? `${Math.floor(m / 60)} u ${String(m % 60).padStart(2, '0')}` : `${m} min`;
  });
  const untilText = $derived(new Date(until).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }));

  function start(ms) {
    let t;
    if (ms == null) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      t = d.getTime();
    } else t = Date.now() + ms;
    now = Date.now();
    savePrefs({ presenceWatchUntil: t });
  }

  function stop() {
    savePrefs({ presenceWatchUntil: null });
  }
</script>

<Card title="Komen & gaan" iconPath={active ? mdiBellRingOutline : mdiBellOffOutline}>
  <div class="watch" class:active>
    {#if active}
      <div class="state">
        <span class="pulse"><Icon path={mdiBellRingOutline} size={20} /></span>
        <div class="col">
          <b>Meldingen staan aan tot {untilText}</b>
          <span class="small muted">Je krijgt een melding als iemand thuiskomt of vertrekt · nog {left}</span>
        </div>
      </div>
      <button class="btn" onclick={stop}>Stoppen</button>
    {:else}
      <span class="small muted">Krijg een tijdelijke melding wanneer iemand thuiskomt of vertrekt.</span>
      <div class="opts">
        {#each OPTIONS as o (o.label)}
          <button class="opt" onclick={() => start(o.ms)}>{o.label}</button>
        {/each}
      </div>
    {/if}
    {#if !hasNotify}
      <span class="tiny warn">Er is nog geen meldingsdienst voor jou ingesteld (Instellingen → Thuiskomst → Meldingen naar).</span>
    {/if}
  </div>
</Card>

<style>
  .watch { display: flex; flex-direction: column; gap: 12px; }
  .state { display: flex; align-items: center; gap: 12px; }
  .pulse { width: 40px; height: 40px; flex: none; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); animation: ring 2.4s ease-in-out infinite; }
  .opts { display: flex; flex-wrap: wrap; gap: 8px; }
  .opt { min-height: 44px; padding: 0 16px; border: none; border-radius: 999px; font: inherit; font-weight: 700; font-size: 0.88rem; color: var(--text); background: var(--surface-2); cursor: pointer; transition: transform 0.2s var(--spring), background 0.2s; }
  .opt:hover { background: var(--surface-3); }
  .opt:active { transform: scale(0.94); }
  .warn { color: var(--warning, var(--danger)); }
  @keyframes ring {
    0%, 70%, 100% { transform: rotate(0); }
    75% { transform: rotate(14deg); }
    80% { transform: rotate(-12deg); }
    85% { transform: rotate(8deg); }
    90% { transform: rotate(-4deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse { animation: none; }
  }
</style>

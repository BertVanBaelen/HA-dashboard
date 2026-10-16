<script>
  import { slide } from 'svelte/transition';
  import { mdiHomeImportOutline, mdiCheckCircle } from '@mdi/js';
  import { START_DASHBOARD } from '$shared/config.js';
  import { action } from '../lib/api.js';
  import Icon from '../components/Icon.svelte';

  let busy = $state(false);
  let done = $state(localStorage.getItem('startpage.done') === '1');

  async function setup() {
    busy = true;
    try {
      await action('setupStartDashboard', {}, 'Startpagina klaargezet');
      done = true;
      localStorage.setItem('startpage.done', '1');
    } catch {
      /* toast already shown */
    } finally {
      busy = false;
    }
  }
</script>

<h4 class="section-title">Startpagina</h4>
<div class="start">
  <div class="row head">
    <span class="ic" class:done><Icon path={done ? mdiCheckCircle : mdiHomeImportOutline} size={24} /></span>
    <span class="col grow">
      <b>Open dit dashboard meteen bij het starten van Home Assistant</b>
      <span class="tiny muted">Maakt een klein dashboard "{START_DASHBOARD.title}" aan dat direct doorverwijst naar Thuis.</span>
    </span>
  </div>
  <button class="btn primary block" disabled={busy} onclick={setup}>
    {#if busy}<span class="spinner"></span> Bezig…{:else}{done ? 'Opnieuw instellen' : 'Zet als startpagina'}{/if}
  </button>
  {#if done}
    <ol class="steps" transition:slide>
      <li>Klik linksonder in Home Assistant op je <b>profiel</b> (je naam).</li>
      <li>Kies bij <b>Dashboard</b> → <b>Standaard dashboard</b> voor <b>{START_DASHBOARD.title}</b>.</li>
      <li>Klaar! Dit geldt per gebruiker en per toestel – ook in de Companion-app. Doe dit dus ook op de gsm van de ander.</li>
    </ol>
  {/if}
</div>

<style>
  .start { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
  .head { gap: 12px; align-items: flex-start; }
  .ic { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 14px; background: var(--accent-soft); color: var(--accent-text); transition: background 0.4s, color 0.4s; }
  .ic.done { background: color-mix(in srgb, var(--ok) 18%, transparent); color: var(--ok); animation: pop 0.5s var(--spring); }
  .steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: var(--text-2); }
  .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff; display: inline-block; margin-right: 6px; vertical-align: -3px; animation: spin 0.8s linear infinite; }
  @keyframes pop { 0% { transform: scale(0.6); } 100% { transform: scale(1); } }
</style>

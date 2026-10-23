<script>
  import { NEWS_SOURCES, NEWS_MODES } from '$shared/config.js';
  import { prefs, savePrefs } from '../../lib/api.js';
  import Segmented from '../../components/Segmented.svelte';

  const HINT = { alles: 'Alle berichten', groot: 'Enkel grote verhalen', uit: 'Niet tonen' };

  function setMode(id, mode) {
    savePrefs({ news: { ...$prefs.news, sources: { ...$prefs.news.sources, [id]: mode } } });
  }
</script>

<div class="srcs">
  {#each NEWS_SOURCES as s (s.id)}
    {@const mode = $prefs.news?.sources?.[s.id] ?? s.mode}
    <div class="src">
      <div class="name">
        <span class="dot" style="--c:{s.color}"></span>
        <strong>{s.name}</strong>
        <span class="tiny faint">{HINT[mode]}{s.body === 'none' ? ' · enkel samenvatting' : ''}</span>
      </div>
      <Segmented size="sm" value={mode} onchange={(m) => setMode(s.id, m)} options={NEWS_MODES.map((o) => ({ ...o, color: o.value === 'uit' ? undefined : s.color }))} />
    </div>
  {/each}
  <p class="tiny faint note">
    “Belangrijk” toont per dag enkel de grootste verhalen: onderwerpen die ook andere bronnen brengen, of over bv. de Rode Duivels, een WK, een wereldrecord, een storing of een datalek.
  </p>
</div>

<style>
  .srcs { display: flex; flex-direction: column; gap: 14px; }
  .src { display: flex; flex-direction: column; gap: 6px; }
  .name { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); align-self: center; flex-shrink: 0; }
  .note { margin: 0; }
</style>

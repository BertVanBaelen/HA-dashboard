<script>
  import { untrack } from 'svelte';
  import { states, name, callService } from '../../lib/api.js';
  import { haDate, haDateTime, parseHaDate } from '../../lib/calendar.js';
  import { colorFor } from '../../lib/colors.js';
  import { isSameDay, startOfDay } from '../../lib/format.js';
  import Sheet from '../../components/Sheet.svelte';
  import Chip from '../../components/Chip.svelte';
  import Toggle from '../../components/Toggle.svelte';
  import { addDays } from './util.js';

  /** @type {{ open?: boolean, date?: Date, calendars: string[], oncreated?: () => void }} */
  let { open = $bindable(false), date = new Date(), calendars, oncreated } = $props();

  const pad = (n) => String(n).padStart(2, '0');
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  let title = $state('');
  let cal = $state('');
  let allDay = $state(false);
  let startD = $state('');
  let startT = $state('');
  let endD = $state('');
  let endT = $state('');
  let location = $state('');
  let description = $state('');
  let busy = $state(false);
  let shake = $state(false);

  function reset() {
    const s = startOfDay(date);
    const now = new Date();
    if (isSameDay(s, now)) s.setHours(Math.min(now.getHours() + 1, 23));
    else s.setHours(9);
    const e = new Date(s.getTime() + 3600e3);
    title = '';
    location = '';
    description = '';
    allDay = false;
    if (!calendars.includes(cal)) cal = calendars[0] ?? '';
    startD = haDate(s);
    startT = hm(s);
    endD = haDate(e);
    endT = hm(e);
  }

  $effect(() => {
    if (open) untrack(reset);
  });

  const toDate = (d, t) => new Date(`${d}T${t || '00:00'}`);
  const valid = $derived.by(() => {
    if (!title.trim() || !cal || !startD || !endD) return false;
    if (allDay) return endD >= startD;
    return toDate(endD, endT) > toDate(startD, startT);
  });

  function onStart() {
    if (allDay) {
      if (endD < startD) endD = startD;
      return;
    }
    const s = toDate(startD, startT);
    if (!(toDate(endD, endT) > s)) {
      const e = new Date(s.getTime() + 3600e3);
      endD = haDate(e);
      endT = hm(e);
    }
  }

  async function submit(ev) {
    ev?.preventDefault();
    if (!valid) {
      shake = true;
      setTimeout(() => (shake = false), 500);
      return;
    }
    const data = { summary: title.trim() };
    if (location.trim()) data.location = location.trim();
    if (description.trim()) data.description = description.trim();
    if (allDay) {
      data.start_date = startD;
      data.end_date = haDate(addDays(parseHaDate(endD), 1));
    } else {
      data.start_date_time = haDateTime(toDate(startD, startT));
      data.end_date_time = haDateTime(toDate(endD, endT));
    }
    busy = true;
    try {
      await callService('calendar', 'create_event', data, cal, 'Afspraak toegevoegd 🎉');
      open = false;
      oncreated?.();
    } catch {
    } finally {
      busy = false;
    }
  }
</script>

<Sheet bind:open title="Nieuwe afspraak">
  <form class="form" class:shake onsubmit={submit}>
    <label class="field">Titel
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" bind:value={title} placeholder="Bv. Tandarts" maxlength="120" autofocus />
    </label>
    <div class="field">
      <span>Agenda</span>
      <div class="wrap row" style="gap:8px">
        {#each calendars as c (c)}
          <Chip label={name($states[c]) || c} color={colorFor(c)} active={cal === c} onclick={() => (cal = c)} />
        {/each}
      </div>
    </div>
    <div class="spread allday">
      <span>Hele dag</span>
      <Toggle checked={allDay} onchange={(v) => { allDay = v; onStart(); }} />
    </div>
    <div class="grid-2 dt">
      <label class="field">Start
        <input class="input" type="date" bind:value={startD} onchange={onStart} />
        {#if !allDay}<input class="input" type="time" bind:value={startT} onchange={onStart} />{/if}
      </label>
      <label class="field">Einde
        <input class="input" type="date" bind:value={endD} min={startD} />
        {#if !allDay}<input class="input" type="time" bind:value={endT} />{/if}
      </label>
    </div>
    <label class="field">Locatie
      <input class="input" bind:value={location} placeholder="Optioneel" />
    </label>
    <label class="field">Beschrijving
      <textarea class="input" rows="3" bind:value={description} placeholder="Optioneel"></textarea>
    </label>
    <button type="submit" hidden aria-hidden="true"></button>
  </form>
  {#snippet footer()}
    <button class="btn ghost" onclick={() => (open = false)}>Annuleren</button>
    <button class="btn primary" disabled={busy || !valid} onclick={submit}>
      {#if busy}<span class="spinner spin"></span>{/if}Opslaan
    </button>
  {/snippet}
</Sheet>

<style>
  .form { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
  div.field { display: flex; flex-direction: column; gap: 8px; }
  div.field > span { font-size: 0.85rem; color: var(--text-2); }
  .allday { padding: 4px 2px; font-weight: 600; }
  .dt .field { gap: 8px; }
  textarea.input { resize: vertical; font: inherit; }
  .shake { animation: wiggle 0.4s; }
  .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff; display: inline-block; margin-right: 6px; vertical-align: -3px; }
</style>

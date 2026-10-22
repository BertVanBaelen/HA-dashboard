<script module>
  const cache = new Map();
</script>

<script>
  import { untrack, onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { mdiCalendarMonth, mdiCalendarWeek, mdiViewAgendaOutline, mdiCalendarPlus, mdiCalendarToday, mdiCalendarRemoveOutline, mdiRefresh, mdiAccountMultipleOutline } from '@mdi/js';
  import { flip } from 'svelte/animate';
  import { scale, fly, fade } from 'svelte/transition';
  import { PEOPLE } from '$shared/config.js';
  import { states, prefs, household, user, others, name } from '../../lib/api.js';
  import { fetchEvents } from '../../lib/calendar.js';
  import { colorFor, PALETTE, PERSON_COLORS } from '../../lib/colors.js';
  import PersonChip from './PersonChip.svelte';
  import { startOfDay } from '../../lib/format.js';
  import { openSettings } from '../../lib/nav.js';
  import Card from '../../components/Card.svelte';
  import Chip from '../../components/Chip.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Icon from '../../components/Icon.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import MonthGrid from './MonthGrid.svelte';
  import WeekGrid from './WeekGrid.svelte';
  import EventRow from './EventRow.svelte';
  import EventDetail from './EventDetail.svelte';
  import CreateEvent from './CreateEvent.svelte';
  import { addDays, weekStart, groupByDay, dayKey, dayLabel, cap, swipe, evKey } from './util.js';

  const VKEY = 'agenda.view';
  let view = $state(['month', 'week', 'list'].includes(sessionStorage.getItem(VKEY) ?? '') ? sessionStorage.getItem(VKEY) : 'month');
  let anchor = $state(startOfDay());
  let dir = $state(1);
  let hidden = $state(/** @type {string[]} */ ([]));
  let events = $state(/** @type {any[]|null} */ (null));
  let failed = $state(false);
  let refreshing = $state(false);

  let daySel = $state(/** @type {Date|null} */ (null));
  let dayOpen = $state(false);
  let detail = $state(/** @type {any} */ (null));
  let detailOpen = $state(false);
  let createOpen = $state(false);
  let createDate = $state(new Date());

  const PKEY = 'agenda.people';
  let activePeople = $state(/** @type {string[]} */ (readPeople()));

  function readPeople() {
    try {
      const v = JSON.parse(localStorage.getItem(PKEY) ?? 'null');
      if (Array.isArray(v)) return v;
    } catch {}
    return ['me'];
  }

  const exists = (id) => !!$states[id] || !Object.keys($states).length;
  const people = $derived.by(() => {
    const colorOf = (person, i) => {
      const key = PEOPLE.find((p) => p.person === person)?.key;
      return (key && PERSON_COLORS[key]) || PALETTE[(i * 5 + 1) % PALETTE.length];
    };
    const pic = (person) => (person && $states[person]?.attributes?.entity_picture) || null;
    const me = { id: 'me', label: 'Ik', initial: ($user?.displayName || $user?.name || 'Ik')[0], person: $user?.person ?? null, calendars: ($prefs?.calendars ?? []).filter(exists) };
    const rest = ($others ?? [])
      .map((o) => {
        const label = (o.displayName || '?').split(/\s+/)[0];
        return { id: o.id, label, initial: label[0], person: o.person, calendars: (o.calendars ?? []).filter(exists) };
      })
      .filter((o) => o.calendars.length);
    return [me, ...rest].map((p, i) => ({ ...p, picture: pic(p.person), color: colorOf(p.person, i) }));
  });
  const active = $derived(people.filter((p) => activePeople.includes(p.id)));
  const mine = $derived([...new Set(active.flatMap((p) => p.calendars))]);
  const owners = $derived.by(() => {
    const m = new Map();
    for (const p of active) for (const c of p.calendars) m.set(c, [...(m.get(c) ?? []), p]);
    return m;
  });
  const anyCalendars = $derived(people.some((p) => p.calendars.length));
  const calKey = $derived(mine.join(','));
  const writable = $derived(
    [...new Set([...($prefs?.calendars ?? []), ...($household?.sharedCalendars ?? [])])].filter((id) => {
      const f = $states[id]?.attributes?.supported_features;
      return $states[id] && (f == null || (f & 1) === 1);
    }),
  );

  const range = $derived.by(() => {
    if (view === 'month') {
      const s = weekStart(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      return { start: s, end: addDays(s, 42) };
    }
    if (view === 'week') {
      const s = weekStart(anchor);
      return { start: s, end: addDays(s, 7) };
    }
    const s = startOfDay();
    return { start: s, end: addDays(s, 31) };
  });
  const rangeKey = $derived(`${range.start.getTime()}|${range.end.getTime()}`);

  const visible = $derived((events ?? []).filter((e) => !hidden.includes(e.calendar)));
  const byDay = $derived(groupByDay(visible, range.start, range.end));
  const monthDays = $derived(view === 'month' ? Array.from({ length: 42 }, (_, i) => addDays(range.start, i)) : []);
  const listGroups = $derived.by(() => {
    if (view !== 'list') return [];
    const out = [];
    for (let i = 0; i < 31; i++) {
      const d = addDays(range.start, i);
      const l = byDay.get(dayKey(d));
      if (l?.length) out.push({ day: d, events: l });
    }
    return out;
  });
  const dayEvents = $derived(daySel ? (byDay.get(dayKey(daySel)) ?? []) : []);

  const title = $derived.by(() => {
    if (view === 'month') return cap(anchor.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' }));
    if (view === 'week') {
      const s = range.start;
      const e = addDays(s, 6);
      return `${s.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return 'Komende 30 dagen';
  });
  const navKey = $derived(`${view}|${rangeKey}`);

  let req = 0;
  let loadedRange = '';
  async function load(force = false) {
    const cals = [...mine];
    const { start, end } = range;
    const rk = rangeKey;
    const id = ++req;
    failed = false;
    if (!cals.length) {
      refreshing = false;
      loadedRange = rk;
      return (events = []);
    }
    const key = `${cals.join(',')}|${start.getTime()}|${end.getTime()}`;
    const hit = cache.get(key);
    if (hit) events = hit.events;
    else if (loadedRange === rk && events) events = events.filter((e) => cals.includes(e.calendar));
    else events = null;
    loadedRange = rk;
    if (hit && !force && Date.now() - hit.t < 30e3) return;
    refreshing = true;
    try {
      const seen = new Set();
      const ev = (await fetchEvents(cals, start, end)).filter((e) => {
        const k = evKey(e);
        return !seen.has(k) && !!seen.add(k);
      });
      cache.set(key, { t: Date.now(), events: ev });
      if (id === req) events = ev;
    } catch {
      if (id === req) {
        failed = true;
        if (!hit) events = [];
      }
    } finally {
      if (id === req) refreshing = false;
    }
  }

  $effect(() => {
    calKey;
    rangeKey;
    view;
    untrack(() => load());
  });

  onMount(() => {
    const t = setInterval(() => load(true), 5 * 60e3);
    return () => clearInterval(t);
  });

  function setView(v) {
    view = v;
    sessionStorage.setItem(VKEY, v);
  }
  function step(n) {
    if (view === 'list') return;
    dir = n;
    anchor = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1) : addDays(anchor, 7 * n);
  }
  function goToday() {
    const t = startOfDay();
    dir = t < anchor ? -1 : 1;
    anchor = t;
  }
  function toggleCal(id) {
    hidden = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
  }
  function togglePerson(id) {
    activePeople = activePeople.includes(id) ? activePeople.filter((x) => x !== id) : [...activePeople, id];
    localStorage.setItem(PKEY, JSON.stringify(activePeople));
  }
  function pickDay(d) {
    daySel = d;
    dayOpen = true;
  }
  function openEvent(e) {
    detail = e;
    detailOpen = true;
  }
  function newEvent(d = new Date()) {
    createDate = d;
    dayOpen = false;
    createOpen = true;
  }
  function created() {
    cache.clear();
    load(true);
  }
</script>

{#if !anyCalendars}
  <Card>
    <EmptyState iconPath={mdiCalendarRemoveOutline} title="Je hebt nog geen agenda's gekozen" text="Kies in Instellingen → Persoonlijk welke agenda's je hier wil zien.">
      <button class="btn primary" onclick={openSettings}><Icon name="settings" size={18} />Naar instellingen</button>
    </EmptyState>
  </Card>
{:else}
  <div class="col" style="gap:var(--gap)">
    {#if people.length > 1}
      <div class="people no-swipe">
        {#each people as p (p.id)}
          <PersonChip label={p.label} initial={p.initial} picture={p.picture} color={p.color} count={p.calendars.length} active={activePeople.includes(p.id)} onclick={() => togglePerson(p.id)} />
        {/each}
      </div>
    {/if}

    {#if !mine.length}
      <div in:fly={{ y: 16, duration: 320 }}>
        <Card>
          <EmptyState
            iconPath={mdiAccountMultipleOutline}
            title={people[0].calendars.length ? 'Niemand geselecteerd' : 'Je hebt zelf nog geen agenda\'s gekozen'}
            text={people[0].calendars.length ? 'Tik hierboven op een persoon om zijn of haar agenda te tonen.' : 'Tik hierboven op een persoon om diens agenda te bekijken, of kies je eigen agenda\'s in de instellingen.'}
          >
            {#if !people[0].calendars.length}
              <button class="btn soft" onclick={openSettings}><Icon name="settings" size={18} />Naar instellingen</button>
            {/if}
          </EmptyState>
        </Card>
      </div>
    {:else}
    <div class="row top">
      <div class="grow">
        <Segmented
          value={view}
          onchange={setView}
          options={[
            { value: 'month', label: 'Maand', iconPath: mdiCalendarMonth },
            { value: 'week', label: 'Week', iconPath: mdiCalendarWeek },
            { value: 'list', label: 'Lijst', iconPath: mdiViewAgendaOutline },
          ]}
        />
      </div>
      {#if writable.length}
        <button class="btn primary add" onclick={() => newEvent(daySel ?? new Date())} aria-label="Nieuwe afspraak">
          <Icon path={mdiCalendarPlus} size={20} /><span class="lbl">Afspraak</span>
        </button>
      {/if}
    </div>

    {#if mine.length > 1}
      <div class="chips no-swipe">
        {#each mine as c (c)}
          {@const col = colorFor(c, $household)}
          {@const own = owners.get(c) ?? []}
          <span class="cwrap" animate:flip={{ duration: 300 }} in:scale={{ start: 0.6, duration: 320 }} out:scale={{ start: 0.6, duration: 200 }}>
            <Chip label={name($states[c]) || c} color={col} active={!hidden.includes(c)} onclick={() => toggleCal(c)}>
              <i class="cdot" style="--c:{col}"></i>
              {#if active.length > 1}
                <span class="owners">
                  {#each own as p (p.id)}<b style="--pc:{p.color}" title={p.label}>{p.initial.toUpperCase()}</b>{/each}
                </span>
              {/if}
            </Chip>
          </span>
        {/each}
      </div>
    {/if}

    <Card pad={false}>
      <div class="cal">
        <div class="spread nav">
          <h3 class="ttl">
            {title}
            {#if refreshing}<span class="refresh spin" transition:fade><Icon path={mdiRefresh} size={16} /></span>{/if}
          </h3>
          {#if view !== 'list'}
            <div class="row" style="gap:4px">
              <button class="btn icon ghost" onclick={() => step(-1)} aria-label="Vorige"><Icon name="chevronLeft" /></button>
              <button class="btn sm soft" onclick={goToday}><Icon path={mdiCalendarToday} size={16} />Vandaag</button>
              <button class="btn icon ghost" onclick={() => step(1)} aria-label="Volgende"><Icon name="chevronRight" /></button>
            </div>
          {:else}
            <button class="btn icon ghost" onclick={() => load(true)} aria-label="Vernieuwen"><Icon path={mdiRefresh} /></button>
          {/if}
        </div>

        {#if failed}<p class="small danger">Agenda's konden niet geladen worden.</p>{/if}

        <div class="viewport no-swipe" use:swipe={{ onleft: () => step(1), onright: () => step(-1) }}>
          {#key navKey}
            <div in:fly={{ x: 50 * dir, duration: 320, easing: cubicOut }}>
              {#if events === null}
                <div class="skeleton sk"></div>
              {:else if view === 'month'}
                <MonthGrid days={monthDays} month={anchor.getMonth()} {byDay} selected={dayOpen ? daySel : null} onpick={pickDay} />
              {:else if view === 'week'}
                <WeekGrid start={range.start} {byDay} onopen={openEvent} onday={pickDay} />
              {:else if listGroups.length}
                <div class="list">
                  {#each listGroups as g (g.day.getTime())}
                    <div class="grp" animate:flip={{ duration: 320 }} in:fade={{ duration: 260 }} out:fade={{ duration: 160 }}>
                      <div class="section-title">{dayLabel(g.day)}</div>
                      <div class="col" style="gap:6px">
                        {#each g.events as e (evKey(e))}
                          <div animate:flip={{ duration: 320 }} in:fly={{ y: 12, duration: 320 }} out:scale={{ start: 0.92, duration: 180 }}>
                            <EventRow {e} onclick={() => openEvent(e)} />
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <EmptyState icon="calendar" title="Niets gepland" text="Geen afspraken in de komende 30 dagen. Geniet ervan! 🌴" />
              {/if}
            </div>
          {/key}
        </div>
      </div>
    </Card>
    {/if}
  </div>
{/if}

<Sheet bind:open={dayOpen} title={daySel ? dayLabel(daySel) : ''}>
  {#if dayEvents.length}
    <div class="col" style="gap:8px">
      {#each dayEvents as e, i (i)}
        <div in:fly={{ y: 14, delay: i * 40, duration: 300 }}><EventRow {e} onclick={() => openEvent(e)} /></div>
      {/each}
    </div>
  {:else}
    <EmptyState icon="calendar" title="Geen afspraken" text="Deze dag is nog helemaal vrij." />
  {/if}
  {#snippet footer()}
    {#if writable.length && daySel}
      <button class="btn primary block" onclick={() => newEvent(daySel ?? new Date())}><Icon path={mdiCalendarPlus} size={18} />Afspraak op deze dag</button>
    {/if}
  {/snippet}
</Sheet>

<EventDetail bind:open={detailOpen} event={detail} />

{#if writable.length}
  <CreateEvent bind:open={createOpen} date={createDate} calendars={writable} oncreated={created} />
{/if}

<style>
  .top { gap: 10px; align-items: center; }
  .add { gap: 6px; padding-inline: 16px; min-height: 46px; }
  @media (max-width: 420px) {
    .add .lbl { display: none; }
    .add { padding: 12px; border-radius: 16px; }
  }
  .chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 2px 6px; margin: -2px -2px -6px; }
  .people { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 4px 2px 8px; margin: -4px -2px -8px; }
  .people::-webkit-scrollbar { display: none; }
  .cwrap { display: inline-flex; flex-shrink: 0; }
  .owners { display: inline-flex; margin-left: 2px; }
  .owners b {
    width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 0.62rem; font-weight: 800; color: #fff;
    background: var(--pc); box-shadow: 0 0 0 2px var(--surface-2); animation: pop 0.4s var(--spring) both;
  }
  .owners b + b { margin-left: -5px; }
  .chips :global(.chip.active .owners b) { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85); }
  .chips::-webkit-scrollbar { display: none; }
  .cdot { width: 8px; height: 8px; border-radius: 50%; background: #fff; display: inline-block; order: -1; box-shadow: 0 0 0 2px var(--c); }
  .chips :global(.chip:not(.active)) { opacity: 0.6; }
  .chips :global(.chip:not(.active) .cdot) { background: transparent; }
  .cal { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .nav { gap: 8px; }
  .ttl { font-size: 1.15rem; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .refresh { color: var(--text-3); display: inline-flex; }
  .viewport { overflow: hidden; touch-action: pan-y; }
  .sk { height: 320px; border-radius: var(--radius-sm); }
  .list { display: flex; flex-direction: column; gap: 14px; }
  .grp .section-title { margin-bottom: 6px; }
</style>

<script>
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { mdiCalendarMonth, mdiFormatListChecks } from '@mdi/js';
  import Segmented from '../components/Segmented.svelte';
  import CalendarView from './agenda/CalendarView.svelte';
  import TodoLists from './agenda/TodoLists.svelte';

  const KEY = 'agenda.sub';
  let sub = $state(sessionStorage.getItem(KEY) === 'lijsten' ? 'lijsten' : 'agenda');
  let dir = $state(1);

  function set(v) {
    dir = v === 'lijsten' ? 1 : -1;
    sub = v;
    sessionStorage.setItem(KEY, v);
  }
</script>

<div class="agenda col stagger">
  <Segmented
    size="lg"
    value={sub}
    onchange={set}
    options={[
      { value: 'agenda', label: 'Agenda', iconPath: mdiCalendarMonth },
      { value: 'lijsten', label: 'Lijsten', iconPath: mdiFormatListChecks },
    ]}
  />
  {#key sub}
    <div in:fly={{ x: 40 * dir, duration: 380, easing: cubicOut }}>
      {#if sub === 'agenda'}<CalendarView />{:else}<TodoLists />{/if}
    </div>
  {/key}
</div>

<style>
  .agenda { gap: var(--gap); max-width: 1100px; margin: 0 auto; width: 100%; }
</style>

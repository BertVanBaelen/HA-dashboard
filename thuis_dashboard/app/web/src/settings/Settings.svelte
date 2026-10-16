<script>
  import { fly } from 'svelte/transition';
  import Segmented from '../components/Segmented.svelte';
  import Personal from './Personal.svelte';
  import Household from './Household.svelte';
  import StartPage from './StartPage.svelte';
  let section = $state('persoonlijk');
</script>

<div class="settings">
  <Segmented
    value={section}
    onchange={(v) => (section = v)}
    options={[
      { value: 'persoonlijk', label: 'Persoonlijk', icon: 'heart' },
      { value: 'huishouden', label: 'Huishouden', icon: 'home' },
    ]}
  />
  {#key section}
    <div in:fly={{ x: section === 'persoonlijk' ? -30 : 30, duration: 350 }}>
      {#if section === 'persoonlijk'}<Personal /><StartPage />{:else}<Household />{/if}
    </div>
  {/key}
</div>

<style>
  .settings { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
</style>

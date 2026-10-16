// Lazy tab loaders. Each tab is a Svelte component without props.
export const tabLoaders = {
  home: () => import('./Home.svelte'),
  klimaat: () => import('./Klimaat.svelte'),
  verlichting: () => import('./Verlichting.svelte'),
  media: () => import('./Media.svelte'),
  auto: () => import('./Auto.svelte'),
  agenda: () => import('./Agenda.svelte'),
  personen: () => import('./Personen.svelte'),
  systeem: () => import('./Systeem.svelte'),
  grafieken: () => import('./Grafieken.svelte'),
};

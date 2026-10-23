import { writable } from 'svelte/store';

/** Set to a tab id to navigate there (App consumes and resets it). */
export const navigate = writable(/** @type {string|null} */ (null));
/** Set to true to open the settings sheet. */
export const settingsRequest = writable(false);

export const goTab = (id) => navigate.set(id);
export const openSettings = () => settingsRequest.set(true);

/** Set to a FLOORPLAN_ROOMS id to open that room on the Huisje tab (Plattegrond consumes and resets it). */
export const roomRequest = writable(/** @type {string|null} */ (null));
export const openRoom = (/** @type {string} */ id) => {
  roomRequest.set(id);
  goTab('plattegrond');
};

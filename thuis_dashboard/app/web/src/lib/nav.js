import { writable } from 'svelte/store';

/** Set to a tab id to navigate there (App consumes and resets it). */
export const navigate = writable(/** @type {string|null} */ (null));
/** Set to true to open the settings sheet. */
export const settingsRequest = writable(false);

export const goTab = (id) => navigate.set(id);
export const openSettings = () => settingsRequest.set(true);

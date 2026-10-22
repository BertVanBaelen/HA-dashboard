import { get } from 'svelte/store';
import { MEDIA } from '$shared/config.js';
import { action, actionQuiet, prefs } from '../../lib/api.js';

/** @typedef {{type:string,id:string,uri:string,name:string,sub:string,image:string|null,durationMs:number|null,explicit:boolean}} SpItem */

export const SPOTIFY_GREEN = '#1DB954';

const isSpotifyPlus = (/** @type {string} */ id, /** @type {any} */ s) => id.startsWith('media_player.') && !!s?.attributes && 'sp_user_id' in s.attributes;

/** All SpotifyPlus players (one per signed-in Spotify account). */
export function spotifyAccounts(/** @type {Record<string, any>} */ all) {
  return Object.entries(all)
    .filter(([id, s]) => isSpotifyPlus(id, s))
    .map(([id, s]) => ({ id, name: String(s.attributes.sp_user_display_name || s.attributes.friendly_name || id) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Same rule as the backend: the user's choice if it still exists, else the configured one, else the first found. */
export function findSpotify(/** @type {Record<string, any>} */ all, /** @type {string|null|undefined} */ preferred = null) {
  if (preferred && isSpotifyPlus(preferred, all[preferred])) return all[preferred];
  if (MEDIA.spotify.entity) return all[MEDIA.spotify.entity] ?? null;
  const first = spotifyAccounts(all)[0];
  return first ? all[first.id] : null;
}

export const onStereoDevice = (/** @type {string|undefined} */ name) => !!name && name.toLowerCase().includes(MEDIA.spotify.device.toLowerCase());

/** Output device chosen by this user (null = the stereo). */
export const chosenDevice = (/** @type {any} */ p) => (typeof p?.spotifyDevice === 'string' && p.spotifyDevice) || null;
export const targetName = (/** @type {any} */ p) => chosenDevice(p) ?? MEDIA.spotify.device;
/** Same rule as the backend: names match, and anything containing the stereo's name is the stereo. */
export const sameTarget = (/** @type {string|undefined} */ name, /** @type {string} */ target) =>
  !!name && (name.toLowerCase() === target.toLowerCase() || (onStereoDevice(name) && onStereoDevice(target)));

// Playback commands go to the user's chosen output device
const withDevice = (/** @type {string} */ op, /** @type {Record<string, any>} */ args) =>
  (op === 'play' || op === 'control') && !('device' in args) ? { ...args, device: chosenDevice(get(prefs)) } : args;

/** Spotify action with error toast (+ optional success toast). */
export const sp = (/** @type {string} */ op, args = {}, /** @type {string|undefined} */ okText = undefined) => action('spotify', { ...withDevice(op, args), op }, okText);
/** Spotify action without toast (for loading lists). */
export const spQuiet = (/** @type {string} */ op, args = {}) => actionQuiet('spotify', { ...withDevice(op, args), op });

export const mmss = (/** @type {number} */ sec) => {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export const httpImage = (/** @type {any} */ v) => (typeof v === 'string' && /^https?:\/\//.test(v) ? v : null);

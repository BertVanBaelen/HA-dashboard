import { get } from 'svelte/store';
import { states, household } from './api.js';

export const PALETTE = ['#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#a3e635', '#f472b6', '#6366f1', '#fb923c'];

let domainCache = new Map();

/**
 * Stable, distinct colour per entity id (unique within its domain while the palette suffices).
 * Calendar colours chosen in the settings (household.calendarColors) take precedence.
 * Pass `$household` from components so the colour updates reactively.
 */
export function colorFor(id, hh = get(household)) {
  const custom = hh?.calendarColors?.[id];
  if (custom) return custom;
  const domain = id.split('.')[0];
  let order = domainCache.get(domain);
  if (!order || !order.includes(id)) {
    order = Object.keys(get(states)).filter((e) => e.startsWith(domain + '.')).sort();
    domainCache.set(domain, order);
  }
  let i = order.indexOf(id);
  if (i < 0) {
    i = 0;
    for (const c of id) i = (i * 31 + c.charCodeAt(0)) >>> 0;
  }
  return PALETTE[i % PALETTE.length];
}

export const PERSON_COLORS = { bert: '#3b82f6', marjo: '#ec4899' };

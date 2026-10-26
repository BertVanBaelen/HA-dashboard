import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TABS, DEFAULT_RADIOS, CAR_FLAGS, NEWS_SOURCES } from '../shared/config.js';
import { validateLayout } from '../shared/layout.js';
import { defaultLayout, linkLayout, rekeyComfort, LEGACY_PRESETS, LEGACY_COMFORT, LEGACY_SENSOR_LABELS } from './migrate-layout.js';

const SCHEMA_VERSION = 2;
const NEWS_DISMISS_DAYS = 4;
const NEWS_DISMISS_MAX = 3000;

export function defaultUserPrefs() {
  return {
    tabs: TABS.map((t) => ({ id: t.id, visible: true })),
    startTab: 'home',
    calendars: [],
    welcome: { preset: null, stereo: { enabled: false, source: null, radio: null } },
    arrivalNotify: false,
    presenceWatchUntil: null,
    notifyService: null,
    spotifyEntity: null,
    spotifyDevice: null,
    theme: { mode: 'auto', accent: 'blauw' },
    // sources: source id -> 'alles' | 'groot' | 'uit'; dismissed: news item id -> unix seconds when swiped away
    news: { sources: Object.fromEntries(NEWS_SOURCES.map((s) => [s.id, s.mode])), dismissed: {} },
  };
}

export function defaultHousehold() {
  return {
    sharedCalendars: [],
    calendarColors: {},
    lists: ['todo.shopping_list', 'todo.cleaning_day'],
    presets: structuredClone(LEGACY_PRESETS),
    comfort: {},
    sensorLabels: {},
    radios: structuredClone(DEFAULT_RADIOS),
    carFlags: Object.fromEntries(CAR_FLAGS.map((f) => [f.key, f.default])),
    layout: null,
  };
}

/** Valid source modes only, and forget swiped-away news after a few days so the file stays small. */
function normalizeNews(n, d) {
  const modes = new Set(['alles', 'groot', 'uit']);
  const sources = { ...d.sources };
  for (const [id, m] of Object.entries(n?.sources ?? {})) if (id in sources && modes.has(m)) sources[id] = m;
  const minTs = Date.now() / 1000 - NEWS_DISMISS_DAYS * 86400;
  const dismissed = Object.entries(n?.dismissed ?? {})
    .filter(([id, ts]) => typeof id === 'string' && id.length <= 24 && Number(ts) > minTs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, NEWS_DISMISS_MAX);
  return { sources, dismissed: Object.fromEntries(dismissed.map(([id, ts]) => [id, Math.round(Number(ts))])) };
}

/** Fill in missing keys and append newly added tabs so old files stay valid. */
function normalizeUser(p) {
  const d = defaultUserPrefs();
  const out = { ...d, ...p, welcome: { ...d.welcome, ...(p?.welcome ?? {}) }, theme: { ...d.theme, ...(p?.theme ?? {}) } };
  out.welcome.stereo = { ...d.welcome.stereo, ...(p?.welcome?.stereo ?? {}) };
  out.news = normalizeNews(p?.news, d.news);
  const known = new Set(TABS.map((t) => t.id));
  const tabs = (p?.tabs ?? []).filter((t) => known.has(t.id));
  for (const t of TABS) if (!tabs.find((x) => x.id === t.id)) tabs.push({ id: t.id, visible: true });
  out.tabs = tabs;
  return out;
}

function normalizeLayout(l, log) {
  if (!l) return defaultLayout();
  try {
    return { ...validateLayout(l), linked: l.linked !== false };
  } catch (err) {
    log?.warn?.('[store] invalid layout, using default', err.message);
    return defaultLayout();
  }
}

function normalizeHousehold(h, log) {
  const d = defaultHousehold();
  return {
    ...d,
    ...h,
    radios: (h?.radios ?? d.radios).filter((r) => r.mediaId),
    comfort: { ...d.comfort, ...(h?.comfort ?? {}) },
    sensorLabels: { ...d.sensorLabels, ...(h?.sensorLabels ?? {}) },
    carFlags: { ...d.carFlags, ...(h?.carFlags ?? {}) },
    calendarColors: { ...(h?.calendarColors ?? {}) },
    layout: normalizeLayout(h?.layout, log),
  };
}

/** Schema 1 → 2: defaults that used to live in code are written into the store. */
function migrateHousehold(h, version) {
  if (!h || version >= 2) return h;
  return { ...h, comfort: { ...LEGACY_COMFORT, ...(h.comfort ?? {}) }, sensorLabels: { ...LEGACY_SENSOR_LABELS, ...(h.sensorLabels ?? {}) } };
}

export class Store {
  constructor(file, log = console) {
    this.file = file;
    this.log = log;
    this.data = { version: SCHEMA_VERSION, users: {}, profiles: {}, household: normalizeHousehold(migrateHousehold({}, 1), log) };
    this.writing = Promise.resolve();
  }

  async load() {
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8'));
      this.data = {
        version: SCHEMA_VERSION,
        users: Object.fromEntries(Object.entries(raw.users ?? {}).map(([k, v]) => [k, normalizeUser(v)])),
        profiles: raw.profiles ?? {},
        household: normalizeHousehold(migrateHousehold(raw.household, raw.version ?? 1), this.log),
      };
      this.log.info?.(`[store] loaded ${Object.keys(this.data.users).length} user(s)`);
      if ((raw.version ?? 1) < SCHEMA_VERSION) await this.save();
    } catch (err) {
      if (err.code !== 'ENOENT') this.log.error?.('[store] load failed, using defaults', err);
      await this.save();
    }
  }

  save() {
    this.writing = this.writing.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(this.data, null, 2));
      await rename(tmp, this.file);
    }).catch((err) => this.log.error?.('[store] save failed', err));
    return this.writing;
  }

  getUser(userId) {
    if (!this.data.users[userId]) this.data.users[userId] = defaultUserPrefs();
    return this.data.users[userId];
  }

  allUsers() {
    return this.data.users;
  }

  /** Remember display name/person per user so others can see whose calendars they are. */
  async setProfile(userId, profile) {
    const old = this.data.profiles[userId];
    if (old && old.displayName === profile.displayName && old.person === profile.person) return;
    this.data.profiles[userId] = profile;
    await this.save();
  }

  /** Other users and their chosen calendars. */
  othersFor(userId) {
    return Object.entries(this.data.users)
      .filter(([id, p]) => id !== userId && p.calendars?.length && this.data.profiles[id])
      .map(([id, p]) => ({ id, displayName: this.data.profiles[id].displayName, person: this.data.profiles[id].person ?? null, calendars: p.calendars }));
  }

  async setUser(userId, prefs) {
    this.data.users[userId] = normalizeUser(prefs);
    await this.save();
    return this.data.users[userId];
  }

  getHousehold() {
    return this.data.household;
  }

  async setHousehold(household) {
    this.data.household = normalizeHousehold({ ...household, layout: this.data.household.layout }, this.log);
    await this.save();
    return this.data.household;
  }

  async setLayout(layout) {
    this.data.household = { ...this.data.household, layout: validateLayout(layout) };
    await this.save();
    return this.data.household;
  }

  /** Links layout rooms and comfort keys to HA areas once the areas are known. Returns true when changed. */
  async linkAreas(areas) {
    if (!areas?.length) return false;
    const h = this.data.household;
    const regs = areas.map((a) => ({ area_id: a.id ?? a.area_id, name: a.name }));
    const layout = linkLayout(h.layout, regs);
    const comfort = rekeyComfort(h.comfort, regs);
    if (layout === h.layout && JSON.stringify(comfort) === JSON.stringify(h.comfort)) return false;
    this.data.household = { ...h, layout, comfort };
    this.log.info?.('[store] layout/comfort linked to HA areas');
    await this.save();
    return true;
  }
}

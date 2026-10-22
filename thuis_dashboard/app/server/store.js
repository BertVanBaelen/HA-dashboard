import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TABS, DEFAULT_PRESETS, DEFAULT_COMFORT, DEFAULT_RADIOS, CAR_FLAGS, DOOR_SENSORS } from '../shared/config.js';

const SCHEMA_VERSION = 1;

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
  };
}

export function defaultHousehold() {
  return {
    sharedCalendars: [],
    calendarColors: {},
    lists: ['todo.shopping_list', 'todo.cleaning_day'],
    presets: structuredClone(DEFAULT_PRESETS),
    comfort: { ...DEFAULT_COMFORT },
    sensorLabels: Object.fromEntries(DOOR_SENSORS.map((d) => [d.entity, d.defaultLabel])),
    radios: structuredClone(DEFAULT_RADIOS),
    carFlags: Object.fromEntries(CAR_FLAGS.map((f) => [f.key, f.default])),
  };
}

/** Fill in missing keys and append newly added tabs so old files stay valid. */
function normalizeUser(p) {
  const d = defaultUserPrefs();
  const out = { ...d, ...p, welcome: { ...d.welcome, ...(p?.welcome ?? {}) }, theme: { ...d.theme, ...(p?.theme ?? {}) } };
  out.welcome.stereo = { ...d.welcome.stereo, ...(p?.welcome?.stereo ?? {}) };
  const known = new Set(TABS.map((t) => t.id));
  const tabs = (p?.tabs ?? []).filter((t) => known.has(t.id));
  for (const t of TABS) if (!tabs.find((x) => x.id === t.id)) tabs.push({ id: t.id, visible: true });
  out.tabs = tabs;
  return out;
}

function normalizeHousehold(h) {
  const d = defaultHousehold();
  return {
    ...d,
    ...h,
    radios: (h?.radios ?? d.radios).filter((r) => r.mediaId),
    comfort: { ...d.comfort, ...(h?.comfort ?? {}) },
    sensorLabels: { ...d.sensorLabels, ...(h?.sensorLabels ?? {}) },
    carFlags: { ...d.carFlags, ...(h?.carFlags ?? {}) },
    calendarColors: { ...(h?.calendarColors ?? {}) },
  };
}

export class Store {
  constructor(file, log = console) {
    this.file = file;
    this.log = log;
    this.data = { version: SCHEMA_VERSION, users: {}, profiles: {}, household: defaultHousehold() };
    this.writing = Promise.resolve();
  }

  async load() {
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8'));
      this.data = {
        version: SCHEMA_VERSION,
        users: Object.fromEntries(Object.entries(raw.users ?? {}).map(([k, v]) => [k, normalizeUser(v)])),
        profiles: raw.profiles ?? {},
        household: normalizeHousehold(raw.household),
      };
      this.log.info?.(`[store] loaded ${Object.keys(this.data.users).length} user(s)`);
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
    this.data.household = normalizeHousehold(household);
    await this.save();
    return this.data.household;
  }
}

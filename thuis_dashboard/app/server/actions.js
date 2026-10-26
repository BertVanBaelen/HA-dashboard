import { HOME, MEDIA, PEOPLE, DEFAULT_COMFORT_TEMP, tvIsOn, stereoIsOn } from '../shared/config.js';
import { Spotify, resolveSpotifyEntity } from './spotify.js';

const ARRIVAL_DEBOUNCE_MS = 30 * 60 * 1000;
const PRESENCE_DEBOUNCE_MS = 2 * 60 * 1000;
const HEAT_ACTION_PREFIX = 'DASH_HEAT_';

export class Actions {
  constructor({ ha, store, topology, log = console }) {
    this.ha = ha;
    this.topology = topology;
    this.store = store;
    this.log = log;
    this.lastArrival = new Map();
    this.lastPresence = new Map();
    /** @type {Map<string, Spotify>} one per SpotifyPlus account (keeps its device cache) */
    this.spotifyAccounts = new Map();
  }

  /** Spotify for a dashboard user: the account chosen in their settings, else the default one. */
  spotifyFor(userId) {
    const entity = resolveSpotifyEntity(this.ha, userId ? this.store.getUser(userId).spotifyEntity : null);
    if (!entity) throw new Error('SpotifyPlus-speler niet gevonden. Is de integratie SpotifyPlus geïnstalleerd en aangemeld?');
    let sp = this.spotifyAccounts.get(entity);
    if (!sp) {
      sp = new Spotify({ ha: this.ha, entity, log: this.log, prepareStereo: () => this.#stereoForSpotify() });
      this.spotifyAccounts.set(entity, sp);
    }
    return sp;
  }

  isOn(entityId) {
    return this.ha.getState(entityId)?.state === 'on';
  }

  #rooms() {
    const t = this.topology?.get();
    return t ? [...Object.values(t.rooms), t.unassigned] : [];
  }

  #lights() {
    return this.#rooms().flatMap((r) => r.lights);
  }

  #climateRoom(areaId) {
    const t = this.topology?.get();
    const c = t?.rooms[areaId]?.climate;
    return c ? { ...c, name: t.areas.find((a) => a.id === areaId)?.name ?? areaId } : null;
  }

  climateAreas() {
    const t = this.topology?.get();
    return (t?.areas ?? []).filter((a) => t.rooms[a.id]?.climate);
  }

  async #steps(steps) {
    const failed = [];
    for (const [label, fn] of steps) {
      try {
        await fn();
      } catch (err) {
        this.log.warn?.(`[actions] step failed: ${label}`, err.message);
        failed.push(label);
      }
    }
    return { failed };
  }

  // ---- Composite actions ---------------------------------------------------

  async allesUit() {
    const lights = this.#lights().map((l) => l.entity);
    const climates = this.#rooms().map((r) => r.climate?.entity).filter(Boolean);
    return this.#steps([
      ...(lights.length ? [['Lampen', () => this.ha.callService('light', 'turn_off', {}, { entity_id: lights })]] : []),
      ['Media', () => this.mediaMode('uit')],
      ['Chromecast', () => this.ha.callService('media_player', 'turn_off', {}, { entity_id: MEDIA.chromecast })],
      ['Ventilator', () => this.ha.callService('switch', 'turn_off', {}, { entity_id: HOME.fan })],
      ...(climates.length ? [['Verwarming', async () => {
        try {
          await this.ha.callService('climate', 'set_preset_mode', { preset_mode: 'away' }, { entity_id: climates });
        } catch {
          await this.ha.callService('climate', 'set_hvac_mode', { hvac_mode: 'off' }, { entity_id: climates });
        }
      }]] : []),
    ]);
  }

  async #script(entityId) {
    const [, name] = entityId.split('.');
    // Calling script.<name> directly waits until the script finishes
    await this.ha.callService('script', name, {});
  }

  async mediaMode(mode) {
    const tvOn = tvIsOn((id) => this.ha.getState(id));
    const stereoOn = stereoIsOn((id) => this.ha.getState(id));
    const s = MEDIA.scripts;
    if (mode === 'tv') {
      if (stereoOn) await this.#script(s.stereoOff);
      if (!tvOn) await this.#script(s.tvOn);
    } else if (mode === 'stereo') {
      if (tvOn) await this.#script(s.tvOff);
      if (!stereoOn) await this.#script(s.stereoOn);
    } else if (mode === 'uit') {
      if (tvOn) await this.#script(s.tvOff);
      if (stereoOn) await this.#script(s.stereoOff);
    } else {
      throw new Error(`Onbekende modus: ${mode}`);
    }
    return { mode };
  }

  async applyPreset(presetId) {
    const preset = this.store.getHousehold().presets.find((p) => p.id === presetId);
    if (!preset) throw new Error('Preset niet gevonden');
    const known = new Map(this.#lights().map((l) => [l.entity, l]));
    const steps = Object.entries(preset.lights).filter(([entityId]) => known.has(entityId)).map(([entityId, cfg]) => [entityId, async () => {
      if (!cfg.on) return this.ha.callService('light', 'turn_off', {}, { entity_id: entityId });
      const data = {};
      if (cfg.brightness != null) data.brightness_pct = cfg.brightness;
      if (cfg.rgb) data.rgb_color = cfg.rgb;
      else if (cfg.colorTemp) data.color_temp_kelvin = cfg.colorTemp;
      await this.ha.callService('light', 'turn_on', data, { entity_id: entityId });
      const light = known.get(entityId);
      if (cfg.scene && light?.sceneSelect) {
        await this.ha.callService('select', 'select_option', { option: cfg.scene }, { entity_id: light.sceneSelect });
      }
    }]);
    return this.#steps(steps);
  }

  /** Snapshot current lamp state into a preset object. */
  capturePreset() {
    const lights = {};
    for (const { entity } of this.#lights()) {
      const s = this.ha.getState(entity);
      if (!s || s.state !== 'on') {
        lights[entity] = { on: false };
        continue;
      }
      const a = s.attributes ?? {};
      const cfg = { on: true, brightness: a.brightness != null ? Math.round((a.brightness / 255) * 100) : 100 };
      if (a.color_mode === 'color_temp' && a.color_temp_kelvin) cfg.colorTemp = a.color_temp_kelvin;
      else if (a.rgb_color) cfg.rgb = a.rgb_color;
      lights[entity] = cfg;
    }
    return lights;
  }

  /** Plays a MusicCast media-browser item (Net Radio station or preset) on the stereo. */
  async playRadio(mediaId) {
    if (!mediaId || typeof mediaId !== 'string') throw new Error('Zender niet gevonden, kies ze opnieuw via "Andere radio"');
    if (!stereoIsOn((id) => this.ha.getState(id))) await this.#script(MEDIA.scripts.stereoOn);
    await this.ha.callService('media_player', 'play_media', { media_content_id: mediaId, media_content_type: 'music' }, { entity_id: MEDIA.stereo });
  }

  /** Browses the stereo's own media tree (Net Radio, presets, ...). */
  async browseStereo(mediaId, mediaType) {
    if (!stereoIsOn((id) => this.ha.getState(id))) await this.#script(MEDIA.scripts.stereoOn);
    const msg = { type: 'media_player/browse_media', entity_id: MEDIA.stereo };
    if (mediaId) {
      msg.media_content_id = mediaId;
      msg.media_content_type = mediaType || 'directory';
    }
    const res = await this.ha.send(msg);
    return {
      title: res.title ?? '',
      mediaId: res.media_content_id ?? null,
      children: (res.children ?? []).map((c) => ({
        title: c.title,
        mediaId: c.media_content_id,
        mediaType: c.media_content_type,
        canPlay: !!c.can_play,
        canExpand: !!c.can_expand,
      })),
    };
  }

  async selectStereoSource(key, userId = null) {
    await this.#selectSource(key);
    // Spotify playing elsewhere (e.g. on a phone) moves to the stereo
    if (key === 'spotify') {
      Promise.resolve()
        .then(() => this.spotifyFor(userId).claim())
        .catch((e) => this.log.warn?.('[spotify] claim failed', e.message));
    }
  }

  async #selectSource(key) {
    const src = MEDIA.stereoSources.find((s) => s.key === key);
    const list = this.ha.getState(MEDIA.stereo)?.attributes?.source_list ?? [];
    const match = list.find((name) => src?.match.some((m) => name.toLowerCase().replace(/\s+/g, ' ') === m || name.toLowerCase().includes(m)));
    if (!match) throw new Error(`Bron "${src?.label ?? key}" niet gevonden op de stereo`);
    await this.ha.callService('media_player', 'select_source', { source: match }, { entity_id: MEDIA.stereo });
  }

  /** Stereo on and on its Spotify input before Spotify starts playing there. */
  async #stereoForSpotify() {
    if (!stereoIsOn((id) => this.ha.getState(id))) await this.#script(MEDIA.scripts.stereoOn);
    const source = String(this.ha.getState(MEDIA.stereo)?.attributes?.source ?? '');
    if (!/spotify/i.test(source)) await this.#selectSource('spotify').catch((e) => this.log.warn?.('[spotify] source select failed', e.message));
  }

  async welkomThuis(userId) {
    const prefs = this.store.getUser(userId);
    const steps = [];
    if (prefs.welcome.preset) steps.push(['Lampen', () => this.applyPreset(prefs.welcome.preset)]);
    const st = prefs.welcome.stereo;
    if (st?.enabled) {
      steps.push(['Stereo', () => this.mediaMode('stereo')]);
      if (st.radio) {
        const radio = this.store.getHousehold().radios.find((r) => r.id === st.radio);
        if (radio) steps.push(['Radio', () => this.playRadio(radio.mediaId)]);
      } else if (st.source) {
        steps.push(['Bron', () => this.selectStereoSource(st.source, userId)]);
      }
    }
    if (!steps.length) throw new Error('Welkom thuis is nog niet ingesteld');
    return this.#steps(steps);
  }

  async heatRoom(areaId) {
    const room = this.#climateRoom(areaId);
    if (!room) throw new Error('Onbekende kamer');
    const temperature = Number(this.store.getHousehold().comfort[areaId] ?? DEFAULT_COMFORT_TEMP);
    try {
      await this.ha.callService('tado', 'set_climate_timer', { temperature, requested_overlay: 'NEXT_TIME_BLOCK' }, { entity_id: room.entity });
    } catch (err) {
      this.log.warn?.('[actions] tado.set_climate_timer failed, falling back', err.message);
      await this.ha.callService('climate', 'set_temperature', { temperature, hvac_mode: 'heat' }, { entity_id: room.entity });
    }
    return { room: room.name, temperature };
  }

  // ---- Arrival notification ------------------------------------------------

  notifyServiceFor(userId) {
    const prefs = this.store.getUser(userId);
    if (prefs.notifyService) return prefs.notifyService.replace(/^notify\./, '');
    const personId = this.personForUser(userId);
    return PEOPLE.find((p) => p.person === personId)?.notify ?? null;
  }

  personForUser(userId) {
    for (const [id, s] of this.ha.states) {
      if (id.startsWith('person.') && s.attributes?.user_id === userId) return id;
    }
    return null;
  }

  startBackgroundJobs() {
    this.prevPersonState = new Map();
    this.ha.on('state', (entityId, newState) => {
      if (!entityId.startsWith('person.') || !newState) return;
      const prev = this.prevPersonState?.get(entityId);
      this.prevPersonState.set(entityId, newState.state);
      if (prev && prev !== 'home' && newState.state === 'home') {
        this.onArrival(entityId, newState).catch((e) => this.log.error?.('[arrival]', e));
      }
      if (prev && prev !== newState.state && (prev === 'home' || newState.state === 'home') && !['unknown', 'unavailable'].includes(prev)) {
        this.onPresenceChange(entityId, prev, newState).catch((e) => this.log.error?.('[presence]', e));
      }
    });
    this.ha.on('states', (states) => {
      for (const [id, s] of states) if (id.startsWith('person.')) this.prevPersonState.set(id, s.state);
    });
    this.ha.subscribeEvents('mobile_app_notification_action', (event) => {
      const action = event.data?.action ?? '';
      if (!action.startsWith(HEAT_ACTION_PREFIX)) return;
      const roomKey = action.slice(HEAT_ACTION_PREFIX.length).toLowerCase();
      this.heatRoom(roomKey)
        .then(async ({ room, temperature }) => {
          const userId = event.context?.user_id;
          const service = userId ? this.notifyServiceFor(userId) : null;
          if (service) {
            await this.ha.callService('notify', service, { title: 'Verwarming', message: `${room} warmt op naar ${temperature} °C` }).catch(() => {});
          }
        })
        .catch((e) => this.log.error?.('[arrival] heat failed', e));
    });
  }

  /** Timed "komen & gaan" notifications: users who switched it on get a push for every home/away change of someone else. */
  async onPresenceChange(personId, prev, personState) {
    const now = Date.now();
    const key = `${personId}|${personState.state === 'home' ? 'home' : 'away'}`;
    if (now - (this.lastPresence.get(key) ?? 0) < PRESENCE_DEBOUNCE_MS) return;
    this.lastPresence.set(key, now);
    const who = PEOPLE.find((p) => p.person === personId)?.name ?? personState.attributes?.friendly_name ?? personId.split('.')[1];
    const arrived = personState.state === 'home';
    const where = !arrived && personState.state !== 'not_home' ? ` (${personState.state})` : '';
    const time = new Date(now).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TZ || undefined });
    let changed = false;
    for (const [userId, prefs] of Object.entries(this.store.allUsers())) {
      const until = Number(prefs.presenceWatchUntil) || 0;
      if (!until) continue;
      if (until < now) {
        prefs.presenceWatchUntil = null;
        changed = true;
        continue;
      }
      if (personState.attributes?.user_id === userId) continue;
      const service = this.notifyServiceFor(userId);
      if (!service) {
        this.log.warn?.(`[presence] no notify service for user ${userId}`);
        continue;
      }
      this.log.info?.(`[presence] ${personId} ${prev} → ${personState.state}, notifying notify.${service}`);
      await this.ha.callService('notify', service, {
        title: arrived ? `${who} is thuis 🏠` : `${who} is vertrokken 👋`,
        message: arrived ? `${who} kwam thuis om ${time}` : `${who} verliet het huis om ${time}${where}`,
        data: { tag: `thuis-dashboard-presence-${personId}` },
      }).catch((e) => this.log.error?.('[presence] notify failed', e.message));
    }
    if (changed) await this.store.save();
  }

  async onArrival(personId, personState) {
    const userId = personState.attributes?.user_id;
    if (!userId) return;
    const prefs = this.store.allUsers()[userId];
    if (!prefs?.arrivalNotify) return;
    const last = this.lastArrival.get(userId) ?? 0;
    if (Date.now() - last < ARRIVAL_DEBOUNCE_MS) return;
    this.lastArrival.set(userId, Date.now());
    const service = this.notifyServiceFor(userId);
    if (!service) return this.log.warn?.(`[arrival] no notify service for ${personId}`);
    const comfort = this.store.getHousehold().comfort ?? {};
    const rooms = this.climateAreas().sort((a, b) => (b.id in comfort) - (a.id in comfort)).slice(0, 3);
    if (!rooms.length) return this.log.warn?.('[arrival] no rooms with heating');
    this.log.info?.(`[arrival] ${personId} arrived, notifying via notify.${service}`);
    await this.ha.callService('notify', service, {
      title: 'Welkom thuis 🏠',
      message: 'Welke kamer wil je opwarmen?',
      data: {
        tag: 'thuis-dashboard-arrival',
        actions: rooms.map((a) => ({ action: `${HEAT_ACTION_PREFIX}${a.id.toUpperCase()}`, title: a.name })),
      },
    });
  }
}

import { ALL_OFF, LIGHTS, MEDIA, PEOPLE, ROOMS, tvIsOn } from '../shared/config.js';

const ARRIVAL_DEBOUNCE_MS = 30 * 60 * 1000;
const HEAT_ACTION_PREFIX = 'DASH_HEAT_';

export class Actions {
  constructor({ ha, store, log = console }) {
    this.ha = ha;
    this.store = store;
    this.log = log;
    this.lastArrival = new Map();
    this.radioCache = null;
  }

  isOn(entityId) {
    return this.ha.getState(entityId)?.state === 'on';
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
    return this.#steps([
      ['Lampen', () => this.ha.callService('light', 'turn_off', {}, { entity_id: ALL_OFF.lights })],
      ['Media', () => this.mediaMode('uit')],
      ['Chromecast', () => this.ha.callService('media_player', 'turn_off', {}, { entity_id: ALL_OFF.chromecast })],
      ['Ventilator', () => this.ha.callService('switch', 'turn_off', {}, { entity_id: ALL_OFF.fan })],
      ['Verwarming', async () => {
        try {
          await this.ha.callService('climate', 'set_preset_mode', { preset_mode: 'away' }, { entity_id: ALL_OFF.climates });
        } catch {
          await this.ha.callService('climate', 'set_hvac_mode', { hvac_mode: 'off' }, { entity_id: ALL_OFF.climates });
        }
      }],
    ]);
  }

  async #script(entityId) {
    const [, name] = entityId.split('.');
    // Calling script.<name> directly waits until the script finishes
    await this.ha.callService('script', name, {});
  }

  async mediaMode(mode) {
    const tvOn = tvIsOn((id) => this.ha.getState(id));
    const stereoOn = this.isOn(MEDIA.stereoActive);
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
    const steps = Object.entries(preset.lights).map(([entityId, cfg]) => [entityId, async () => {
      if (!cfg.on) return this.ha.callService('light', 'turn_off', {}, { entity_id: entityId });
      const data = {};
      if (cfg.brightness != null) data.brightness_pct = cfg.brightness;
      if (cfg.rgb) data.rgb_color = cfg.rgb;
      else if (cfg.colorTemp) data.color_temp_kelvin = cfg.colorTemp;
      await this.ha.callService('light', 'turn_on', data, { entity_id: entityId });
      const light = LIGHTS.find((l) => l.entity === entityId);
      if (cfg.scene && light?.sceneSelect) {
        await this.ha.callService('select', 'select_option', { option: cfg.scene }, { entity_id: light.sceneSelect });
      }
    }]);
    return this.#steps(steps);
  }

  /** Snapshot current lamp state into a preset object. */
  capturePreset() {
    const lights = {};
    for (const { entity } of LIGHTS) {
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

  async playRadio(url) {
    if (!/^https?:\/\//.test(url)) throw new Error('Ongeldige stream-URL');
    await this.ha.callService('media_player', 'play_media', { media_content_id: url, media_content_type: 'music' }, { entity_id: MEDIA.stereo });
  }

  async selectStereoSource(key) {
    const src = MEDIA.stereoSources.find((s) => s.key === key);
    const list = this.ha.getState(MEDIA.stereo)?.attributes?.source_list ?? [];
    const match = list.find((name) => src?.match.some((m) => name.toLowerCase().replace(/\s+/g, ' ') === m || name.toLowerCase().includes(m)));
    if (!match) throw new Error(`Bron "${src?.label ?? key}" niet gevonden op de stereo`);
    await this.ha.callService('media_player', 'select_source', { source: match }, { entity_id: MEDIA.stereo });
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
        if (radio) steps.push(['Radio', () => this.playRadio(radio.url)]);
      } else if (st.source) {
        steps.push(['Bron', () => this.selectStereoSource(st.source)]);
      }
    }
    if (!steps.length) throw new Error('Welkom thuis is nog niet ingesteld');
    return this.#steps(steps);
  }

  async heatRoom(roomKey) {
    const room = ROOMS.find((r) => r.key === roomKey);
    if (!room) throw new Error('Onbekende kamer');
    const temperature = Number(this.store.getHousehold().comfort[roomKey]);
    try {
      await this.ha.callService('tado', 'set_climate_timer', { temperature, requested_overlay: 'NEXT_TIME_BLOCK' }, { entity_id: room.climate });
    } catch (err) {
      this.log.warn?.('[actions] tado.set_climate_timer failed, falling back', err.message);
      await this.ha.callService('climate', 'set_temperature', { temperature, hvac_mode: 'heat' }, { entity_id: room.climate });
    }
    return { room: room.name, temperature };
  }

  async searchRadios() {
    if (this.radioCache && Date.now() - this.radioCache.at < 24 * 3600 * 1000) return this.radioCache.list;
    const url = 'https://de1.api.radio-browser.info/json/stations/search?countrycode=BE&language=dutch&hidebroken=true&order=clickcount&reverse=true&limit=150';
    const res = await fetch(url, { headers: { 'User-Agent': 'ThuisDashboard/0.1' } });
    if (!res.ok) throw new Error(`Radio Browser: ${res.status}`);
    const list = (await res.json())
      .filter((s) => s.url_resolved)
      .map((s) => ({ id: s.stationuuid, name: s.name.trim(), url: s.url_resolved, favicon: s.favicon || null }));
    const seen = new Set();
    const unique = list.filter((s) => (seen.has(s.name.toLowerCase()) ? false : seen.add(s.name.toLowerCase())));
    this.radioCache = { at: Date.now(), list: unique };
    return unique;
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
    this.log.info?.(`[arrival] ${personId} arrived, notifying via notify.${service}`);
    await this.ha.callService('notify', service, {
      title: 'Welkom thuis 🏠',
      message: 'Welke kamer wil je opwarmen?',
      data: {
        tag: 'thuis-dashboard-arrival',
        actions: [
          { action: `${HEAT_ACTION_PREFIX}LIVING`, title: 'Living' },
          { action: `${HEAT_ACTION_PREFIX}SLAAPKAMER`, title: 'Slaapkamer' },
        ],
      },
    });
  }
}

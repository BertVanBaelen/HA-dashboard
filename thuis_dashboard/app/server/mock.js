import { EventEmitter } from 'node:events';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const MOCK_USERS = { bert: 'mock-user-bert', marjo: 'mock-user-marjo' };
export { MOCK_USERS };

const now = () => new Date().toISOString();
const rand = (a, b, d = 1) => Number((a + Math.random() * (b - a)).toFixed(d));
const MG_MOCK = {
  ancillary_battery_voltage: ['12.6', 'V'], battery_energy: ['44.1', 'kWh'], total_battery_capacity: ['64', 'kWh'],
  charging_current: ['10.8', 'A'], charging_voltage: ['398', 'V'], last_charge_energy: ['21.4', 'kWh'],
  last_trip_distance: ['12.4', 'km'], last_trip_efficiency: ['16.2', 'kWh/100km'], efficiency_since_last_charge: ['17.1', 'kWh/100km'],
  journey_distance: ['0', 'km'], instant_power: ['0.4', 'kW'], speed: ['0', 'km/h'], brand: ['MG'], model: ['MG4 Electric'], vin: ['LSJWH4000PN000000'],
};

/** Simulated MG4 history (rides + AC/DC charging) for the Ritten/Kosten views. */
function mgHistory(id, start, end) {
  const key = /^(sensor|switch)\.mg_mg4_electric_/.test(id) ? id.split('.')[1].replace('mg_mg4_electric_', '') : '';
  if (!['mileage', 'speed', 'state_of_charge', 'power_mode', 'charging_power', 'charging', 'battery_energy', 'last_charge_energy'].includes(key)) return null;
  const step = 300e3, cap = 61.7;
  let km = 23000, soc = 70, lce = 20.5, sess = 0, night = false;
  const pts = [];
  let prev;
  for (let t = Math.floor(start / step) * step; t <= end; t += step) {
    const d = new Date(t);
    const h = d.getHours() + d.getMinutes() / 60;
    const day = Math.floor(t / 86400e3);
    const trips = [[7.75, 0.6, 30], [17.2, 0.65, 32], ...(day % 4 === 0 ? [[12, 1.5, 120]] : [])];
    const trip = trips.find(([s, len]) => h >= s && h < s + len);
    let speed = 0, power = 0;
    if (trip) {
      speed = Math.round((trip[2] / trip[1]) * (0.7 + ((t / step) % 5) * 0.15));
      const dk = trip[2] / (trip[1] * 12);
      km += dk;
      soc -= ((dk * 0.165) / cap) * 100;
    } else if (day % 4 === 0 && h >= 13.6 && h < 14.2 && soc < 90) power = 48;
    else if (h >= 22 || h < 6) {
      if (!night && soc < 45) night = true;
      if (night && soc < 80) power = 7.2;
    } else night = false;
    if (power) { soc = Math.min(100, soc + (power / 12 / cap) * 100); sess += power / 12; } else if (sess) { lce = sess; sess = 0; }
    const v = { mileage: km.toFixed(1), speed: String(speed), state_of_charge: String(Math.round(soc)), power_mode: trip ? 'On' : 'Off', charging_power: power ? (power + rand(-0.3, 0.3)).toFixed(1) : '0',
      charging: power ? 'on' : 'off', battery_energy: ((soc / 100) * cap).toFixed(1), last_charge_energy: lce.toFixed(1) }[key];
    if (v !== prev || key === 'speed' && speed) pts.push({ s: v, lu: t / 1000 });
    prev = v;
  }
  return pts;
}

/** Entity list: a JSON array or a plain list with one entity id per line (optionally "- " prefixed). */
function parseEntityList(text) {
  try {
    return JSON.parse(text);
  } catch {
    return [...new Set([...text.matchAll(/^[\s\-*]*([a-z0-9_]+\.[a-z0-9_]+)\s*$/gm)].map((m) => m[1]))];
  }
}

function fakeState(id) {
  const [domain, name] = id.split('.');
  const attrs = { friendly_name: name.replace(/_/g, ' ') };
  let state = 'unknown';
  const n = name;
  switch (domain) {
    case 'person':
      state = n === 'marjo' ? 'not_home' : 'home';
      Object.assign(attrs, {
        user_id: n === 'marjo' ? MOCK_USERS.marjo : MOCK_USERS.bert,
        friendly_name: n === 'marjo' ? 'Marjo' : 'Bert',
        latitude: n === 'marjo' ? 51.2194 : 51.1347, longitude: n === 'marjo' ? 4.4025 : 4.3402,
      });
      break;
    case 'zone': state = '1'; Object.assign(attrs, { latitude: 51.1347, longitude: 4.3402, radius: 100, friendly_name: 'Thuis' }); break;
    case 'device_tracker':
      state = n.includes('iphone') ? 'not_home' : 'home';
      Object.assign(attrs, { latitude: n.includes('mg_') ? 51.1352 : 51.1347, longitude: n.includes('mg_') ? 4.3410 : 4.3402, source_type: 'gps', gps_accuracy: 10 });
      break;
    case 'light':
      state = 'on';
      Object.assign(attrs, { brightness: 160, color_mode: 'color_temp', color_temp_kelvin: 2700, rgb_color: [255, 170, 90], supported_color_modes: ['color_temp', 'rgb'], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500, effect_list: ['Sunrise', 'Aurora', 'Candlelight'] });
      break;
    case 'climate': {
      const car = n.includes('mg_');
      state = car ? 'off' : 'auto';
      Object.assign(attrs, {
        hvac_modes: car ? ['off', 'heat_cool'] : ['off', 'heat', 'auto'],
        current_temperature: rand(17, 22), temperature: car ? 22 : rand(18, 21, 0),
        min_temp: car ? 16 : 5, max_temp: car ? 28 : 25, target_temp_step: 0.5,
        preset_modes: car ? undefined : ['away', 'home', 'auto'], preset_mode: car ? undefined : 'home',
        current_humidity: rand(40, 60, 0),
      });
      break;
    }
    case 'weather':
      state = 'partlycloudy';
      Object.assign(attrs, { temperature: 14.2, apparent_temperature: 12.8, humidity: 71, wind_speed: 18, wind_bearing: 220, pressure: 1012, temperature_unit: '°C', wind_speed_unit: 'km/h' });
      break;
    case 'sun': state = 'above_horizon'; break;
    case 'switch': case 'input_boolean': case 'automation':
      state = /tv_actief|charging$|soundbar_aan|ventilator_socket|verwarming_uit|child_lock|socket_1|permit/.test(n) ? (n.includes('permit') ? 'off' : 'on') : 'off';
      if (n === 'stereo_actief') state = 'off';
      break;
    case 'binary_sensor':
      if (n.includes('connection') || n.includes('connectivity') || n.includes('power')) state = 'on';
      else if (n.endsWith('_battery')) state = n.includes('va0781') ? 'on' : 'off';
      else if (n.includes('lock_status')) state = 'on';
      else if (n === 'myggbett_door_window_sensor_door') state = 'on';
      else state = 'off';
      break;
    case 'lock': state = 'locked'; break;
    case 'media_player':
      if (n === 'chromecast_hd') { state = 'playing'; Object.assign(attrs, { app_name: 'YouTube', media_title: 'Lo-fi beats to relax to', entity_picture: null }); }
      else if (n === 'living_room_stereo') { state = 'off'; Object.assign(attrs, { source_list: ['Spotify', 'CD', 'AUDIO1', 'AUDIO2', 'Net Radio', 'Bluetooth'], source: 'Spotify', volume_level: 0.4 }); }
      else state = 'off';
      break;
    case 'remote': state = 'on'; break;
    case 'select':
      if (n.includes('heated_seat')) { state = 'Low'; attrs.options = ['Low', 'Medium', 'High']; }
      else if (n.includes('sleep_timer')) { state = 'Off'; attrs.options = ['Off', '30 min', '60 min', '90 min', '120 min']; }
      else if (n.includes('current_limit')) { state = '16A'; attrs.options = ['6A', '8A', '16A', 'Max']; }
      else if (n.includes('scheduled_charging')) { state = 'Disabled'; attrs.options = ['Disabled', 'Until configured SoC', 'Until configured time']; }
      else if (n.includes('scene')) { state = 'Sunrise'; attrs.options = ['Sunrise', 'Aurora', 'Candlelight', 'Forest']; }
      else { state = 'off'; attrs.options = ['off', 'on']; }
      break;
    case 'number':
      state = n.includes('target_soc') ? '80' : '50';
      Object.assign(attrs, { min: n.includes('target_soc') ? 40 : 0, max: 100, step: n.includes('target_soc') ? 10 : 1, unit_of_measurement: '%' });
      break;
    case 'time': state = '07:00:00'; break;
    case 'todo': state = n === 'shopping_list' ? '3' : '0'; attrs.supported_features = 15; attrs.friendly_name = n === 'shopping_list' ? 'Boodschappen' : 'Poetsdag'; break;
    case 'calendar': state = 'off'; attrs.friendly_name = n.replace(/_/g, ' '); attrs.supported_features = /calendar$|vakantie|other/.test(n) ? 7 : 0; break;
    case 'update': {
      const on = /core|bubble|hacs/.test(n);
      state = on ? 'on' : 'off';
      Object.assign(attrs, { installed_version: '1.2.0', latest_version: on ? '1.3.0' : '1.2.0', title: name.replace(/_update$/, '').replace(/_/g, ' '), release_url: 'https://www.home-assistant.io', in_progress: false, supported_features: 29, update_percentage: null });
      break;
    }
    case 'button': case 'scene': case 'script': case 'event': case 'notify': case 'tts': case 'conversation': case 'image':
      state = domain === 'script' ? 'off' : now();
      break;
    case 'sensor': {
      if (n.endsWith('_temperature')) { state = String(n.includes('outdoor') || n.includes('exterior') ? rand(8, 15) : rand(18, 22)); attrs.unit_of_measurement = '°C'; attrs.device_class = 'temperature'; attrs.state_class = 'measurement'; }
      else if (n.endsWith('_humidity')) { state = String(rand(40, 65, 0)); attrs.unit_of_measurement = '%'; attrs.device_class = 'humidity'; }
      else if (n.endsWith('_heating')) { state = String(n.includes('living') ? 35 : 0); attrs.unit_of_measurement = '%'; }
      else if (n.endsWith('battery_level') || n.endsWith('_battery') || n.endsWith('_battery_2')) { state = String(rand(15, 95, 0)); attrs.unit_of_measurement = '%'; attrs.device_class = 'battery'; }
      else if (n.endsWith('battery_state')) state = n.includes('iphone') ? 'Charging' : 'discharging';
      else if (n.endsWith('state_of_charge')) { state = '68'; attrs.unit_of_measurement = '%'; }
      else if (n.endsWith('electric_range')) { state = '274'; attrs.unit_of_measurement = 'km'; }
      else if (n.includes('tyre_pressure')) { state = String(rand(2.3, 2.6)); attrs.unit_of_measurement = 'bar'; }
      else if (n.endsWith('charging_power')) { state = '7.2'; attrs.unit_of_measurement = 'kW'; }
      else if (n.endsWith('remaining_charging_time')) { state = '95'; attrs.unit_of_measurement = 'min'; }
      else if (n.endsWith('charging_duration')) { state = '42'; attrs.unit_of_measurement = 'min'; }
      else if (n.endsWith('estimated_range_after_charging')) { state = '330'; attrs.unit_of_measurement = 'km'; }
      else if (n.endsWith('mileage')) { state = '18342'; attrs.unit_of_measurement = 'km'; }
      else if (n.includes('last_update_time') || n.includes('backup_last') || n.includes('next_scheduled') || n.startsWith('sun_next')) { state = new Date(Date.now() - 2 * 3600e3).toISOString(); attrs.device_class = 'timestamp'; if (n.startsWith('sun_next') || n.includes('next_scheduled')) state = new Date(Date.now() + 5 * 3600e3).toISOString(); }
      else if (n.includes('geocoded')) state = 'Kerkstraat 1, 2660 Hoboken';
      else if (n.includes('charger_type')) state = 'none';
      else if (n.includes('tado_mode')) state = 'HOME';
      else if (n.includes('geofencing')) state = 'Home';
      else if (n.includes('solar')) { state = '42'; attrs.unit_of_measurement = '%'; }
      else if (n.includes('backup_manager_state')) state = 'idle';
      else if (n.includes('reachability')) state = 'online';
      else if (n.includes('charging_status')) state = 'charging';
      else if (n.startsWith('mg_') && MG_MOCK[n.slice(16)]) [state, attrs.unit_of_measurement] = MG_MOCK[n.slice(16)];
      else state = String(rand(0, 100, 0));
      break;
    }
    default: state = 'on';
  }
  return { entity_id: id, state, attributes: attrs, last_changed: now(), last_updated: now(), context: { id: 'mock', user_id: null } };
}

// ---- SpotifyPlus mock ------------------------------------------------------

const SP_ENTITY = 'media_player.spotifyplus_bert';
const SP_ENTITY_2 = 'media_player.spotifyplus_marjo';
const SP_ENTITIES = [SP_ENTITY, SP_ENTITY_2];
const SP_DEVICES = [
  { Id: 'mock-eetkamer', Name: 'Eetkamer' },
  { Id: 'mock-phone', Name: 'Pixel van Bert' },
  { Id: 'mock-keuken', Name: 'Keuken speaker' },
];
const spId = (p, i) => `${p}${String(i).padStart(4, '0')}MockId00000000`.slice(0, 22);
const spImg = (seed) => `https://picsum.photos/seed/${seed}/300`;
const SP = (() => {
  const artists = ['Arsenal', 'Bazart', 'Stromae', 'Angèle', 'Goose', 'Balthazar'].map((name, i) => ({ type: 'artist', id: spId('ar', i), uri: `spotify:artist:${spId('ar', i)}`, name, image_url: spImg(`ar${i}`) }));
  const albums = ['Oyebo Soul', 'Echo', 'Multitude', 'Nonante-Cinq', 'Synrise', 'Fever'].map((name, i) => ({ type: 'album', id: spId('al', i), uri: `spotify:album:${spId('al', i)}`, name, artists: [artists[i]], image_url: spImg(`al${i}`) }));
  const titles = ['Lotuk', 'Goud', 'Santé', 'Bruxelles je t\u2019aime', 'Synrise', 'Fever', 'Alors on danse', 'Nero', 'Papaoutai', 'Tout oublier', 'Bestie', 'Changes'];
  const tracks = titles.map((name, i) => ({ type: 'track', id: spId('tr', i), uri: `spotify:track:${spId('tr', i)}`, name, duration_ms: 150000 + i * 9000, explicit: i === 7, artists: [artists[i % artists.length]], album: albums[i % albums.length] }));
  const playlists = ['Discover Weekly', 'Zondagochtend', 'Koken', 'Belgische hits', 'Feestje'].map((name, i) => ({ type: 'playlist', id: spId('pl', i), uri: `spotify:playlist:${spId('pl', i)}`, name, owner: { display_name: i ? 'Bert' : 'Spotify' }, image_url: spImg(`pl${i}`) }));
  const shows = ['De Ideale Wereld', 'Nerdland'].map((name, i) => ({ type: 'show', id: spId('sh', i), uri: `spotify:show:${spId('sh', i)}`, name, publisher: 'VRT', image_url: spImg(`sh${i}`) }));
  const episodes = [1, 2, 3].map((n, i) => ({ type: 'episode', id: spId('ep', i), uri: `spotify:episode:${spId('ep', i)}`, name: `Aflevering ${n}`, duration_ms: 3000000, release_date: '2025-01-0' + n, images: [{ url: spImg(`ep${i}`) }] }));
  return { artists, albums, tracks, playlists, shows, episodes, liked: new Set([tracks[0].id, tracks[2].id]) };
})();

function spotifyState(entity = SP_ENTITY, user = 'Bert') {
  const t = SP.tracks[0];
  return {
    entity_id: entity, state: 'paused', last_changed: now(), last_updated: now(), context: { id: 'mock', user_id: null },
    attributes: {
      friendly_name: `SpotifyPlus ${user}`, sp_user_id: user.toLowerCase(), sp_user_display_name: user, sp_user_product: 'premium',
      sp_device_name: 'Pixel van Bert', sp_device_id: 'mock-phone', sp_context_uri: SP.playlists[1].uri, sp_playlist_name: SP.playlists[1].name,
      media_content_id: t.uri, media_title: t.name, media_artist: t.artists[0].name, media_album_name: t.album.name,
      media_duration: Math.round(t.duration_ms / 1000), media_position: 42, media_position_updated_at: now(),
      sp_nowplaying_image_url: t.album.image_url, entity_picture: t.album.image_url, shuffle: false, repeat: 'off', volume_level: 0.4,
    },
  };
}

export class MockHaClient extends EventEmitter {
  constructor({ log = console } = {}) {
    super();
    this.log = log;
    this.connected = false;
    this.states = new Map();
    this.todos = {
      'todo.shopping_list': [
        { uid: '1', summary: 'Melk', status: 'needs_action' },
        { uid: '2', summary: 'Kattenvoer', status: 'needs_action' },
        { uid: '3', summary: 'Brood', status: 'needs_action' },
        { uid: '4', summary: 'Koffie', status: 'completed' },
      ],
      'todo.cleaning_day': [],
    };
    this.eventSubs = [];
    this.created = {};
  }

  start() {
    const candidates = [process.env.MOCK_ENTITIES, join(here, '..', '..', '..', 'Entity list.txt')].filter(Boolean);
    const file = candidates.find((f) => existsSync(f));
    const ids = file ? parseEntityList(readFileSync(file, 'utf8')) : [];
    for (const id of ids) this.states.set(id, fakeState(id));
    this.states.set(SP_ENTITY, spotifyState());
    this.states.set(SP_ENTITY_2, spotifyState(SP_ENTITY_2, 'Marjo'));
    setTimeout(() => {
      this.connected = true;
      this.emit('states', this.states);
      this.emit('ready');
      this.log.info?.(`[mock] ${this.states.size} fake entities loaded`);
    }, 100);
    setInterval(() => this.#jitter(), 5000);
  }

  #jitter() {
    for (const id of ['sensor.living_living_temperature', 'sensor.mg_mg4_electric_charging_power']) {
      const s = this.states.get(id);
      if (!s) continue;
      this.#set(id, String((Number(s.state) + rand(-0.2, 0.2)).toFixed(1)));
    }
  }

  #set(id, state, attrs) {
    const old = this.states.get(id) ?? fakeState(id);
    const s = { ...old, state: state ?? old.state, attributes: { ...old.attributes, ...(attrs ?? {}) }, last_updated: now() };
    if (state != null && state !== old.state) s.last_changed = now();
    this.states.set(id, s);
    this.emit('state', id, s);
  }

  getState(id) { return this.states.get(id) ?? null; }

  subscribeEvents(eventType, cb) { this.eventSubs.push({ eventType, cb }); return 'mock'; }

  async callService(domain, service, data = {}, target, returnResponse) {
    const ids = [].concat(target?.entity_id ?? data.entity_id ?? []);
    this.log.info?.(`[mock] ${domain}.${service}`, JSON.stringify({ ...data, entity_id: ids }));
    await new Promise((r) => setTimeout(r, 150));
    if (domain === 'weather') return { response: this.#forecast(ids, data.type) };
    if (domain === 'calendar' && service === 'get_events') return { response: this.#events(ids, data) };
    if (domain === 'calendar' && service === 'create_event') {
      for (const id of ids) (this.created[id] ??= []).push({ start: data.start_date_time ?? data.start_date, end: data.end_date_time ?? data.end_date, summary: data.summary, location: data.location, description: data.description });
      return {};
    }
    if (domain === 'todo') return this.#todo(service, ids[0], data);
    if (domain === 'spotifyplus') return { response: { user_profile: {}, result: this.#spotify(service, data, data.entity_id) } };
    if (domain === 'media_player' && SP_ENTITIES.includes(ids[0])) return this.#spotifyPlayer(service, data, ids[0]), {};
    if (domain === 'script' && service !== 'turn_on') {
      if (service === 'tv_aan') { this.#set('input_boolean.tv_actief', 'on'); this.#set('remote.chromecast_hd', 'on'); this.#set('media_player.chromecast_hd', 'idle'); }
      if (service === 'tv_uit') { this.#set('input_boolean.tv_actief', 'off'); this.#set('remote.chromecast_hd', 'off'); this.#set('media_player.chromecast_hd', 'off'); }
      if (service === 'stereo_aan') { this.#set('input_boolean.stereo_actief', 'on'); this.#set('media_player.living_room_stereo', 'playing', { media_title: 'Studio Brussel' }); }
      if (service === 'stereo_uit') { this.#set('input_boolean.stereo_actief', 'off'); this.#set('media_player.living_room_stereo', 'off'); }
      return {};
    }
    for (const id of ids) {
      const s = this.states.get(id);
      if (!s) continue;
      if (service === 'turn_on') this.#set(id, 'on', domain === 'light' ? { ...(data.brightness_pct != null ? { brightness: Math.round(data.brightness_pct * 2.55) } : {}), ...(data.rgb_color ? { rgb_color: data.rgb_color, color_mode: 'rgb' } : {}), ...(data.color_temp_kelvin ? { color_temp_kelvin: data.color_temp_kelvin, color_mode: 'color_temp' } : {}), ...(data.effect ? { effect: data.effect } : {}) } : undefined);
      else if (service === 'turn_off') this.#set(id, 'off');
      else if (service === 'toggle') this.#set(id, s.state === 'on' ? 'off' : 'on');
      else if (service === 'lock') this.#set(id, 'locked');
      else if (service === 'unlock') this.#set(id, 'unlocked');
      else if (service === 'set_temperature') this.#set(id, data.hvac_mode ?? null, { temperature: data.temperature });
      else if (service === 'set_hvac_mode') this.#set(id, data.hvac_mode);
      else if (service === 'set_preset_mode') this.#set(id, null, { preset_mode: data.preset_mode });
      else if (service === 'set_climate_timer') this.#set(id, 'heat', { temperature: data.temperature });
      else if (service === 'select_option') this.#set(id, data.option);
      else if (service === 'set_value') this.#set(id, String(data.time ?? data.value));
      else if (service === 'select_source') this.#set(id, 'playing', { source: data.source });
      else if (service === 'play_media') this.#set(id, 'playing', { media_title: data.media_content_id });
      else if (service === 'media_play_pause') this.#set(id, s.state === 'playing' ? 'paused' : 'playing');
      else if (service === 'send_command' && id === 'remote.chromecast_hd' && data.command === 'MEDIA_PLAY_PAUSE') {
        const cast = this.states.get('media_player.chromecast_hd');
        if (cast) this.#set(cast.entity_id, cast.state === 'playing' ? 'paused' : 'playing');
      }
      else if (service === 'volume_set') this.#set(id, null, { volume_level: data.volume_level });
      else if (service === 'volume_mute') this.#set(id, null, { is_volume_muted: data.is_volume_muted });
      else if (service === 'install') { this.#set(id, 'off', { installed_version: s.attributes.latest_version }); }
    }
    return {};
  }

  #spotifyPlay(ent, track, extra = {}) {
    this.#set(ent, 'playing', {
      media_content_id: track.uri, media_title: track.name, media_artist: track.artists[0].name, media_album_name: track.album.name,
      media_duration: Math.round(track.duration_ms / 1000), media_position: 0, media_position_updated_at: now(),
      sp_nowplaying_image_url: track.album.image_url, entity_picture: track.album.image_url, sp_device_name: 'Eetkamer', sp_device_id: 'mock-eetkamer', ...extra,
    });
  }

  /** Output device for a SpotifyPlus call; MOCK_SP_SLEEP=1 simulates a dormant stereo without Spotify Connect login. */
  #spDevice(ent, deviceId) {
    const cur = this.states.get(ent)?.attributes;
    const want = String(deviceId ?? cur?.sp_device_id ?? 'mock-eetkamer').toLowerCase();
    const dev = SP_DEVICES.find((d) => d.Id.toLowerCase() === want || d.Name.toLowerCase() === want);
    if (!dev) throw new Error(`Device "${deviceId}" not found`);
    if (dev.Id === 'mock-eetkamer' && process.env.MOCK_SP_SLEEP === '1' && cur?.sp_device_id !== dev.Id) {
      throw new Error("SAM1005E - 'spotifyConnectUsername' configuration option was not supplied; cannot activate Spotify Connect device \"Eetkamer\"");
    }
    return { sp_device_name: dev.Name, sp_device_id: dev.Id };
  }

  #spotify(service, data, ent) {
    const s = this.states.get(ent);
    const page = (items) => ({ items, total: items.length, limit: items.length });
    const saved = (items, key) => page(items.map((x) => ({ added_at: now(), [key]: x })));
    const byUri = (uri) => SP.tracks.find((t) => t.uri === uri);
    switch (service) {
      case 'get_spotify_connect_devices':
        return {
          Items: SP_DEVICES.map((d) => ({
            ...d,
            IsActiveDevice: s?.attributes.sp_device_id === d.Id,
            IsInDeviceList: !(d.Id === 'mock-eetkamer' && process.env.MOCK_SP_SLEEP === '1') || s?.attributes.sp_device_id === d.Id,
          })),
        };
      case 'get_playlist_favorites': return page(ent === SP_ENTITY ? SP.playlists : [...SP.playlists].reverse().slice(0, 3).map((p) => ({ ...p, owner: { display_name: 'Marjo' } })));
      case 'get_album_favorites': return saved(SP.albums, 'album');
      case 'get_artists_followed': return page(SP.artists);
      case 'get_track_favorites': return saved(SP.tracks, 'track');
      case 'get_player_recent_tracks': return page([...SP.tracks].reverse().map((track) => ({ played_at: now(), track })));
      case 'get_show_favorites': return saved(SP.shows, 'show');
      case 'get_playlist_items': return page(SP.tracks.slice(0, 8).map((track) => ({ added_at: now(), track })));
      case 'get_album_tracks': return page(SP.tracks.slice(2, 9).map(({ album, ...t }) => t));
      case 'get_show_episodes': return page(SP.episodes);
      case 'get_artist_top_tracks': return SP.tracks.slice(0, 6);
      case 'get_artist_albums': return page(SP.albums);
      case 'search_all': {
        const q = String(data.criteria).toLowerCase();
        const f = (arr) => arr.filter((x) => JSON.stringify(x).toLowerCase().includes(q));
        return { tracks: page(f(SP.tracks)), artists: page(f(SP.artists)), albums: page(f(SP.albums)), playlists: page(f(SP.playlists)) };
      }
      case 'get_player_queue_info': {
        const i = Math.max(0, SP.tracks.findIndex((t) => t.uri === s?.attributes.media_content_id));
        return { currently_playing: SP.tracks[i], queue: [...SP.tracks.slice(i + 1), ...SP.tracks.slice(0, i)] };
      }
      case 'check_track_favorites': return Object.fromEntries(String(data.ids).split(',').map((id) => [id, SP.liked.has(id)]));
      case 'save_track_favorites': String(data.ids).split(',').forEach((id) => SP.liked.add(id)); return null;
      case 'remove_track_favorites': String(data.ids).split(',').forEach((id) => SP.liked.delete(id)); return null;
      case 'player_media_play_tracks': this.#spotifyPlay(ent, byUri(String(data.uris).split(',')[0]) ?? SP.tracks[0], { sp_context_uri: null, sp_playlist_name: null, ...this.#spDevice(ent, data.device_id) }); return null;
      case 'player_media_play_track_favorites': this.#spotifyPlay(ent, SP.tracks[data.shuffle ? 3 : 0], { shuffle: !!data.shuffle, sp_playlist_name: 'Liked Songs', ...this.#spDevice(ent, data.device_id) }); return null;
      case 'player_media_play_context': {
        const dev = this.#spDevice(ent, data.device_id);
        const pl = SP.playlists.find((p) => p.uri === data.context_uri) ?? SP.albums.find((p) => p.uri === data.context_uri);
        this.#spotifyPlay(ent, byUri(data.offset_uri) ?? SP.tracks[0], { sp_context_uri: data.context_uri, sp_playlist_name: pl?.name ?? null, ...dev, ...(typeof data.shuffle === 'boolean' ? { shuffle: data.shuffle } : {}) });
        return null;
      }
      case 'player_transfer_playback': this.#set(ent, data.play ? 'playing' : null, { ...this.#spDevice(ent, data.device_id), media_position_updated_at: now() }); return null;
      case 'player_media_resume': {
        const dev = this.#spDevice(ent, data.device_id);
        if (s?.attributes.media_content_id) this.#set(ent, 'playing', { ...dev, media_position_updated_at: now() });
        else this.#spotifyPlay(ent, SP.tracks[0], dev);
        return null;
      }
      default: return null;
    }
  }

  #spotifyPlayer(service, data, ent) {
    const s = this.states.get(ent);
    const i = SP.tracks.findIndex((t) => t.uri === s?.attributes.media_content_id);
    const pos = () => {
      const a = s.attributes;
      return s.state === 'playing' ? a.media_position + (Date.now() - Date.parse(a.media_position_updated_at)) / 1000 : a.media_position;
    };
    if (service === 'media_play') this.#set(ent, 'playing', { media_position_updated_at: now() });
    else if (service === 'media_pause') this.#set(ent, 'paused', { media_position: Math.round(pos()), media_position_updated_at: now() });
    else if (service === 'media_next_track') this.#spotifyPlay(ent, SP.tracks[(i + 1) % SP.tracks.length]);
    else if (service === 'media_previous_track') this.#spotifyPlay(ent, SP.tracks[(i - 1 + SP.tracks.length) % SP.tracks.length]);
    else if (service === 'media_seek') this.#set(ent, null, { media_position: data.seek_position, media_position_updated_at: now() });
    else if (service === 'shuffle_set') this.#set(ent, null, { shuffle: data.shuffle });
    else if (service === 'repeat_set') this.#set(ent, null, { repeat: data.repeat });
    else if (service === 'volume_set') this.#set(ent, null, { volume_level: data.volume_level });
  }

  #forecast(ids, type) {
    const conds = ['sunny', 'partlycloudy', 'cloudy', 'rainy', 'pouring', 'partlycloudy', 'sunny'];
    const out = [];
    const step = type === 'hourly' ? 3600e3 : 86400e3;
    const n = type === 'hourly' ? 24 : 7;
    if (type === 'hourly') {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      const shower = [0, 0, 0.2, 1.4, 2.6, 0.8, 0, 0, 0, 0.4, 1.1, 0, 0, 0, 0, 0, 3.2, 1.9, 0.3, 0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        const mm = shower[i] ? Number((shower[i] * rand(0.7, 1.3, 2)).toFixed(1)) : 0;
        const t = new Date(start.getTime() + i * step);
        out.push({
          datetime: t.toISOString(),
          condition: mm >= 2 ? 'pouring' : mm > 0 ? 'rainy' : i % 5 === 0 ? 'sunny' : 'partlycloudy',
          temperature: Number((13 + 4 * Math.sin(((t.getHours() - 9) / 24) * 2 * Math.PI) + rand(-0.5, 0.5)).toFixed(1)),
          precipitation: mm,
          precipitation_probability: mm ? rand(45, 95, 0) : rand(0, 15, 0),
          wind_speed: rand(8, 30),
        });
      }
      return Object.fromEntries(ids.map((id) => [id, { forecast: out }]));
    }
    for (let i = 0; i < n; i++) {
      out.push({
        datetime: new Date(Date.now() + i * step).toISOString(),
        condition: conds[i % conds.length],
        temperature: rand(10, 18), templow: type === 'daily' ? rand(3, 9) : undefined,
        precipitation_probability: rand(0, 80, 0), precipitation: rand(0, 3),
      });
    }
    return Object.fromEntries(ids.map((id) => [id, { forecast: out }]));
  }

  #events(ids, { start_date_time, end_date_time }) {
    const start = new Date(start_date_time ?? Date.now());
    const end = new Date(end_date_time ?? Date.now() + 7 * 86400e3);
    const out = {};
    const titles = ['Tandarts', 'Etentje met vrienden', 'Training', 'Vergadering', 'Verjaardag mama', 'Sporthal', 'Dierenarts'];
    ids.forEach((id, idx) => {
      const events = [];
      for (let t = new Date(start); t < end; t = new Date(t.getTime() + 86400e3)) {
        if ((t.getDate() + idx) % 3 !== 0) continue;
        const s = new Date(t); s.setHours(9 + ((t.getDate() + idx) % 10), 0, 0, 0);
        const e = new Date(s.getTime() + 3600e3);
        events.push({ start: s.toISOString(), end: e.toISOString(), summary: titles[(t.getDate() + idx) % titles.length], location: idx % 2 ? 'Antwerpen' : undefined });
      }
      const nowS = new Date(); nowS.setMinutes(0, 0, 0); nowS.setHours(nowS.getHours() - 1);
      const live = idx === 0
        ? [{ start: nowS.toISOString(), end: new Date(nowS.getTime() + 3 * 3600e3).toISOString(), summary: 'Thuiswerken', location: 'Bureau', uid: `live-${id}` },
           { start: new Date(nowS.getTime() + 2.5 * 3600e3).toISOString(), end: new Date(nowS.getTime() + 3.5 * 3600e3).toISOString(), summary: 'Koffie met Jan', uid: `next-${id}` }]
        : idx === 1 ? [{ start: nowS.toISOString().slice(0, 10), end: new Date(nowS.getTime() + 86400e3).toISOString().slice(0, 10), summary: 'Verlof', uid: `day-${id}` }] : [];
      events.push(...live.filter((ev) => new Date(ev.end) > start && new Date(ev.start) < end));
      out[id] = { events: [...events, ...(this.created[id] ?? []).filter((ev) => new Date(ev.end) > start && new Date(ev.start) < end)] };
    });
    return out;
  }

  #todo(service, id, data) {
    const list = (this.todos[id] ??= []);
    if (service === 'add_item') list.push({ uid: String(Date.now()), summary: data.item, status: 'needs_action' });
    if (service === 'update_item') {
      const it = list.find((x) => x.uid === data.item || x.summary === data.item);
      if (it) { if (data.rename) it.summary = data.rename; if (data.status) it.status = data.status; }
    }
    if (service === 'remove_item') this.todos[id] = list.filter((x) => ![].concat(data.item).includes(x.uid) && ![].concat(data.item).includes(x.summary));
    if (service === 'remove_completed_items') this.todos[id] = list.filter((x) => x.status !== 'completed');
    this.#set(id, String(this.todos[id].filter((x) => x.status === 'needs_action').length));
    return {};
  }

  #zhaDevices() {
    const ago = (min) => new Date(Date.now() - min * 60e3).toISOString();
    const dev = (ieee, nwk, name, manufacturer, model, device_type, power_source, available, lqi, lastMin, entities = []) => ({
      ieee, nwk, name: `${manufacturer} ${model}`, user_given_name: name, manufacturer, model, quirk_class: 'zigpy.device.Device', available, lqi, rssi: lqi ? Math.round(lqi / 4 - 90) : null,
      last_seen: ago(lastMin), power_source, device_type, area_id: null, entities: entities.map((entity_id) => ({ entity_id })),
    });
    return [
      dev('00:12:4b:00:2a:3b:4c:5d', 0, null, 'ITEAD', 'Sonoff Zigbee 3.0 USB Dongle Plus V2', 'Coordinator', 'Mains', true, 255, 0),
      dev('84:2e:14:ff:fe:11:22:33', 0x1a2b, 'Living raam', 'IKEA of Sweden', 'MYGGBETT door/window sensor', 'EndDevice', 'Battery or Unknown', true, 156, 4, ['binary_sensor.myggbett_door_window_sensor_door', 'sensor.myggbett_door_window_sensor_battery']),
      dev('84:2e:14:ff:fe:44:55:66', 0x3c4d, 'Badkamerdeur', 'IKEA of Sweden', 'MYGGBETT door/window sensor', 'EndDevice', 'Battery or Unknown', true, 98, 22, ['binary_sensor.myggbett_door_window_sensor_door_2', 'sensor.myggbett_door_window_sensor_battery_2']),
      dev('a4:c1:38:aa:bb:cc:dd:ee', 0x5e6f, 'Stekker bureau', 'IKEA of Sweden', 'TRETAKT Smart plug', 'Router', 'Mains', true, 212, 1),
      dev('a4:c1:38:11:22:33:44:55', 0x7081, 'Temperatuur zolder', 'SONOFF', 'SNZB-02D', 'EndDevice', 'Battery or Unknown', false, 34, 60 * 26),
    ];
  }

  async send(msg) {
    if (msg.type === 'media_player/browse_media') {
      const item = (title, id, canPlay, canExpand) => ({ title, media_content_id: id, media_content_type: canPlay ? 'track' : 'directory', can_play: canPlay, can_expand: canExpand });
      if (!msg.media_content_id !== !msg.media_content_type) throw new Error('media_content_type and media_content_id must be provided together');
      const id = msg.media_content_id;
      if (!id) return { title: 'Living Room Stereo', media_content_id: '', children: [item('Net Radio', 'input:net_radio', false, true), item('Favorieten', 'presets', false, true), item('Server', 'input:server', false, true)] };
      if (id === 'input:net_radio') return { title: 'Net Radio', media_content_id: id, children: [item('Bookmarks', 'list:net_radio:bm:-1', false, true), item('Locatie', 'list:net_radio:loc:-1', false, true)] };
      if (id.startsWith('list:net_radio:')) return { title: 'Zenders', media_content_id: id, children: ['VRT NWS', 'Studio Brussel', 'MNM', 'Radio 1', 'Radio 2', 'Joe', 'Q-music'].map((n, i) => item(n, `list:net_radio:${id.split(':')[2]}:s:${i}`, true, false)) };
      return { title: 'Leeg', media_content_id: id, children: [] };
    }
    if (msg.type === 'lovelace/resources' || msg.type === 'lovelace/dashboards/list') return [];
    if (msg.type.startsWith('lovelace/')) return null;
    if (msg.type === 'todo/item/list') return { items: this.todos[msg.entity_id] ?? [] };
    if (msg.type === 'zha/devices') return this.#zhaDevices();
    if (msg.type === 'history/history_during_period') {
      const start = new Date(msg.start_time).getTime();
      const end = msg.end_time ? new Date(msg.end_time).getTime() : Date.now();
      const out = {};
      for (const id of msg.entity_ids) {
        const car = mgHistory(id, start, end);
        if (car) { out[id] = car; continue; }
        const pts = [];
        const step = Math.max(300e3, (end - start) / 200);
        let v = rand(18, 21);
        for (let t = start; t <= end; t += step) { v += rand(-0.3, 0.3); pts.push({ s: v.toFixed(1), lu: t / 1000 }); }
        out[id] = pts;
      }
      return out;
    }
    if (msg.type === 'recorder/statistics_during_period') {
      const start = new Date(msg.start_time).getTime();
      const end = msg.end_time ? new Date(msg.end_time).getTime() : Date.now();
      const step = { '5minute': 300e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3 }[msg.period] ?? 3600e3;
      const out = {};
      for (const id of msg.statistic_ids) {
        const pts = [];
        let v = rand(20, 70);
        for (let t = start; t <= end; t += step) { v = Math.max(0, v + rand(-5, 5)); pts.push({ start: t, end: t + step, mean: v, min: v - 2, max: v + 3, change: rand(0, 60) }); }
        out[id] = pts;
      }
      return out;
    }
    return null;
  }
}

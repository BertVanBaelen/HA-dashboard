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
      const on = /core|zigbee2mqtt|bubble|hacs/.test(n);
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
      else if (n.includes('zigbee2mqtt_bridge_version')) state = '2.1.3';
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
    const ids = file ? JSON.parse(readFileSync(file, 'utf8')) : [];
    for (const id of ids) this.states.set(id, fakeState(id));
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
      else if (service === 'install') { this.#set(id, 'off', { installed_version: s.attributes.latest_version }); }
    }
    return {};
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

  async send(msg) {
    if (msg.type === 'lovelace/resources' || msg.type === 'lovelace/dashboards/list') return [];
    if (msg.type.startsWith('lovelace/')) return null;
    if (msg.type === 'todo/item/list') return { items: this.todos[msg.entity_id] ?? [] };
    if (msg.type === 'history/history_during_period') {
      const start = new Date(msg.start_time).getTime();
      const end = msg.end_time ? new Date(msg.end_time).getTime() : Date.now();
      const out = {};
      for (const id of msg.entity_ids) {
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

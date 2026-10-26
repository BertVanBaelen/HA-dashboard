// Central entity configuration shared by backend and frontend.
// Rename entities here only.

export const PEOPLE = [
  {
    key: 'bert',
    name: 'Bert',
    person: 'person.appie_hemiksem',
    tracker: 'device_tracker.motorola_edge_60_fusion',
    battery: 'sensor.motorola_edge_60_fusion_battery_level',
    batteryState: 'sensor.motorola_edge_60_fusion_battery_state',
    charger: 'sensor.motorola_edge_60_fusion_charger_type',
    geocoded: 'sensor.motorola_edge_60_fusion_geocoded_location',
    notify: 'mobile_app_motorola_edge_60_fusion',
  },
  {
    key: 'marjo',
    name: 'Marjo',
    person: 'person.marjo',
    tracker: 'device_tracker.iphone_van_marjolien',
    battery: 'sensor.iphone_van_marjolien_battery_level',
    batteryState: 'sensor.iphone_van_marjolien_battery_state',
    charger: null,
    geocoded: null,
    notify: 'mobile_app_iphone_van_marjolien',
  },
];

export const HOME = {
  weather: 'weather.forecast_home',
  outdoorTemperature: 'sensor.thuis_outdoor_temperature',
  sunRising: 'sensor.sun_next_rising',
  sunSetting: 'sensor.sun_next_setting',
  zone: 'zone.home',
  sun: 'sun.sun',
  tadoMode: 'sensor.thuis_tado_mode',
  geofencingMode: 'sensor.thuis_geofencing_mode',
  automaticGeofencing: 'sensor.thuis_automatic_geofencing',
  solar: 'sensor.thuis_solar_percentage',
  fan: 'switch.ventilator_socket_1',
  bathroomHeatScript: 'script.badkamer_verwarmen',
  windowAutomation: 'automation.verwarming_uit_bij_raam_open',
};

export const MEDIA = {
  tvPower: 'media_player.slaapkamer_bert_tv',
  tvRemote: 'remote.55mled810_12_remote',
  // Android TV Remote keys sent to the Chromecast (remote.send_command) – the Philips TV keys don't reach the Chromecast app
  castKeys: { playPause: 'MEDIA_PLAY_PAUSE', rewind: 'MEDIA_REWIND', forward: 'MEDIA_FAST_FORWARD' },
  chromecast: 'media_player.chromecast_hd',
  chromecastRemote: 'remote.chromecast_hd',
  tvActive: 'input_boolean.tv_actief',
  stereo: 'media_player.living_room_stereo',
  stereoActive: 'input_boolean.stereo_actief',
  stereoSleepTimer: 'select.living_room_stereo_sleep_timer',
  soundbarOn: 'input_boolean.soundbar_aan',
  soundbarPower: 'script.sounbar_power',
  soundbarVolumeUp: 'script.soundbar_volume_up',
  soundbarVolumeDown: 'script.soundbar_volume_down',
  soundbarMute: null, // no mute script yet
  soundbarInput: 'script.soundbar_input_toggle',
  soundbarAux: 'script.soundbar_aux',
  // Scripts the user must provide in HA (see DOCS.md)
  scripts: {
    tvOn: 'script.tv_aan',
    tvOff: 'script.tv_uit',
    stereoOn: 'script.stereo_aan',
    stereoOff: 'script.stereo_uit',
  },
  // Matched case-insensitively against the stereo's source_list
  stereoSources: [
    { key: 'spotify', label: 'Spotify', match: ['spotify'] },
    { key: 'cd', label: 'CD', match: ['cd'] },
    { key: 'line1', label: 'Platenspeler', match: ['line1', 'line 1', 'audio1', 'audio 1'] },
  ],
  // SpotifyPlus (HACS). entity: null = first media_player with SpotifyPlus attributes.
  // device: Spotify Connect name of the stereo (matched case-insensitively, partial match allowed).
  spotify: {
    entity: null,
    device: 'Eetkamer',
  },
  apps: [
    { key: 'youtube', label: 'YouTube', activity: 'https://www.youtube.com', color: '#FF0000', icon: 'youtube' },
    { key: 'hbo', label: 'HBO Max', activity: 'https://play.max.com', color: '#9B59F0', icon: 'movie' },
    { key: 'spotify', label: 'Spotify', activity: 'spotify://', color: '#1DB954', icon: 'spotify' },
    { key: 'prime', label: 'Prime Video', activity: 'https://app.primevideo.com', color: '#00A8E1', icon: 'moviePlay' },
  ],
  // Verify each on the Chromecast HD
  moreApps: [
    { key: 'netflix', label: 'Netflix', activity: 'https://www.netflix.com/title' },
    { key: 'disney', label: 'Disney+', activity: 'https://www.disneyplus.com' },
    { key: 'streamz', label: 'Streamz', activity: 'https://www.streamz.be' },
    { key: 'vtmgo', label: 'VTM GO', activity: 'https://www.vtmgo.be' },
    { key: 'vrtmax', label: 'VRT MAX', activity: 'https://www.vrt.be/vrtmax/' },
  ],
};

const UNAVAILABLE = ['unavailable', 'unknown', undefined];
/**
 * TV status follows the Chromecast: the Android TV remote entity is 'on' while the
 * device is awake, the cast media player is playing/paused/idle while an app runs.
 * Falls back to the input_boolean only when both Chromecast entities are unavailable.
 * @param {(id: string) => ({ state: string } | null | undefined)} getState
 */
export function tvIsOn(getState) {
  const remote = getState(MEDIA.chromecastRemote)?.state;
  const cast = getState(MEDIA.chromecast)?.state;
  if (UNAVAILABLE.includes(remote) && UNAVAILABLE.includes(cast)) return getState(MEDIA.tvActive)?.state === 'on';
  return remote === 'on' || ['playing', 'paused', 'idle', 'buffering', 'on'].includes(cast);
}

/** Stereo status follows the MusicCast player itself; input_boolean only as fallback. */
export function stereoIsOn(getState) {
  const st = getState(MEDIA.stereo)?.state;
  if (st == null || UNAVAILABLE.includes(st)) return getState(MEDIA.stereoActive)?.state === 'on';
  return !['off', 'standby'].includes(st);
}

export const DEFAULT_RADIOS = [];

const CAR = 'mg_mg4_electric';
export const CAR_ENTITIES = {
  soc: `sensor.${CAR}_state_of_charge`,
  range: `sensor.${CAR}_electric_range`,
  lock: `lock.${CAR}_lock`,
  lockStatus: `binary_sensor.${CAR}_lock_status`,
  lastUpdate: `sensor.${CAR}_last_update_time`,
  refresh: `button.${CAR}_update_vehicle_data`,
  charging: `switch.${CAR}_charging`,
  chargingPower: `sensor.${CAR}_charging_power`,
  remainingChargingTime: `sensor.${CAR}_remaining_charging_time`,
  chargingDuration: `sensor.${CAR}_charging_duration`,
  targetSoc: `number.${CAR}_target_soc`,
  estimatedRangeAfterCharging: `sensor.${CAR}_estimated_range_after_charging`,
  chargingCurrentLimit: `select.${CAR}_charging_current_limit`,
  climate: `climate.${CAR}_climate`,
  frontDefrost: `switch.${CAR}_front_defrost`,
  rearDefrost: `switch.${CAR}_rear_window_defrost`,
  seatLeft: `switch.${CAR}_heated_seat_front_left`,
  seatRight: `switch.${CAR}_heated_seat_front_right`,
  seatLeftLevel: `select.${CAR}_heated_seat_front_left_level`,
  seatRightLevel: `select.${CAR}_heated_seat_front_right_level`,
  driverAll: 'script.driver_al',
  defrostAll: 'script.defrost_all',
  interiorTemperature: `sensor.${CAR}_interior_temperature`,
  exteriorTemperature: `sensor.${CAR}_exterior_temperature`,
  openBoot: `button.${CAR}_open_boot`,
  triggerAlarm: `button.${CAR}_trigger_alarm`,
  chargingPortLock: `switch.${CAR}_charging_port_lock`,
  scheduledChargingMode: `select.${CAR}_scheduled_charging_mode`,
  scheduledChargingStart: `time.${CAR}_scheduled_charging_start`,
  scheduledChargingEnd: `time.${CAR}_scheduled_charging_end`,
  batteryHeating: `switch.${CAR}_battery_heating`,
  batteryHeatingSchedule: `switch.${CAR}_battery_heating_schedule`,
  batteryHeatingTime: `time.${CAR}_battery_heating_schedule_time`,
  holidayMode: `switch.${CAR}_holiday_mode`,
  tyres: [
    { label: 'Linksvoor', entity: `sensor.${CAR}_tyre_pressure_front_left` },
    { label: 'Rechtsvoor', entity: `sensor.${CAR}_tyre_pressure_front_right` },
    { label: 'Linksachter', entity: `sensor.${CAR}_tyre_pressure_rear_left` },
    { label: 'Rechtsachter', entity: `sensor.${CAR}_tyre_pressure_rear_right` },
  ],
  openings: [
    { label: 'Deur linksvoor', entity: `binary_sensor.${CAR}_door_front_left` },
    { label: 'Deur rechtsvoor', entity: `binary_sensor.${CAR}_door_front_right` },
    { label: 'Deur linksachter', entity: `binary_sensor.${CAR}_door_rear_left` },
    { label: 'Deur rechtsachter', entity: `binary_sensor.${CAR}_door_rear_right` },
    { label: 'Kofferbak', entity: `binary_sensor.${CAR}_boot_status` },
    { label: 'Motorkap', entity: `binary_sensor.${CAR}_bonnet_status` },
  ],
  location: `device_tracker.${CAR}_gps_location`,
  commandErrors: `event.${CAR}_command_errors`,
  windowsOpen: `button.${CAR}_open_windows`,
  windowsClose: `button.${CAR}_close_windows`,
  windowsVentilate: `button.${CAR}_ventilate_windows`,
  steeringWheel: `switch.${CAR}_heated_steering_wheel`,
  instantPower: `sensor.${CAR}_instant_power`,
  speed: `sensor.${CAR}_speed`,
  mileage: `sensor.${CAR}_mileage`,
  reachability: `sensor.${CAR}_reachability`,
};

export const CAR_FLAGS = [
  { key: 'windows', label: 'Ramen openen/sluiten/ventileren', default: false },
  { key: 'steeringWheel', label: 'Stuurverwarming', default: false },
  { key: 'batteryHeating', label: 'Batterijverwarming', default: true },
  { key: 'openBoot', label: 'Kofferbak openen', default: true },
  { key: 'triggerAlarm', label: 'Alarm activeren', default: true },
  { key: 'chargingPortLock', label: 'Laadpoort vergrendelen', default: true },
  { key: 'scheduledCharging', label: 'Gepland laden', default: true },
  { key: 'holidayMode', label: 'Vakantiemodus', default: true },
  { key: 'tyres', label: 'Bandenspanning', default: true },
  { key: 'location', label: 'Locatie (kaart)', default: true },
];

/** Charging prices (€/kWh): AC below the threshold, DC fast charging above it. */
export const CAR_CHARGE_PRICES = { acPerKwh: 0.37, dcPerKwh: 0.65, dcThresholdKw: 10 };
/** Usable battery capacity (kWh) when sensor total_battery_capacity is unavailable. */
export const CAR_BATTERY_KWH = 61.7;

export const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'plattegrond', label: 'Huisje', icon: 'floorPlan' },
  { id: 'klimaat', label: 'Klimaat', icon: 'thermostat' },
  { id: 'verlichting', label: 'Verlichting', icon: 'lightbulb' },
  { id: 'media', label: 'Media', icon: 'television' },
  { id: 'auto', label: 'Auto', icon: 'car' },
  { id: 'agenda', label: 'Agenda & Lijsten', short: 'Agenda', icon: 'calendar' },
  { id: 'nieuws', label: 'Nieuws', icon: 'newspaper' },
  { id: 'personen', label: 'Personen', icon: 'account' },
  { id: 'systeem', label: 'Systeem', icon: 'cog' },
  { id: 'grafieken', label: 'Grafieken', icon: 'chart' },
];

// News feeds. mode = default per user: 'alles' (every item), 'groot' (only big stories), 'uit'.
// body: how the full article is obtained – 'vrt' (per-article Atom feed), 'feed' (full text in the feed),
// 'page' (article page + Readability) or 'none' (summary only, e.g. behind a consent wall).
// weight = hours of "freshness bonus" when ordering the deck; perDay = max big stories per day.
export const NEWS_SOURCES = [
  { id: 'vrt', name: 'VRT NWS', color: '#f97316', feed: 'https://www.vrt.be/vrtnws/nl.rss.articles.xml', body: 'vrt', mode: 'alles', weight: 3, perDay: 6 },
  { id: 'nos', name: 'NOS', color: '#e11d48', feed: 'https://feeds.nos.nl/nosnieuwsalgemeen', body: 'feed', mode: 'alles', weight: 0, perDay: 4 },
  { id: 'bbc', name: 'BBC News', color: '#64748b', feed: 'https://feeds.bbci.co.uk/news/rss.xml', body: 'page', mode: 'alles', weight: 0, perDay: 4 },
  { id: 'sporza', name: 'Sporza', color: '#16a34a', feed: 'https://sporza.be/nl.rss.xml', body: 'page', mode: 'groot', weight: 0, perDay: 3 },
  { id: 'tweakers', name: 'Tweakers', color: '#0ea5e9', feed: 'https://tweakers.net/feeds/nieuws.xml', body: 'none', mode: 'groot', weight: 0, perDay: 2,
    note: 'Tweakers laat het volledige artikel enkel op hun eigen site lezen.' },
];

export const NEWS_MODES = [
  { value: 'alles', label: 'Alles' },
  { value: 'groot', label: 'Belangrijk' },
  { value: 'uit', label: 'Uit' },
];

// Words that make a story "big" in 'groot' mode (besides being covered by the other sources too).
export const NEWS_BIG_KEYWORDS = {
  sporza: [
    'Rode Duivels', 'Red Flames', 'Red Lions', 'Belgian Cats', 'wereldkampioen', 'Europees kampioen', 'Belgisch kampioen',
    'wereldrecord', 'olympisch', 'Olympische', 'goud', 'landstitel', 'bekerfinale', 'Tour de France', 'Ronde van Frankrijk',
    'Ronde van Vlaanderen', 'Parijs-Roubaix', 'Evenepoel', 'Van Aert', 'Van der Poel', 'Thiam', 'WK', 'EK',
  ],
  tweakers: [
    'België', 'Belgische', 'Belgen', 'Vlaamse', 'Vlaanderen', 'Proximus', 'Telenet', 'itsme', 'storing', 'datalek', 'hack',
    'gehackt', 'cyberaanval', 'ransomware', 'kwetsbaarheid', 'Europese Commissie',
  ],
};

// Lovelace dashboard that redirects to this app (so it can be the HA default dashboard)
export const START_DASHBOARD = {
  urlPath: 'thuis-start',
  title: 'Thuis Start',
  resource: '/local/thuis_dashboard/redirect.js',
};

export const ACCENTS = [
  { key: 'blauw', label: 'Blauw', color: '#3b82f6' },
  { key: 'groen', label: 'Groen', color: '#22c55e' },
  { key: 'roze', label: 'Roze', color: '#ec4899' },
];

// Entities never exposed to the UI
export const EXCLUDED_ENTITY_PATTERNS = [
  /^media_player\.undefined_undefined_/,
  /^light\.h60b0$/,
  /^(light|button|update|number|select)\.bedroom_govee_vloerlamp/,
  /^script\.nieuw_script$/,
  /^script\.test_tablet_notification$/,
];

// Allowed service calls from the UI (domain -> services)
export const ALLOWED_SERVICES = {
  light: ['turn_on', 'turn_off', 'toggle'],
  switch: ['turn_on', 'turn_off', 'toggle'],
  input_boolean: ['turn_on', 'turn_off', 'toggle'],
  climate: ['set_temperature', 'set_hvac_mode', 'set_preset_mode', 'turn_on', 'turn_off'],
  tado: ['set_climate_timer'],
  script: ['turn_on'],
  scene: ['turn_on'],
  remote: ['send_command', 'turn_on', 'turn_off'],
  media_player: ['turn_on', 'turn_off', 'toggle', 'media_play_pause', 'media_play', 'media_pause', 'media_next_track', 'media_previous_track', 'select_source', 'play_media', 'volume_set', 'volume_mute'],
  select: ['select_option'],
  number: ['set_value'],
  time: ['set_value'],
  lock: ['lock', 'unlock'],
  button: ['press'],
  todo: ['add_item', 'update_item', 'remove_item', 'remove_completed_items', 'get_items'],
  calendar: ['get_events', 'create_event'],
  weather: ['get_forecasts'],
  update: ['install'],
  backup: ['create_automatic'],
  automation: ['turn_on', 'turn_off', 'toggle'],
};

// Raw HA websocket commands the UI may send
export const ALLOWED_WS_COMMANDS = [
  'history/history_during_period',
  'recorder/statistics_during_period',
  'todo/item/list',
];

// HA label that hides an entity from the dashboard
export const HIDE_LABEL = 'dashboard_verbergen';
export const DEFAULT_COMFORT_TEMP = 21;
export const FLOOR_TYPES = [
  { key: 'wood', label: 'Parket' },
  { key: 'tile', label: 'Tegels' },
  { key: 'plain', label: 'Effen' },
  { key: 'stair', label: 'Trap' },
  { key: 'deck', label: 'Terras' },
];

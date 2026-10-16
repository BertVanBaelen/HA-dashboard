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

export const ROOMS = [
  {
    key: 'living',
    name: 'Living',
    climate: 'climate.living_living',
    temperature: 'sensor.living_living_temperature',
    humidity: 'sensor.living_living_humidity',
    heating: 'sensor.living_living_heating',
    tadoMode: 'sensor.living_living_tado_mode',
    window: 'binary_sensor.living_living_window',
    earlyStart: 'binary_sensor.living_living_early_start',
    overlay: 'binary_sensor.living_living_overlay',
    extraTemperature: null,
    extraHumidity: null,
  },
  {
    key: 'slaapkamer',
    name: 'Slaapkamer',
    climate: 'climate.slaapkamer_slaapkamer',
    temperature: 'sensor.slaapkamer_slaapkamer_temperature',
    humidity: 'sensor.slaapkamer_slaapkamer_humidity',
    heating: 'sensor.slaapkamer_slaapkamer_heating',
    tadoMode: 'sensor.slaapkamer_slaapkamer_tado_mode',
    window: 'binary_sensor.slaapkamer_slaapkamer_window',
    earlyStart: 'binary_sensor.slaapkamer_slaapkamer_early_start',
    overlay: 'binary_sensor.slaapkamer_slaapkamer_overlay',
    extraTemperature: 'sensor.bedroom_sensor_kamer_temperature',
    extraHumidity: 'sensor.bedroom_sensor_kamer_humidity',
  },
  {
    key: 'badkamer',
    name: 'Badkamer',
    climate: 'climate.badkamer_badkamer',
    temperature: 'sensor.badkamer_badkamer_temperature',
    humidity: 'sensor.badkamer_badkamer_humidity',
    heating: 'sensor.badkamer_badkamer_heating',
    tadoMode: 'sensor.badkamer_badkamer_tado_mode',
    window: 'binary_sensor.badkamer_badkamer_window',
    earlyStart: 'binary_sensor.badkamer_badkamer_early_start',
    overlay: 'binary_sensor.badkamer_badkamer_overlay',
    extraTemperature: null,
    extraHumidity: null,
  },
];

export const HOME = {
  weather: 'weather.forecast_home',
  outdoorTemperature: 'sensor.thuis_outdoor_temperature',
  sunRising: 'sensor.sun_next_rising',
  sunSetting: 'sensor.sun_next_setting',
  zone: 'zone.home',
  tadoMode: 'sensor.thuis_tado_mode',
  geofencingMode: 'sensor.thuis_geofencing_mode',
  automaticGeofencing: 'sensor.thuis_automatic_geofencing',
  solar: 'sensor.thuis_solar_percentage',
  fan: 'switch.ventilator_socket_1',
  bathroomHeatScript: 'script.badkamer_verwarmen',
  windowAutomation: 'automation.verwarming_uit_bij_raam_open',
};

export const DOOR_SENSORS = [
  { entity: 'binary_sensor.myggbett_door_window_sensor_door', battery: 'sensor.myggbett_door_window_sensor_battery', defaultLabel: 'Living raam', kind: 'window' },
  { entity: 'binary_sensor.myggbett_door_window_sensor_door_2', battery: 'sensor.myggbett_door_window_sensor_battery_2', defaultLabel: 'Badkamerdeur', kind: 'door' },
];

export const LIGHTS = [
  { entity: 'light.bedroom_govee_vloerlamp', name: 'Govee vloerlamp', room: 'Slaapkamer', sceneSelect: null },
  { entity: 'light.uplighter_floor_lamp', name: 'Uplighter', room: 'Slaapkamer', sceneSelect: 'select.uplighter_floor_lamp_scene' },
];

export const MEDIA = {
  tvPower: 'media_player.slaapkamer_bert_tv',
  tvRemote: 'remote.55mled810_12_remote',
  chromecast: 'media_player.chromecast_hd',
  chromecastRemote: 'remote.chromecast_hd',
  tvActive: 'input_boolean.tv_actief',
  stereo: 'media_player.living_room_stereo',
  stereoActive: 'input_boolean.stereo_actief',
  stereoSleepTimer: 'select.living_room_stereo_sleep_timer',
  soundbarOn: 'input_boolean.soundbar_aan',
  soundbarPower: 'scene.soundbar_power',
  soundbarVolumeUp: 'scene.soundbar_volume_up',
  soundbarVolumeDown: 'scene.soundbar_volume_down',
  soundbarMute: 'scene.soundbar_mute',
  soundbarInput: 'scene.soundbar_input_toggle',
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

export const DEFAULT_RADIOS = [
  { id: 'vrtnws', name: 'VRT NWS', url: 'http://icecast.vrtcdn.be/vrtnws-high.mp3' },
  { id: 'stubru', name: 'Studio Brussel', url: 'http://icecast.vrtcdn.be/stubru-high.mp3' },
  { id: 'mnm', name: 'MNM', url: 'http://icecast.vrtcdn.be/mnm-high.mp3' },
  { id: 'radio1', name: 'Radio 1', url: 'http://icecast.vrtcdn.be/radio1-high.mp3' },
  { id: 'radio2', name: 'Radio 2', url: 'http://icecast.vrtcdn.be/ra2ant-high.mp3' },
];

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

export const ALL_OFF = {
  lights: LIGHTS.map((l) => l.entity),
  chromecast: 'media_player.chromecast_hd',
  fan: 'switch.ventilator_socket_1',
  climates: ROOMS.map((r) => r.climate),
};

export const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'klimaat', label: 'Klimaat', icon: 'thermostat' },
  { id: 'verlichting', label: 'Verlichting', icon: 'lightbulb' },
  { id: 'media', label: 'Media', icon: 'television' },
  { id: 'auto', label: 'Auto', icon: 'car' },
  { id: 'agenda', label: 'Agenda & Lijsten', short: 'Agenda', icon: 'calendar' },
  { id: 'personen', label: 'Personen', icon: 'account' },
  { id: 'systeem', label: 'Systeem', icon: 'cog' },
  { id: 'grafieken', label: 'Grafieken', icon: 'chart' },
];

export const ACCENTS = [
  { key: 'blauw', label: 'Blauw', color: '#3b82f6' },
  { key: 'groen', label: 'Groen', color: '#22c55e' },
  { key: 'roze', label: 'Roze', color: '#ec4899' },
];

// Entities never exposed to the UI
export const EXCLUDED_ENTITY_PATTERNS = [
  /^media_player\.undefined_undefined_/,
  /^light\.h60b0$/,
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

export const DEFAULT_COMFORT = { living: 21, slaapkamer: 19, badkamer: 22 };

export const DEFAULT_PRESETS = [
  {
    id: 'avond', name: 'Avond', icon: 'weatherSunset',
    lights: {
      'light.bedroom_govee_vloerlamp': { on: true, brightness: 60, colorTemp: 2700 },
      'light.uplighter_floor_lamp': { on: true, brightness: 40, rgb: [255, 140, 60] },
    },
  },
  {
    id: 'lezen', name: 'Lezen', icon: 'book',
    lights: {
      'light.bedroom_govee_vloerlamp': { on: true, brightness: 100, colorTemp: 4000 },
      'light.uplighter_floor_lamp': { on: true, brightness: 70, colorTemp: 4000 },
    },
  },
  {
    id: 'nacht', name: 'Nacht', icon: 'weatherNight',
    lights: {
      'light.bedroom_govee_vloerlamp': { on: true, brightness: 5, colorTemp: 2200 },
      'light.uplighter_floor_lamp': { on: false },
    },
  },
  {
    id: 'uit', name: 'Uit', icon: 'power',
    lights: {
      'light.bedroom_govee_vloerlamp': { on: false },
      'light.uplighter_floor_lamp': { on: false },
    },
  },
];

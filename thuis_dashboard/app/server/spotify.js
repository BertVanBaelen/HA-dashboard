import { MEDIA } from '../shared/config.js';

const ID_RE = /^[A-Za-z0-9]{10,40}$/;
const URI_RE = /^spotify:(track|album|artist|playlist|show|episode):([A-Za-z0-9]{10,40})$/;
const DEVICE_TTL_MS = 10 * 60e3;
const LIBRARY_KINDS = ['playlists', 'albums', 'artists', 'tracks', 'recent', 'shows'];

const img = (o) =>
  o?.image_url || o?.images?.[0]?.url || o?.album?.image_url || o?.album?.images?.[0]?.url || o?.show?.image_url || o?.show?.images?.[0]?.url || null;
const names = (arr) => (arr ?? []).map((a) => a?.name).filter(Boolean).join(', ');
// Saved/recent wrappers ({ added_at, track }) hold the real object one level down
const unwrap = (x) => (x && ('added_at' in x || 'played_at' in x) ? x.track ?? x.album ?? x.show ?? x.episode ?? x.audiobook ?? x : x);

/** Flattens a SpotifyPlus (spotifywebapipython) object into what the UI needs. */
export function normalize(raw) {
  const o = unwrap(raw);
  if (!o?.uri || typeof o.uri !== 'string') return null;
  const type = o.type ?? o.uri.split(':')[1];
  const sub =
    type === 'track' || type === 'album' ? names(o.artists)
    : type === 'playlist' ? o.owner?.display_name ?? ''
    : type === 'artist' ? 'Artiest'
    : type === 'show' ? o.publisher ?? 'Podcast'
    : type === 'episode' ? o.show?.name ?? o.release_date ?? ''
    : '';
  return {
    type,
    id: o.id ?? o.uri.split(':').pop(),
    uri: o.uri,
    name: o.name ?? '',
    sub,
    image: img(o),
    durationMs: o.duration_ms ?? null,
    explicit: !!o.explicit,
  };
}

function list(items) {
  const seen = new Set();
  const out = [];
  for (const it of items ?? []) {
    const n = normalize(it);
    if (n && !seen.has(n.uri)) {
      seen.add(n.uri);
      out.push(n);
    }
  }
  return out;
}

function parseUri(uri) {
  const m = typeof uri === 'string' && uri.match(URI_RE);
  if (!m) throw new Error('Ongeldige Spotify-link');
  return { type: m[1], id: m[2] };
}

const sameDevice = (name) => !!name && name.toLowerCase().includes(MEDIA.spotify.device.toLowerCase());

const isSpotifyPlus = (id, s) => id.startsWith('media_player.') && !!s?.attributes && 'sp_user_id' in s.attributes;

/** All SpotifyPlus players (one per signed-in Spotify account). */
export function spotifyEntities(ha) {
  const out = [];
  for (const [id, s] of ha.states) if (isSpotifyPlus(id, s)) out.push(id);
  return out.sort();
}

/** Account for a user: their chosen player if it still exists, else the configured one, else the first found. */
export function resolveSpotifyEntity(ha, preferred) {
  if (preferred && isSpotifyPlus(preferred, ha.getState(preferred))) return preferred;
  if (MEDIA.spotify.entity) return MEDIA.spotify.entity;
  return spotifyEntities(ha)[0] ?? null;
}

/**
 * Spotify via the SpotifyPlus integration. Playback always targets the configured
 * Spotify Connect device (the stereo), after the stereo is switched on.
 */
export class Spotify {
  /** @param {{ ha: any, entity: string, log?: any, prepareStereo: () => Promise<void> }} opts */
  constructor({ ha, entity, log = console, prepareStereo }) {
    this.ha = ha;
    this.entity = entity;
    this.log = log;
    this.prepareStereo = prepareStereo;
    this.device = null;
  }

  entityId() {
    if (this.entity && this.ha.getState(this.entity)) return this.entity;
    throw new Error('SpotifyPlus-speler niet gevonden. Is de integratie SpotifyPlus geïnstalleerd en aangemeld?');
  }

  state() {
    return this.ha.getState(this.entityId());
  }

  async #svc(service, data = {}, response = false) {
    const res = await this.ha.callService('spotifyplus', service, { entity_id: this.entityId(), ...data }, undefined, response);
    return response ? res?.response?.result ?? null : null;
  }

  #mp(service, data = {}) {
    return this.ha.callService('media_player', service, data, { entity_id: this.entityId() });
  }

  async devices() {
    const res = await this.#svc('get_spotify_connect_devices', { refresh: true }, true);
    return (res?.Items ?? []).map((d) => ({ id: d.Id, name: d.Name, active: !!d.IsActiveDevice }));
  }

  /** Spotify Connect id of the stereo; falls back to its name (SpotifyPlus resolves names too). */
  async #outputDevice() {
    if (this.device && Date.now() - this.device.at < DEVICE_TTL_MS) return this.device;
    const want = MEDIA.spotify.device.toLowerCase();
    let seen = [];
    try {
      const devs = await this.devices();
      seen = devs.map((d) => d.name);
      const hit = devs.find((d) => d.name?.toLowerCase() === want) ?? devs.find((d) => d.name?.toLowerCase().includes(want));
      if (hit) {
        this.device = { id: hit.id, name: hit.name, found: true, seen, at: Date.now() };
        return this.device;
      }
    } catch (err) {
      this.log.warn?.('[spotify] device list failed', err.message);
    }
    return { id: MEDIA.spotify.device, name: MEDIA.spotify.device, found: false, seen, at: 0 };
  }

  /** Switches the stereo on and runs `fn` with the stereo's device id; clearer error when the stereo isn't visible in Spotify. */
  async #onStereo(fn) {
    await this.prepareStereo();
    const dev = await this.#outputDevice();
    try {
      return await fn(dev.id);
    } catch (err) {
      this.device = null;
      if (!dev.found) {
        const others = dev.seen.length ? ` Gevonden: ${dev.seen.join(', ')}.` : '';
        throw new Error(`Spotify-toestel "${MEDIA.spotify.device}" niet gevonden.${others}`);
      }
      throw err;
    }
  }

  // ---- Browsing ------------------------------------------------------------

  async library(kind) {
    if (!LIBRARY_KINDS.includes(kind)) throw new Error('Onbekende bibliotheek');
    const r = await {
      playlists: () => this.#svc('get_playlist_favorites', { limit_total: 200 }, true),
      albums: () => this.#svc('get_album_favorites', { limit_total: 200 }, true),
      artists: () => this.#svc('get_artists_followed', { limit_total: 200 }, true),
      tracks: () => this.#svc('get_track_favorites', { limit_total: 200, sort_result: false }, true),
      recent: () => this.#svc('get_player_recent_tracks', { limit: 50 }, true),
      shows: () => this.#svc('get_show_favorites', { limit_total: 50, exclude_audiobooks: true }, true),
    }[kind]();
    return list(r?.items);
  }

  async search(query) {
    const criteria = String(query ?? '').trim().slice(0, 100);
    if (!criteria) return { tracks: [], artists: [], albums: [], playlists: [] };
    const r = await this.#svc('search_all', { criteria, criteria_type: 'track,artist,album,playlist', limit_total: 12 }, true);
    return {
      tracks: list(r?.tracks?.items),
      artists: list(r?.artists?.items),
      albums: list(r?.albums?.items),
      playlists: list(r?.playlists?.items),
    };
  }

  /** Contents of an album, playlist, artist or podcast. */
  async open(uri) {
    const { type, id } = parseUri(uri);
    if (type === 'playlist') return { tracks: list((await this.#svc('get_playlist_items', { playlist_id: id, limit_total: 200 }, true))?.items) };
    if (type === 'album') return { tracks: list((await this.#svc('get_album_tracks', { album_id: id, limit_total: 100 }, true))?.items) };
    if (type === 'show') return { tracks: list((await this.#svc('get_show_episodes', { show_id: id, limit_total: 50 }, true))?.items) };
    if (type === 'artist') {
      const [top, albums] = await Promise.all([
        this.#svc('get_artist_top_tracks', { artist_id: id, sort_result: false }, true),
        this.#svc('get_artist_albums', { artist_id: id, include_groups: 'album,single', limit_total: 50, sort_result: false }, true).catch(() => null),
      ]);
      return { tracks: list(Array.isArray(top) ? top : top?.items), albums: list(albums?.items) };
    }
    throw new Error('Kan dit niet openen');
  }

  async queueInfo() {
    const r = await this.#svc('get_player_queue_info', {}, true);
    return { current: normalize(r?.currently_playing), queue: list(r?.queue).slice(0, 30) };
  }

  async isLiked(id) {
    if (!ID_RE.test(String(id))) return false;
    const r = await this.#svc('check_track_favorites', { ids: id }, true);
    return !!r?.[id];
  }

  // ---- Playback ------------------------------------------------------------

  /**
   * Plays on the stereo. `uri`: track/episode or a container; `contextUri`: album/playlist/show the
   * track belongs to; `uris`: explicit track list (artist top tracks); `liked`: the liked-songs list.
   */
  async play({ uri, contextUri, uris, liked, shuffle } = {}) {
    const sh = typeof shuffle === 'boolean' ? { shuffle } : {};
    if (liked) return this.#onStereo((device_id) => this.#svc('player_media_play_track_favorites', { device_id, limit_total: 200, ...sh }));
    if (Array.isArray(uris) && uris.length) {
      const clean = uris.slice(0, 100);
      clean.forEach(parseUri);
      return this.#onStereo((device_id) => this.#svc('player_media_play_tracks', { uris: clean.join(','), device_id, ...sh }));
    }
    const item = parseUri(uri);
    if (contextUri) {
      const ctx = parseUri(contextUri);
      if (ctx.type === 'artist') throw new Error('Gebruik een lijst nummers voor een artiest');
      return this.#onStereo((device_id) => this.#svc('player_media_play_context', { context_uri: contextUri, offset_uri: uri, device_id, ...sh }));
    }
    if (item.type === 'track' || item.type === 'episode') return this.#onStereo((device_id) => this.#svc('player_media_play_tracks', { uris: uri, device_id }));
    return this.#onStereo((device_id) => this.#svc('player_media_play_context', { context_uri: uri, device_id, ...sh }));
  }

  /** Moves the current Spotify session to the stereo (and keeps it playing when `play`). */
  async transfer(play = true) {
    return this.#onStereo((device_id) => this.#svc('player_transfer_playback', { device_id, play }));
  }

  /** Called when the stereo is switched to its Spotify input: pull a session that plays elsewhere to the stereo. */
  async claim() {
    const s = this.state();
    if (!s || sameDevice(s.attributes?.sp_device_name)) return;
    if (s.state !== 'playing') return;
    await this.transfer(true);
  }

  async control(cmd, value) {
    const s = this.state();
    const onStereo = sameDevice(s?.attributes?.sp_device_name);
    switch (cmd) {
      case 'play':
        if (onStereo && s?.state === 'paused') return this.#mp('media_play');
        return this.transfer(true);
      case 'pause': return this.#mp('media_pause');
      case 'next': return this.#mp('media_next_track');
      case 'previous': return this.#mp('media_previous_track');
      case 'seek': return this.#mp('media_seek', { seek_position: Math.max(0, Number(value) || 0) });
      case 'shuffle': return this.#mp('shuffle_set', { shuffle: !!value });
      case 'repeat': {
        if (!['off', 'all', 'one'].includes(value)) throw new Error('Ongeldige herhaalstand');
        return this.#mp('repeat_set', { repeat: value });
      }
      case 'volume': return this.#mp('volume_set', { volume_level: Math.min(1, Math.max(0, Number(value) || 0)) });
      case 'transfer': return this.transfer(true);
      default: throw new Error(`Onbekende Spotify-opdracht ${cmd}`);
    }
  }

  async addToQueue(uri) {
    const { type } = parseUri(uri);
    if (type !== 'track' && type !== 'episode') throw new Error('Enkel nummers kunnen in de wachtrij');
    await this.#svc('add_player_queue_items', { uris: uri });
  }

  async setLiked(id, liked) {
    if (!ID_RE.test(String(id))) throw new Error('Ongeldig nummer');
    await this.#svc(liked ? 'save_track_favorites' : 'remove_track_favorites', { ids: id });
  }

  /** Single entry point for the UI. */
  async run(op, args = {}) {
    switch (op) {
      case 'library': return this.library(args.kind);
      case 'search': return this.search(args.query);
      case 'open': return this.open(args.uri);
      case 'queue': return this.queueInfo();
      case 'isLiked': return this.isLiked(args.id);
      case 'devices': return this.devices();
      case 'play': return this.play(args);
      case 'control': return this.control(args.cmd, args.value);
      case 'addToQueue': return this.addToQueue(args.uri);
      case 'setLiked': return this.setLiked(args.id, !!args.liked);
      default: throw new Error(`Onbekende Spotify-actie ${op}`);
    }
  }
}

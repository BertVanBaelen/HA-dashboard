import { EventEmitter } from 'node:events';

const REGISTRY_EVENTS = ['area_registry_updated', 'device_registry_updated', 'entity_registry_updated', 'label_registry_updated'];
const OPEN = 1;

const TIMING = {
  connectTimeout: 10000, // handshake must complete within this time
  authTimeout: 10000, // auth_ok must follow the handshake within this time
  retryMin: 1000,
  retryMax: 30000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  requestTimeout: 60000,
};

/**
 * Minimal Home Assistant WebSocket client with auto-reconnect.
 * Emits: 'ready', 'disconnected', 'state' (entityId, newState|null), 'states' (Map), 'registries' ({ areas, devices, entities, labels })
 */
export class HaClient extends EventEmitter {
  /** `WebSocketImpl` and `timing` only need to be passed by tests. */
  constructor({ url, token, log = console, WebSocketImpl = globalThis.WebSocket, timing = {} }) {
    super();
    this.registries = { areas: [], devices: [], entities: [], labels: [] };
    this.url = url;
    this.token = token;
    this.log = log;
    this.WebSocketImpl = WebSocketImpl;
    this.timing = { ...TIMING, ...timing };
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.subscriptions = new Map(); // local key -> { msg, cb, remoteId }
    this.states = new Map();
    this.connected = false;
    this.retryMs = this.timing.retryMin;
    this.attempt = 0;
    this.reconnectTimer = null;
    this.setupTimer = null;
    this.heartbeatTimer = null;
    this.stopped = false;
  }

  start() {
    for (const ev of REGISTRY_EVENTS) this.subscribeEvents(ev, () => this.#scheduleRegistries());
    this.#connect();
  }

  /** Closes the connection for good (no reconnects). */
  stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.regTimer);
    this.reconnectTimer = null;
    if (this.ws) this.#drop(this.ws, 'stopped');
  }

  #scheduleRegistries() {
    clearTimeout(this.regTimer);
    this.regTimer = setTimeout(() => this.fetchRegistries().then((r) => this.emit('registries', r)).catch((e) => this.log.warn?.('[ha] registries failed', e.message)), 500);
  }

  async fetchRegistries() {
    const [areas, devices, entities, labels] = await Promise.all(
      ['area', 'device', 'entity', 'label'].map((k) => this.send({ type: `config/${k}_registry/list` }).catch((e) => {
        this.log.warn?.(`[ha] ${k} registry failed`, e.message);
        return [];
      })),
    );
    this.registries = { areas: areas ?? [], devices: devices ?? [], entities: entities ?? [], labels: labels ?? [] };
    return this.registries;
  }

  #connect() {
    this.reconnectTimer = null;
    if (this.stopped) return;
    if (++this.attempt === 1) this.log.info?.(`[ha] connecting to ${this.url}`);
    let ws;
    try {
      ws = new this.WebSocketImpl(this.url);
    } catch (err) {
      this.log.error?.('[ha] connect failed', err.message);
      return this.#scheduleReconnect();
    }
    this.ws = ws;
    this.setupTimer = setTimeout(() => this.#drop(ws, 'connect timeout'), this.timing.connectTimeout);
    ws.addEventListener('open', () => {
      if (this.ws !== ws) return;
      clearTimeout(this.setupTimer);
      this.setupTimer = setTimeout(() => this.#drop(ws, 'no auth_ok'), this.timing.authTimeout);
    });
    ws.addEventListener('message', (ev) => this.#onRaw(ws, ev.data));
    // Node's WebSocket only fires 'error' (no 'close') when the handshake fails, e.g. while HA restarts.
    ws.addEventListener('error', (ev) => this.#drop(ws, ev?.message || 'socket error'));
    ws.addEventListener('close', (ev) => this.#drop(ws, `closed${ev?.code ? ` ${ev.code}` : ''}`));
  }

  #scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return 0;
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, this.timing.retryMax);
    this.reconnectTimer = setTimeout(() => this.#connect(), delay);
    return delay;
  }

  /** Single exit path for a socket (error, close, timeouts, failed init, missed heartbeat). Ignores stale sockets. */
  #drop(ws, reason) {
    if (this.ws !== ws) return;
    this.ws = null;
    clearTimeout(this.setupTimer);
    clearInterval(this.heartbeatTimer);
    try {
      ws.close();
    } catch {
      /* already closing */
    }
    const wasConnected = this.connected;
    this.connected = false;
    for (const { reject } of this.pending.values()) reject(new Error('Verbinding met Home Assistant verbroken'));
    this.pending.clear();
    for (const sub of this.subscriptions.values()) sub.remoteId = null;
    if (!this.stopped) {
      const delay = this.#scheduleReconnect();
      if (wasConnected) this.log.warn?.(`[ha] disconnected (${reason}), reconnecting`);
      else this.log.warn?.(`[ha] connection attempt ${this.attempt} failed (${reason}), retrying in ${delay / 1000} s`);
    }
    if (wasConnected) this.#emitSafe('disconnected');
  }

  #emitSafe(event, ...args) {
    try {
      this.emit(event, ...args);
    } catch (err) {
      this.log.error?.(`[ha] '${event}' handler failed`, err);
    }
  }

  #onRaw(ws, data) {
    if (this.ws !== ws) return;
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (err) {
      this.log.warn?.('[ha] ignoring invalid message', err.message);
      return;
    }
    try {
      this.#onMessage(ws, msg);
    } catch (err) {
      this.log.error?.('[ha] message handling failed', err);
    }
  }

  #onMessage(ws, msg) {
    switch (msg?.type) {
      case 'auth_required':
        ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
        break;
      case 'auth_ok':
        clearTimeout(this.setupTimer);
        this.log.info?.(`[ha] authenticated (HA ${msg.ha_version})`);
        this.connected = true;
        this.attempt = 0;
        this.#onReady(ws);
        break;
      case 'auth_invalid':
        // HA closes the socket itself; the normal backoff keeps us from hammering it with a bad token.
        this.log.error?.('[ha] auth invalid', msg.message);
        this.#drop(ws, 'auth invalid');
        break;
      case 'result':
      case 'pong': {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.type === 'pong' || msg.success) p.resolve(msg.result);
        else p.reject(Object.assign(new Error(msg.error?.message ?? 'Onbekende fout'), { code: msg.error?.code }));
        break;
      }
      case 'event': {
        for (const sub of this.subscriptions.values()) {
          if (sub.remoteId !== msg.id) continue;
          try {
            sub.cb(msg.event);
          } catch (err) {
            this.log.error?.('[ha] event handler failed', err);
          }
        }
        break;
      }
    }
  }

  async #onReady(ws) {
    try {
      const states = await this.send({ type: 'get_states' });
      this.states = new Map(states.map((s) => [s.entity_id, s]));
      const registries = await this.fetchRegistries();
      this.#emitSafe('states', this.states);
      this.#emitSafe('registries', registries);
      if (!this.subscriptions.has('__state_changed')) {
        this.subscriptions.set('__state_changed', {
          msg: { type: 'subscribe_events', event_type: 'state_changed' },
          cb: (event) => {
            const { entity_id, new_state } = event.data;
            if (new_state) this.states.set(entity_id, new_state);
            else this.states.delete(entity_id);
            this.emit('state', entity_id, new_state ?? null);
          },
          remoteId: null,
        });
      }
      for (const sub of this.subscriptions.values()) {
        if (sub.remoteId != null) continue; // subscribed by subscribeEvents() while this init was running
        const id = this.nextId++;
        sub.remoteId = id;
        await this.#sendWithId(id, sub.msg);
      }
      this.retryMs = this.timing.retryMin;
      this.#startHeartbeat(ws);
      this.#emitSafe('ready');
    } catch (err) {
      if (this.ws !== ws) return; // dropped meanwhile, reconnect already scheduled
      this.log.error?.('[ha] init failed', err.message);
      this.#drop(ws, 'init failed');
    }
  }

  /** Detects half-open sockets: no pong in time means the connection is dead. */
  #startHeartbeat(ws) {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' }, this.timing.heartbeatTimeout).catch((err) => this.#drop(ws, `heartbeat failed: ${err.message}`));
    }, this.timing.heartbeatInterval);
  }

  #sendWithId(id, msg, timeout = this.timing.requestTimeout) {
    return new Promise((resolve, reject) => {
      const ws = this.ws;
      if (!this.connected || ws?.readyState !== OPEN) {
        return reject(new Error('Niet verbonden met Home Assistant'));
      }
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error('Time-out van Home Assistant'));
      }, timeout);
      this.pending.set(id, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      try {
        ws.send(JSON.stringify({ ...msg, id }));
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  send(msg, timeout) {
    return this.#sendWithId(this.nextId++, msg, timeout);
  }

  /** Persistent subscription, re-established after reconnect. */
  subscribeEvents(eventType, cb) {
    const key = `ev:${eventType}:${this.nextId++}`;
    const sub = { msg: { type: 'subscribe_events', event_type: eventType }, cb, remoteId: null };
    this.subscriptions.set(key, sub);
    if (this.connected) {
      const id = this.nextId++;
      sub.remoteId = id;
      this.#sendWithId(id, sub.msg).catch((e) => this.log.warn?.('[ha] subscribe failed', e.message));
    }
    return key;
  }

  callService(domain, service, serviceData = {}, target, returnResponse = false) {
    const msg = { type: 'call_service', domain, service, service_data: serviceData };
    if (target) msg.target = target;
    if (returnResponse) msg.return_response = true;
    return this.send(msg, domain === 'update' ? 30 * 60e3 : undefined);
  }

  getState(entityId) {
    return this.states.get(entityId) ?? null;
  }
}

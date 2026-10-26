import { EventEmitter } from 'node:events';

const REGISTRY_EVENTS = ['area_registry_updated', 'device_registry_updated', 'entity_registry_updated', 'label_registry_updated'];

/**
 * Minimal Home Assistant WebSocket client with auto-reconnect.
 * Emits: 'ready', 'disconnected', 'state' (entityId, newState|null), 'states' (Map), 'registries' ({ areas, devices, entities, labels })
 */
export class HaClient extends EventEmitter {
  constructor({ url, token, log = console }) {
    super();
    this.registries = { areas: [], devices: [], entities: [], labels: [] };
    this.url = url;
    this.token = token;
    this.log = log;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.subscriptions = new Map(); // local key -> { msg, cb, remoteId }
    this.states = new Map();
    this.connected = false;
    this.retryMs = 1000;
  }

  start() {
    for (const ev of REGISTRY_EVENTS) this.subscribeEvents(ev, () => this.#scheduleRegistries());
    this.#connect();
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
    this.log.info?.(`[ha] connecting to ${this.url}`);
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      this.log.error?.('[ha] connect failed', err);
      return this.#scheduleReconnect();
    }
    this.ws = ws;
    ws.addEventListener('message', (ev) => this.#onMessage(JSON.parse(ev.data)));
    ws.addEventListener('close', () => this.#onClose());
    ws.addEventListener('error', (ev) => this.log.warn?.('[ha] socket error', ev?.message ?? ''));
  }

  #scheduleReconnect() {
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, 30000);
    setTimeout(() => this.#connect(), delay);
  }

  #onClose() {
    const wasConnected = this.connected;
    this.connected = false;
    for (const { reject } of this.pending.values()) reject(new Error('Verbinding met Home Assistant verbroken'));
    this.pending.clear();
    for (const sub of this.subscriptions.values()) sub.remoteId = null;
    if (wasConnected) this.emit('disconnected');
    this.log.warn?.('[ha] disconnected, reconnecting');
    this.#scheduleReconnect();
  }

  async #onMessage(msg) {
    switch (msg.type) {
      case 'auth_required':
        this.ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
        break;
      case 'auth_ok':
        this.log.info?.(`[ha] authenticated (HA ${msg.ha_version})`);
        this.connected = true;
        this.retryMs = 1000;
        await this.#onReady();
        break;
      case 'auth_invalid':
        this.log.error?.('[ha] auth invalid', msg.message);
        break;
      case 'result': {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.success) p.resolve(msg.result);
        else p.reject(Object.assign(new Error(msg.error?.message ?? 'Onbekende fout'), { code: msg.error?.code }));
        break;
      }
      case 'event': {
        for (const sub of this.subscriptions.values()) {
          if (sub.remoteId === msg.id) sub.cb(msg.event);
        }
        break;
      }
    }
  }

  async #onReady() {
    try {
      const states = await this.send({ type: 'get_states' });
      this.states = new Map(states.map((s) => [s.entity_id, s]));
      const registries = await this.fetchRegistries();
      this.emit('states', this.states);
      this.emit('registries', registries);
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
        const id = this.nextId++;
        sub.remoteId = id;
        await this.#sendWithId(id, sub.msg);
      }
      this.emit('ready');
    } catch (err) {
      this.log.error?.('[ha] init failed', err);
    }
  }

  #sendWithId(id, msg, timeout = 60000) {
    return new Promise((resolve, reject) => {
      if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
        return reject(new Error('Niet verbonden met Home Assistant'));
      }
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...msg, id }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Time-out van Home Assistant'));
        }
      }, timeout);
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

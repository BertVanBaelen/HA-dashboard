import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { HaClient } from '../server/ha.js';

const quiet = { info() {}, warn() {}, error() {} };
const FAST = { connectTimeout: 300, authTimeout: 300, retryMin: 20, retryMax: 100, heartbeatInterval: 60000, heartbeatTimeout: 200 };
const TOKEN = 'secret';
const BaseWebSocket = globalThis.WebSocket ?? WsWebSocket;
const within = (ms = 3000) => ({ signal: AbortSignal.timeout(ms) });

/** Behaves like Node's WebSocket on a failed handshake: an 'error' event and never a 'close'. */
class ErrorOnlyWebSocket extends BaseWebSocket {
  constructor(url) {
    super(url);
    this.opened = false;
    super.addEventListener('open', () => (this.opened = true));
  }

  addEventListener(type, fn, opts) {
    if (type !== 'close') return super.addEventListener(type, fn, opts);
    return super.addEventListener(type, (ev) => this.opened && fn(ev), opts);
  }
}

/** Tiny fake of the HA websocket API. `mode`: 'up', 'down' (502 like the supervisor while HA restarts) or 'hang'. */
async function fakeHa() {
  const server = http.createServer((req, res) => res.writeHead(404).end());
  const wss = new WebSocketServer({ noServer: true });
  const ha = { mode: 'up', connections: 0, rejected: 0, hung: [], subscriptions: [], answerPings: true };
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    if (ha.mode === 'down') {
      ha.rejected++;
      return socket.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
    }
    if (ha.mode === 'hang') return ha.hung.push(socket);
    wss.handleUpgrade(req, socket, head, (ws) => {
      ha.connections++;
      ws.send(JSON.stringify({ type: 'auth_required' }));
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        const reply = (m) => ws.send(JSON.stringify({ id: msg.id, ...m }));
        if (msg.type === 'auth') {
          return ws.send(JSON.stringify(msg.access_token === TOKEN ? { type: 'auth_ok', ha_version: 'test' } : { type: 'auth_invalid', message: 'Invalid access' }));
        }
        if (msg.type === 'ping') return ha.answerPings && reply({ type: 'pong' });
        if (msg.type === 'get_states') return reply({ type: 'result', success: true, result: [{ entity_id: 'light.a', state: 'on' }] });
        if (msg.type === 'subscribe_events') ha.subscriptions.push({ ws, id: msg.id, eventType: msg.event_type });
        reply({ type: 'result', success: true, result: msg.type.endsWith('/list') ? [] : null });
      });
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  ha.url = `ws://127.0.0.1:${server.address().port}/api/websocket`;
  ha.fire = (eventType, data) => {
    for (const s of ha.subscriptions) {
      if (s.eventType === eventType && s.ws.readyState === s.ws.OPEN) s.ws.send(JSON.stringify({ id: s.id, type: 'event', event: { event_type: eventType, data } }));
    }
  };
  ha.dropAll = () => {
    for (const ws of wss.clients) ws.terminate();
  };
  ha.close = () => {
    ha.dropAll();
    for (const s of ha.hung) s.destroy();
    server.closeAllConnections?.();
    return new Promise((resolve) => server.close(resolve));
  };
  return ha;
}

async function waitFor(cond, ms = 3000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function setup(t, opts = {}) {
  const srv = await fakeHa();
  const client = new HaClient({ url: srv.url, token: TOKEN, log: quiet, timing: FAST, ...opts });
  t.after(() => {
    client.stop?.();
    return srv.close();
  });
  return { srv, client };
}

test('keeps retrying when the handshake fails without a close event, then connects', async (t) => {
  const { srv, client } = await setup(t, { WebSocketImpl: ErrorOnlyWebSocket });
  srv.mode = 'down';
  client.start();
  await waitFor(() => srv.rejected >= 3);
  assert.equal(client.connected, false);
  const ready = once(client, 'ready', within());
  srv.mode = 'up';
  await ready;
  assert.equal(client.connected, true);
  assert.equal(client.getState('light.a')?.state, 'on');
});

test('re-establishes subscriptions after an established connection drops', async (t) => {
  const { srv, client } = await setup(t);
  const events = [];
  let disconnects = 0;
  client.subscribeEvents('custom_event', (e) => events.push(e.data));
  client.on('disconnected', () => disconnects++);
  client.start();
  await once(client, 'ready', within());
  const subscribed = srv.subscriptions.map((s) => s.eventType).sort();
  assert.ok(subscribed.includes('state_changed') && subscribed.includes('custom_event'));
  srv.fire('custom_event', { n: 1 });
  await waitFor(() => events.length === 1);

  srv.subscriptions.length = 0;
  const ready = once(client, 'ready', within());
  srv.dropAll();
  await ready;
  assert.equal(disconnects, 1);
  assert.equal(srv.connections, 2);
  assert.deepEqual(srv.subscriptions.map((s) => s.eventType).sort(), subscribed);
  srv.fire('custom_event', { n: 2 });
  await waitFor(() => events.length === 2);
  assert.deepEqual(events, [{ n: 1 }, { n: 2 }]);
});

test('replaces a connection that stops answering heartbeats', async (t) => {
  const { srv, client } = await setup(t, { timing: { ...FAST, heartbeatInterval: 50, heartbeatTimeout: 100 } });
  client.start();
  await once(client, 'ready', within());
  srv.answerPings = false;
  await once(client, 'disconnected', within());
  assert.equal(client.connected, false);
  srv.answerPings = true;
  await once(client, 'ready', within());
  assert.equal(srv.connections, 2);
});

test('retries a handshake that never completes', async (t) => {
  const { srv, client } = await setup(t);
  srv.mode = 'hang';
  client.start();
  await waitFor(() => srv.hung.length >= 2);
  const ready = once(client, 'ready', within());
  srv.mode = 'up';
  await ready;
  assert.equal(client.connected, true);
});

test('backs off instead of hammering HA when the token is refused', async (t) => {
  const { srv, client } = await setup(t, { token: 'wrong' });
  client.start();
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(client.connected, false);
  assert.ok(srv.connections >= 2 && srv.connections <= 12, `${srv.connections} attempts`);
});

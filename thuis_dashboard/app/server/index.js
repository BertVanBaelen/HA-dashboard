import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { HaClient } from './ha.js';
import { MockHaClient, MOCK_USERS } from './mock.js';
import { Store } from './store.js';
import { Actions } from './actions.js';
import { ALLOWED_SERVICES, ALLOWED_WS_COMMANDS, EXCLUDED_ENTITY_PATTERNS } from '../shared/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const MOCK = process.argv.includes('--mock') || process.env.MOCK === '1';
const PORT = Number(process.env.PORT ?? 8099);
const DIST = process.env.DIST_DIR ?? join(here, '..', 'dist');
const DATA_FILE = process.env.DATA_FILE ?? (MOCK ? join(here, '..', '.mock-data', 'preferences.json') : '/data/preferences.json');
const INGRESS_ONLY = !MOCK && process.env.INGRESS_ONLY !== '0';

const log = {
  info: (...a) => console.log(new Date().toISOString(), ...a),
  warn: (...a) => console.warn(new Date().toISOString(), ...a),
  error: (...a) => console.error(new Date().toISOString(), ...a),
};

const isExcluded = (id) => EXCLUDED_ENTITY_PATTERNS.some((re) => re.test(id));

const ha = MOCK
  ? new MockHaClient({ log })
  : new HaClient({
      url: process.env.HA_URL ?? 'ws://supervisor/core/websocket',
      token: process.env.HA_TOKEN ?? process.env.SUPERVISOR_TOKEN,
      log,
    });
const store = new Store(DATA_FILE, log);
const actions = new Actions({ ha, store, log });

// ---- Static files ----------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (path.includes('..')) path = '';
  let file = join(DIST, path || 'index.html');
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    const ext = extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

function remoteAllowed(req) {
  if (!INGRESS_ONLY) return true;
  const ip = req.socket.remoteAddress?.replace('::ffff:', '');
  return ip === '172.30.32.2' || ip === '127.0.0.1';
}

const server = http.createServer(async (req, res) => {
  if (!remoteAllowed(req)) return res.writeHead(403).end('Forbidden');
  if (req.url === '/healthz') return res.writeHead(200).end('ok');
  await serveStatic(req, res);
});

// ---- WebSocket protocol ----------------------------------------------------

function userFromRequest(req) {
  const h = req.headers;
  if (h['x-remote-user-id']) {
    return {
      id: String(h['x-remote-user-id']),
      name: String(h['x-remote-user-name'] ?? ''),
      displayName: decodeURIComponent(String(h['x-remote-user-display-name'] ?? h['x-remote-user-name'] ?? 'Gebruiker')),
    };
  }
  if (MOCK) {
    const who = new URL(req.url, 'http://x').searchParams.get('user') === 'marjo' ? 'marjo' : 'bert';
    return { id: MOCK_USERS[who], name: who, displayName: who === 'marjo' ? 'Marjo' : 'Bert' };
  }
  return null;
}

function publicStates() {
  const out = {};
  for (const [id, s] of ha.states) if (!isExcluded(id)) out[id] = s;
  return out;
}

const clients = new Set();
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (!remoteAllowed(req) || !new URL(req.url, 'http://x').pathname.endsWith('/ws')) return socket.destroy();
  const user = userFromRequest(req);
  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => onClient(ws, user));
});

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg, filter = () => true) {
  const data = JSON.stringify(msg);
  for (const c of clients) if (filter(c) && c.ws.readyState === c.ws.OPEN) c.ws.send(data);
}

function onClient(ws, user) {
  const client = { ws, user };
  clients.add(client);
  log.info(`[ws] ${user.displayName} connected (${clients.size} client(s))`);
  send(ws, {
    type: 'init',
    user: { ...user, person: actions.personForUser(user.id) },
    prefs: store.getUser(user.id),
    household: store.getHousehold(),
    states: publicStates(),
    haConnected: ha.connected,
    mock: MOCK,
  });
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      const result = await handle(client, msg);
      send(ws, { type: 'result', id: msg.id, ok: true, result: result ?? null });
    } catch (err) {
      send(ws, { type: 'result', id: msg.id, ok: false, error: err.message ?? String(err) });
    }
  });
  ws.on('close', () => clients.delete(client));
}

function checkService(domain, service, target, data) {
  const allowed = ALLOWED_SERVICES[domain];
  if (!allowed?.includes(service)) throw new Error(`Actie ${domain}.${service} is niet toegestaan`);
  const ids = [].concat(target?.entity_id ?? data?.entity_id ?? []);
  for (const id of ids) if (isExcluded(id)) throw new Error(`Entiteit ${id} is niet toegestaan`);
}

async function handle(client, msg) {
  switch (msg.type) {
    case 'call_service': {
      const { domain, service, data = {}, target, return_response } = msg;
      checkService(domain, service, target, data);
      const res = await ha.callService(domain, service, data, target, !!return_response);
      return return_response ? res?.response ?? res : null;
    }
    case 'ws': {
      if (!ALLOWED_WS_COMMANDS.includes(msg.msg?.type)) throw new Error('Commando niet toegestaan');
      return ha.send(msg.msg);
    }
    case 'action':
      return runAction(client, msg.name, msg.args ?? {});
    case 'set_prefs': {
      const prefs = await store.setUser(client.user.id, msg.prefs);
      broadcast({ type: 'prefs', prefs }, (c) => c.user.id === client.user.id);
      return prefs;
    }
    case 'set_household': {
      const household = await store.setHousehold(msg.household);
      broadcast({ type: 'household', household });
      return household;
    }
    case 'ping':
      return 'pong';
    default:
      throw new Error(`Onbekend berichttype ${msg.type}`);
  }
}

async function runAction(client, name, args) {
  switch (name) {
    case 'allesUit': return actions.allesUit();
    case 'welkomThuis': return actions.welkomThuis(client.user.id);
    case 'mediaMode': return actions.mediaMode(args.mode);
    case 'applyPreset': return actions.applyPreset(args.id);
    case 'capturePreset': return actions.capturePreset();
    case 'playRadio': return actions.playRadio(args.url);
    case 'selectStereoSource': return actions.selectStereoSource(args.key);
    case 'heatRoom': return actions.heatRoom(args.room);
    case 'searchRadios': return actions.searchRadios();
    case 'testArrival': {
      const person = actions.personForUser(client.user.id);
      const s = person && ha.getState(person);
      if (!s) throw new Error('Geen persoon gekoppeld aan deze gebruiker');
      actions.lastArrival.delete(client.user.id);
      const prefs = store.getUser(client.user.id);
      if (!prefs.arrivalNotify) throw new Error('Zet eerst de thuiskomst-melding aan');
      await actions.onArrival(person, s);
      return { sent: true };
    }
    default: throw new Error(`Onbekende actie ${name}`);
  }
}

// ---- HA → clients ----------------------------------------------------------

let pending = {};
let flushTimer = null;
ha.on('state', (id, s) => {
  if (isExcluded(id)) return;
  pending[id] = s;
  flushTimer ??= setTimeout(() => {
    broadcast({ type: 'states', changes: pending });
    pending = {};
    flushTimer = null;
  }, 80);
});
ha.on('ready', () => {
  broadcast({ type: 'state_reset', states: publicStates() });
  broadcast({ type: 'ha', connected: true });
});
ha.on('disconnected', () => broadcast({ type: 'ha', connected: false }));

await store.load();
ha.start();
actions.startBackgroundJobs();
server.listen(PORT, () => log.info(`[server] Thuis Dashboard on :${PORT}${MOCK ? ' (MOCK mode)' : ''}`));

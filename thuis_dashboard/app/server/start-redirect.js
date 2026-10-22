// Thuis Dashboard – start redirect card.
// Installed by the Thuis Dashboard app. Use it on a dashboard that is set as
// default dashboard: opening Home Assistant then jumps straight to the app.
class ThuisDashboardRedirect extends HTMLElement {
  setConfig(config) {
    this._config = config ?? {};
  }

  set hass(hass) {
    if (this._done) return;
    const panel = Object.values(hass.panels ?? {}).find((p) => /(^|_)thuis_dashboard$/.test(p.url_path ?? '') || /(^|_)thuis_dashboard$/.test(p.config?.ingress ?? ''));
    if (!panel) {
      this._render('Thuis Dashboard niet gevonden. Is de app gestart en staat “Toon in zijbalk” aan?');
      return;
    }
    this._done = true;
    if (new URLSearchParams(location.search).has('edit')) {
      this._render(`Doorsturen naar <a href="/${panel.url_path}">Thuis Dashboard</a> (uitgeschakeld in bewerkmodus).`);
      return;
    }
    this._render(`Thuis Dashboard openen… <a href="/${panel.url_path}">Open</a>`);
    startGuard(panel.url_path, location.pathname);
    go(panel.url_path);
  }

  _render(html) {
    this.innerHTML = `<ha-card style="padding:24px;text-align:center">${html}</ha-card>`;
  }

  getCardSize() {
    return 1;
  }
}

// HA sometimes finishes its own start-up routing after our redirect and lands on
// the Overview dashboard. For a few seconds after redirecting we bounce back.
const GUARD_KEY = 'thuis-dashboard-redirect';
const GUARD_MS = 8000;

function go(urlPath) {
  history.replaceState(null, '', `/${urlPath}`);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
}

function startGuard(urlPath, fromPath) {
  try {
    sessionStorage.setItem(GUARD_KEY, JSON.stringify({ urlPath, fromPath, until: Date.now() + GUARD_MS, bounces: 0 }));
  } catch { /* private mode */ }
  checkGuard();
}

function readGuard() {
  try {
    const g = JSON.parse(sessionStorage.getItem(GUARD_KEY) ?? 'null');
    return g && g.until > Date.now() ? g : null;
  } catch {
    return null;
  }
}

let guardTimer = null;
function checkGuard() {
  const g = readGuard();
  if (!g) {
    clearInterval(guardTimer);
    guardTimer = null;
    return;
  }
  guardTimer ??= setInterval(checkGuard, 250);
  const p = location.pathname.replace(/\/+$/, '') || '/';
  const bounced = p === '/' || p === '/lovelace' || p.startsWith('/lovelace/') || p === g.fromPath.replace(/\/+$/, '');
  if (!bounced || new URLSearchParams(location.search).has('edit')) return;
  if (g.bounces >= 3) return;
  g.bounces += 1;
  try { sessionStorage.setItem(GUARD_KEY, JSON.stringify(g)); } catch { /* ignore */ }
  go(g.urlPath);
}

window.addEventListener('location-changed', () => setTimeout(checkGuard, 50));
window.addEventListener('popstate', () => setTimeout(checkGuard, 50));
checkGuard();

if (!customElements.get('thuis-dashboard-redirect')) customElements.define('thuis-dashboard-redirect', ThuisDashboardRedirect);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'thuis-dashboard-redirect', name: 'Thuis Dashboard – doorsturen', description: 'Opent meteen het Thuis Dashboard.' });

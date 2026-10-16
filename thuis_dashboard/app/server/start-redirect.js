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
    history.replaceState(null, '', `/${panel.url_path}`);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
  }

  _render(html) {
    this.innerHTML = `<ha-card style="padding:24px;text-align:center">${html}</ha-card>`;
  }

  getCardSize() {
    return 1;
  }
}

if (!customElements.get('thuis-dashboard-redirect')) customElements.define('thuis-dashboard-redirect', ThuisDashboardRedirect);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'thuis-dashboard-redirect', name: 'Thuis Dashboard – doorsturen', description: 'Opent meteen het Thuis Dashboard.' });

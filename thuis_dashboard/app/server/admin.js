import { readFile } from 'node:fs/promises';

const TTL_MS = 5 * 60 * 1000;

/** Decides whether a dashboard user is a Home Assistant administrator. */
export class AdminCheck {
  constructor({ ha, optionsFile = '/data/options.json', log = console }) {
    this.ha = ha;
    this.optionsFile = optionsFile;
    this.log = log;
    this.users = null;
    this.fetchedAt = 0;
  }

  async #authUsers() {
    if (this.users && Date.now() - this.fetchedAt < TTL_MS) return this.users;
    let timer;
    try {
      const list = await Promise.race([this.ha.send({ type: 'config/auth/list' }), new Promise((_, rej) => (timer = setTimeout(() => rej(new Error('timeout')), 4000)))]);
      if (Array.isArray(list)) {
        this.users = list;
        this.fetchedAt = Date.now();
      }
    } catch (err) {
      this.log.warn?.('[admin] config/auth/list failed, using option "admins"', err.message);
    } finally {
      clearTimeout(timer);
    }
    return this.users;
  }

  async #optionAdmins() {
    try {
      const o = JSON.parse(await readFile(this.optionsFile, 'utf8'));
      return (Array.isArray(o.admins) ? o.admins : []).map((n) => String(n).trim().toLowerCase()).filter(Boolean);
    } catch {
      return [];
    }
  }

  async isAdmin(user) {
    if (!user) return false;
    const u = (await this.#authUsers())?.find((x) => x.id === user.id);
    if (u?.group_ids?.includes('system-admin') || u?.is_owner) return true;
    const names = await this.#optionAdmins();
    return [user.name, user.displayName].some((n) => n && names.includes(String(n).trim().toLowerCase()));
  }
}

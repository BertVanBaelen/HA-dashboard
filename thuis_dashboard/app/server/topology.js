import { EventEmitter } from 'node:events';
import { buildTopology, emptyTopology } from '../shared/topology.js';

/** Live room topology from the HA registries. Emits 'change' (topology). */
export class TopologyService extends EventEmitter {
  constructor({ ha, log = console }) {
    super();
    this.ha = ha;
    this.log = log;
    this.registries = null;
    this.value = emptyTopology();
    this.json = JSON.stringify(this.value);
    this.known = new Set();
    ha.on('registries', (r) => {
      this.registries = r;
      this.rebuild();
    });
    ha.on('states', () => this.rebuild());
    ha.on('state', (id, s) => {
      if (s && !this.known.has(id)) this.schedule();
    });
  }

  get() {
    return this.value;
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.rebuild(), 500);
  }

  rebuild() {
    clearTimeout(this.timer);
    if (!this.registries) return;
    this.known = new Set(this.ha.states.keys());
    const next = buildTopology({ ...(this.registries ?? {}), states: this.ha.states });
    const json = JSON.stringify(next);
    if (json === this.json) return;
    this.value = next;
    this.json = json;
    this.log.info?.(`[topology] ${next.areas.length} area(s), ${Object.values(next.rooms).reduce((n, r) => n + r.lights.length, next.unassigned.lights.length)} light(s)`);
    this.emit('change', next);
  }
}

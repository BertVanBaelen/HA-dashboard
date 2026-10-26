import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AdminCheck } from '../server/admin.js';

const quiet = { info() {}, warn() {}, error() {} };
const USERS = [
  { id: 'bert', group_ids: ['system-admin'] },
  { id: 'marjo', group_ids: ['system-users'] },
  { id: 'owner', group_ids: [], is_owner: true },
];

test('admin from HA groups or owner, cached', async () => {
  let calls = 0;
  const ha = { send: async () => (calls++, USERS) };
  const a = new AdminCheck({ ha, optionsFile: join(tmpdir(), 'none.json'), log: quiet });
  assert.equal(await a.isAdmin({ id: 'bert', name: 'Bert' }), true);
  assert.equal(await a.isAdmin({ id: 'owner', name: 'X' }), true);
  assert.equal(await a.isAdmin({ id: 'marjo', name: 'Marjo' }), false);
  assert.equal(await a.isAdmin(null), false);
  assert.equal(calls, 1);
});

test('falls back to the admins option when HA refuses', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'td-'));
  try {
    const file = join(dir, 'options.json');
    await writeFile(file, JSON.stringify({ admins: [' marjo '] }));
    const ha = { send: async () => { throw new Error('Unauthorized'); } };
    const a = new AdminCheck({ ha, optionsFile: file, log: quiet });
    assert.equal(await a.isAdmin({ id: 'm', name: 'Marjo' }), true);
    assert.equal(await a.isAdmin({ id: 'b', name: 'Bert' }), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

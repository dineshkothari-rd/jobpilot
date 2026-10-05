import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import ts from 'typescript';
let client;
const route = new Module(import.meta.filename);
route.require = () => ({ createClient: async () => client });
route._compile(ts.transpileModule(readFileSync(new URL('../../app/api/applications/[id]/events/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, import.meta.filename);
const id = '00000000-0000-4000-8000-000000000041';
const get = (query = '') => route.exports.GET(new Request('https://jobpilot.test/api/applications/' + id + '/events' + query), { params: Promise.resolve({ id }) });
function database({ owner = true, signedIn = true, failure = false } = {}) {
  return { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'owner' } : null } }) },
    from(table) {
      const filters = {};
      const chain = {
        select() { return chain; }, eq(key, value) { filters[key] = value; return chain; },
        order(key, options) { assert.equal(key, 'id'); assert.equal(options.ascending, false); return chain; },
        limit(value) { assert.equal(value, 51); return chain; },
        lt(key, value) { assert.equal(key, 'id'); filters.before = value; return chain; },
        maybeSingle: async () => { assert.equal(filters.user_id, 'owner'); return { data: owner ? { id } : null }; },
        then(resolve) {
          assert.equal(table, 'application_events'); assert.equal(filters.user_id, 'owner'); assert.equal(filters.application_id, id);
          resolve({ error: failure ? {} : null, data: Array.from({ length: filters.before ? 1 : 51 }, (_, index) => ({ id: 100 - index, kind: 'updated', actor_id: 'owner' })) });
        },
      };
      return chain;
    },
  };
}
test('history authenticates, checks ownership and rejects malformed cursors', async () => {
  client = database({ signedIn: false }); assert.equal((await get()).status, 401);
  client = database({ owner: false }); assert.equal((await get()).status, 404);
  client = database();
  for (const cursor of ['0', '-1', 'abc', '9223372036854775808']) assert.equal((await get('?before=' + cursor)).status, 400);
});
test('history pages private events, omits actor IDs and handles unavailable storage', async () => {
  client = database(); let response = await get(); let data = await response.json();
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(data.events.length, 50); assert.equal(data.hasMore, true);
  assert.equal(data.events[0].actor, 'You'); assert.equal('actor_id' in data.events[0], false);
  data = await (await get('?before=50')).json(); assert.equal(data.hasMore, false); assert.equal(data.events.length, 1);
  client = database({ failure: true }); assert.equal((await get()).status, 503);
});

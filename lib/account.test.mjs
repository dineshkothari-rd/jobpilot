import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import ts from 'typescript';
let client;
let admin;
const route = new Module(import.meta.filename);
route.require = (name) => {
  if (name === '@/lib/supabase/server') return { createClient: async () => client };
  if (name === '@supabase/supabase-js') return { createClient: () => admin };
  throw Error(name);
};
route._compile(ts.transpileModule(readFileSync(new URL('../app/api/account/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
const owner = '00000000-0000-4000-8000-000000000040';
function setup({ signedIn = true, failTable = '', errorCode = '', failDelete = false, unsafePath = false, failStorage = false } = {}) {
  const calls = [];
  const user = { id: owner, email: 'candidate@example.com', created_at: '2026-10-01', user_metadata: { full_name: 'Candidate' } };
  client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? user : null } }),
      getSession: async () => ({ data: { session: { user, access_token: 'fixture-token' } } }),
      signOut: async () => { calls.push('clear-session'); return {}; } },
    from(table) {
      const filters = {};
      const query = { select(fields) { if (table === "calendar_connections") assert.equal(fields, "id,user_id,provider,created_at"); return query; }, eq(field, value) { filters[field] = value; return query; },
        order(key) { assert.equal(key, table === 'skillpath_enrollments' ? 'path_id' : ['autopilot_preferences','my_day_preferences','learning_goals','notification_preferences'].includes(table) ? 'user_id' : 'id'); return query; },
        async range(start, end) {
          assert.equal(filters[table === 'profiles' ? 'id' : table === 'jobs' ? 'created_by' : 'user_id'], owner);
          assert.equal(end - start, 499); calls.push(table + ':' + start);
          if (table === failTable) return { error: { message: 'database failure', code: errorCode } };
          return { data: table === 'applications' && start === 0 ? Array.from({ length: 500 }, (_, id) => ({ id })) : [{ owner, table }] };
        },
      };
      return query;
    },
  };
  let files = Array.from({ length: 105 }, (_, index) => ({ id: String(index), name: `resume-${index}.pdf` }));
  files.push({ id: null, name: 'nested' });
  let nested = [{ id: 'nested-file', name: 'inside.pdf' }];
  admin = {
    auth: { admin: {
      signOut: async (token, scope) => { assert.equal(token, 'fixture-token'); assert.equal(scope, 'global'); calls.push('revoke'); return {}; },
      deleteUser: async (id) => { assert.equal(id, owner); assert.equal(files.filter(x => x.id).length, 0); assert.equal(nested.length, 0); calls.push('delete-auth'); return { error: failDelete ? Error('delete failed') : null }; },
    } },
    from(table) { return {
      upsert: async (value) => { assert.equal(table, 'account_deletion_requests'); assert.equal(value.user_id, owner); calls.push('freeze'); return {}; },
      update(value) { assert.deepEqual(value, { enabled: false }); return { eq: async (field, id) => { assert.equal(id, owner); calls.push('pause'); return {}; } }; },
    }; },
    storage: { from(bucket) { assert.equal(bucket, 'resumes'); return {
      list: async (prefix) => {
        assert.ok(prefix === owner || prefix === owner + '/nested'); calls.push('list:' + prefix);
        if (failStorage) return { error: Error('storage failure') };
        if (unsafePath) return { data: [{ id: 'unsafe', name: '../other-user.pdf' }] };
        return { data: prefix.endsWith('/nested') ? nested : files.filter(x => x.id || nested.length).slice(0, 100) };
      },
      remove: async (paths) => {
        for (const path of paths) { assert.ok(path.startsWith(owner + '/')); calls.push('remove:' + path); }
        files = files.filter(file => !paths.includes(owner + '/' + file.name));
        nested = nested.filter(file => !paths.includes(owner + '/nested/' + file.name));
        return {};
      },
    }; } },
  };
  process.env.SUPABASE_SECRET_KEY = 'fixture-secret'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  return calls;
}
const remove = (body = { confirmation: 'DELETE', userId: 'other-account' }, origin = 'https://jobpilot.test') => route.exports.DELETE(new Request('https://jobpilot.test/api/account', { method: 'DELETE', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
test('exports all owned rows beyond one page and never returns a partial archive', async () => {
  const calls = setup(); const response = await route.exports.GET(); const data = await response.json();
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Disposition'), /attachment/);
  assert.equal(data.tables.applications.length, 501); assert.ok(calls.includes('applications:500'));
  assert.equal(data.account.email, 'candidate@example.com'); assert.equal('access_token' in data.account, false);
  setup({ failTable: 'resumes' }); assert.equal((await route.exports.GET()).status, 503);
  setup({ signedIn: false }); assert.equal((await route.exports.GET()).status, 401);
});
test('account deletion validates origin, confirmation, session and server configuration before cleanup', async () => {
  let calls = setup(); assert.equal((await remove({}, 'https://evil.example')).status, 403);
  assert.equal((await remove({ confirmation: 'yes' })).status, 400); assert.deepEqual(calls, []);
  setup({ signedIn: false }); assert.equal((await remove()).status, 401);
  calls = setup(); delete process.env.SUPABASE_SECRET_KEY;
  assert.equal((await remove()).status, 503); assert.deepEqual(calls, []);
});
test('deletion freezes uploads, revokes sessions and removes all files before deleting only the authenticated owner', async () => {
  const calls = setup(); const response = await remove();
  assert.equal(response.status, 200); assert.equal((await response.json()).deleted, true);
  assert.deepEqual(calls.slice(0, 3), ['freeze', 'revoke', 'pause']);
  assert.equal(calls.filter(x => x.startsWith('remove:')).length, 106);
  assert.deepEqual(calls.slice(-2), ['delete-auth', 'clear-session']);
});
test('storage and auth failures remain retryable and unsafe storage paths never reach deletion', async () => {
  for (const options of [{ failStorage: true }, { failDelete: true }, { unsafePath: true }]) {
    const calls = setup(options); const response = await remove();
    assert.equal(response.status, 503); assert.match((await response.json()).error, /retry deletion/);
    if (!options.failDelete) assert.equal(calls.includes('delete-auth'), false);
  }
});

test("export marks unavailable support data during rollout and fails on other support errors", async () => {
  setup({ failTable: "support_tickets", errorCode: "PGRST205" });
  const response = await route.exports.GET(); const data = await response.json();
  assert.equal(response.status, 200); assert.deepEqual(data.unavailable_sections, ["support_tickets"]);
  assert.ok(response.headers.get("X-JobPilot-Export-Warning"));
  setup({ failTable: "support_tickets", errorCode: "42501" }); assert.equal((await route.exports.GET()).status, 503);
});

test('reminder export includes preferences, devices and deliveries, and marks schema rollout gaps',async()=>{
  setup();let response=await route.exports.GET();let data=await response.json();
  assert.ok(data.tables.notification_preferences);assert.ok(data.tables.push_subscriptions);assert.ok(data.tables.reminder_deliveries);
  setup({failTable:'notification_preferences',errorCode:'42P01'});response=await route.exports.GET();data=await response.json();
  assert.equal(response.status,200);assert.deepEqual(data.unavailable_sections,['notification_preferences']);
  setup({failTable:'push_subscriptions',errorCode:'42501'});assert.equal((await route.exports.GET()).status,503);
});

test('calendar exports include owner metadata and event links without OAuth credentials',async()=>{
  const calls=setup();const response=await route.exports.GET();const data=await response.json();
  assert.equal(response.status,200);assert.ok(data.tables.calendar_connections);assert.ok(data.tables.calendar_event_links);
  assert.equal(calls.some(value=>value.startsWith('calendar_tokens:')),false);
  setup({failTable:'calendar_connections',errorCode:'42P01'});const pending=await route.exports.GET();assert.equal(pending.status,200);assert.deepEqual((await pending.json()).unavailable_sections,['calendar_connections']);
});

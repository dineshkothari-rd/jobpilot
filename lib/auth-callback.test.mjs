import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import ts from 'typescript';
import { safeInternalPath } from './site-url.ts';
let calls;
let exchangeError = false;
const route = new Module(import.meta.filename);
route.require = (name) => {
  if (name === '@/lib/site-url') return { getSiteUrl: () => 'https://jobpilot.test', safeInternalPath };
  if (name === 'next/server') return { NextResponse: { redirect: (url) => Response.redirect(url) } };
  if (name === '@/lib/supabase/server') return { createClient: async () => ({
    auth: { exchangeCodeForSession: async (code) => { calls.push(code); return { data: { user: exchangeError ? null : { id: 'owner' } }, error: exchangeError ? Error('expired') : null }; } },
    from(table) { calls.push(table); const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: table === 'profiles' ? { full_name: 'Candidate', target_role: 'Engineer', current_company: 'Company', location: 'City' } : { preferred_roles: ['Engineer'] } }) }; return query; },
  }) };
  throw Error(name);
};
route._compile(ts.transpileModule(readFileSync(new URL('../app/auth/callback/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
const get = (query) => route.exports.GET(new Request('https://jobpilot.test/auth/callback?' + query));
test('password recovery exchanges the code and bypasses onboarding redirects', async () => {
  calls = []; exchangeError = false;
  const response = await get('code=valid&next=%2Fauth%2Fupdate-password');
  assert.equal(response.headers.get('location'), 'https://jobpilot.test/auth/update-password');
  assert.deepEqual(calls, ['valid']);
});
test('normal confirmation preserves internal destinations and rejects external/auth destinations', async () => {
  for (const [next, expected] of [['/jobs', '/jobs'], ['//evil.example', '/dashboard'], ['/auth/callback', '/dashboard']]) {
    calls = []; exchangeError = false;
    const response = await get('code=valid&next=' + encodeURIComponent(next));
    assert.equal(response.headers.get('location'), 'https://jobpilot.test' + expected);
    assert.deepEqual(calls, ['valid', 'profiles', 'job_preferences']);
  }
});
test('expired and missing confirmation codes do not reach password update', async () => {
  calls = []; exchangeError = true;
  const original = console.error; console.error = () => {};
  try {
    for (const query of ['code=expired&next=%2Fauth%2Fupdate-password', 'next=%2Fauth%2Fupdate-password']) {
      assert.match((await get(query)).headers.get('location'), /\/auth\/login\?error=oauth_callback_failed$/);
    }
  } finally { console.error = original; exchangeError = false; }
});

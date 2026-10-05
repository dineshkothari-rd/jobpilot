import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import ts from 'typescript';
import { parseSupportTicket, parseSupportReply } from './content.ts';
import { isModerator } from '../jobs/reports.ts';
let client;
const route = new Module(import.meta.filename);
route.require = (name) => {
  if (name === '@/lib/supabase/server') return { createClient: async () => client };
  if (name === '@/lib/jobs/reports') return { isModerator };
  if (name === '@/lib/help/content') return { parseSupportTicket, parseSupportReply };
  throw Error(name);
};
route._compile(ts.transpileModule(readFileSync(new URL('../../app/api/support/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
function database({ signedIn = true, admin = false, error = null, stale = false } = {}) {
  const state = { inserted: null, filters: {}, update: null };
  client = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'owner', app_metadata: admin ? { role: 'admin' } : {}, user_metadata: { role: 'admin' } } : null } }) },
    from(table) {
      assert.equal(table, 'support_tickets'); const query = {
        select() { return query; }, order() { return query; }, range(start,end) { assert.equal(end-start,50); return query; },
        eq(key,value) { state.filters[key] = value; return query; },
        insert(value) { state.inserted=value; return query; }, update(value) { state.update=value; return query; },
        single: async () => ({ data: { id: 'ticket', ...state.inserted }, error }),
        maybeSingle: async () => ({ data: stale ? null : { id: 'ticket', ...state.update }, error }),
        then(resolve) { resolve({ data: Array.from({length:51}, (_,id)=>({id})), error }); },
      }; return query;
    },
  }; return state;
}
const get = (query='') => route.exports.GET(new Request('https://jobpilot.test/api/support'+query));
const mutate = (method, body, origin='https://jobpilot.test') => route.exports[method](new Request('https://jobpilot.test/api/support',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
const ticket = {category:'account',subject:'Login problem',details:'Unable to log in after resetting my password.'};
const reply = {id:'00000000-0000-4000-8000-000000000039',status:'resolved',response:'Please request a new password reset link.',version:2};
test('support list is owner filtered and admin queue ignores forged user metadata',async()=>{
  let state=database(); let response=await get(); const body=await response.json();
  assert.equal(state.filters.user_id,'owner'); assert.equal(body.tickets.length,50); assert.equal(body.hasMore,true);
  assert.equal((await get('?queue=1')).status,403); assert.equal((await get('?page=-1')).status,400);
  state=database({admin:true}); assert.equal((await get('?queue=1')).status,200); assert.equal(state.filters.user_id,undefined);
  database({signedIn:false}); assert.equal((await get()).status,401);
});
test('ticket submission checks origin, owner and rate limit without accepting forged fields',async()=>{
  let state=database(); assert.equal((await mutate('POST',ticket,'https://evil.test')).status,403); assert.equal(state.inserted,null);
  assert.equal((await mutate('POST',{...ticket,user_id:'other'})).status,400);
  assert.equal((await mutate('POST',ticket)).status,201); assert.equal(state.inserted.user_id,'owner');
  database({error:{message:'support_rate_limit'}}); assert.equal((await mutate('POST',ticket)).status,429);
  database({error:{message:'missing migration'}}); assert.equal((await mutate('POST',ticket)).status,503);
});
test('admin replies require server metadata and matching version',async()=>{
  database(); assert.equal((await mutate('PATCH',reply)).status,403);
  const state=database({admin:true}); assert.equal((await mutate('PATCH',reply)).status,200);
  assert.equal(state.filters.version,2); assert.equal(state.update.version,3);
  database({admin:true,stale:true}); assert.equal((await mutate('PATCH',reply)).status,409);
});

test('support accepts bounded Unicode details and rejects oversized request bodies',async()=>{
  database();
  const request = new Request('https://jobpilot.test/api/support',{method:'POST',headers:{Origin:'https://jobpilot.test','Content-Type':'application/json','Content-Length':'13000'},body:JSON.stringify({...ticket,details:'अ'.repeat(4000)})});
  assert.equal((await route.exports.POST(request)).status,201);
  const tooLarge = new Request('https://jobpilot.test/api/support',{method:'POST',headers:{Origin:'https://jobpilot.test','Content-Length':'20001'},body:JSON.stringify(ticket)});
  assert.equal((await route.exports.POST(tooLarge)).status,413);
});

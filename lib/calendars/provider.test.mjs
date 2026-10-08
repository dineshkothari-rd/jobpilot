import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { beginCalendarOAuth, calendarConfig, calendarEventBody, calendarRequest, calendarTokens, importedCalendarEvent, readCalendarOAuth, seal, unseal } from './provider.ts';
const event={id:'00000000-0000-4000-8000-000000000035',application_id:'00000000-0000-4000-8000-000000000036',round:'Technical chat',starts_at:'2026-10-06T03:30:00Z',timezone:'Asia/Kolkata',duration_minutes:60,location:'https://meet.example.test/room',notes:'private preparation',outcome:'private feedback',status:'scheduled',version:2};
function configure(){process.env.CALENDAR_ENCRYPTION_KEY=randomBytes(32).toString('base64');process.env.NEXT_PUBLIC_SITE_URL='https://jobpilot.test';process.env.SUPABASE_SECRET_KEY='fixture';for(const prefix of ['GOOGLE_CALENDAR','OUTLOOK_CALENDAR']){process.env[prefix+'_CLIENT_ID']='fixture';process.env[prefix+'_CLIENT_SECRET']='fixture-secret';}}
test('calendar encryption binds purpose and owner, detects tampering, and never falls back to plaintext',()=>{
 configure();const encrypted=seal('provider-token','owner:access');assert.notEqual(encrypted,'provider-token');assert.equal(unseal(encrypted,'owner:access'),'provider-token');assert.throws(()=>unseal(encrypted,'other:access'));
 const bytes=Buffer.from(encrypted,'base64url');bytes[bytes.length-1]^=1;assert.throws(()=>unseal(bytes.toString('base64url'),'owner:access'));delete process.env.CALENDAR_ENCRYPTION_KEY;assert.throws(()=>seal('token','owner'));assert.equal(calendarConfig('google').ready,false);
});
test('OAuth state is account-bound, expiring, authenticated, and uses PKCE with fixed endpoints',()=>{
 configure();for(const provider of ['google','outlook']){
  const flow=beginCalendarOAuth(provider,'owner');const url=new URL(flow.url);const state=url.searchParams.get('state');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),'https://jobpilot.test/api/calendars/callback');assert.ok(url.searchParams.get('code_challenge'));
  assert.equal(readCalendarOAuth(flow.cookie,state,'owner').provider,provider);assert.throws(()=>readCalendarOAuth(flow.cookie,state,'other'));assert.throws(()=>readCalendarOAuth(flow.cookie,'forged','owner'));
  const expired=seal(JSON.stringify({provider,userId:'owner',state,verifier:'fixture',expires:Date.now()-1}),'calendar-oauth');assert.throws(()=>readCalendarOAuth(expired,state,'owner'));
 }
});
test('calendar payloads export only schedule fields, preserve notes, and validate UTC/time limits',()=>{
 const google=calendarEventBody('google',event), outlook=calendarEventBody('outlook',event);
 for(const body of [google,outlook]){assert.equal(JSON.stringify(body).includes('private'),false);assert.equal('attendees' in body,false);}
 assert.equal(outlook.start.timeZone,'UTC');assert.equal(google.end.dateTime,'2026-10-06T04:30:00.000Z');
 const patch=importedCalendarEvent('google',{summary:'JobPilot: Updated',location:'Office',start:{dateTime:'2026-10-07T10:00:00+05:30'},end:{dateTime:'2026-10-07T11:00:00+05:30'}},event);
 assert.equal(patch.starts_at,'2026-10-07T04:30:00.000Z');assert.equal(patch.round,'Updated');assert.equal(patch.timezone,'Asia/Kolkata');assert.equal('notes' in patch,false);assert.equal('outcome' in patch,false);
 const imported=importedCalendarEvent('outlook',{...outlook,subject:'[Cancelled] JobPilot: Technical chat'},event);assert.equal(imported.status,'cancelled');assert.equal(imported.round,event.round);
 assert.deepEqual(importedCalendarEvent('google',{status:'cancelled'},event),{status:'cancelled'});
 for(const bad of [{...google,start:{date:'2026-10-06'}},{...google,recurrence:['RRULE:FREQ=DAILY']},{...outlook,isAllDay:true},{...outlook,start:{dateTime:'2026-10-06T03:30:00',timeZone:'Pacific Standard Time'}},{...google,summary:'x'.repeat(121)},{...google,end:{dateTime:'2026-10-06T03:31:00Z'}}]) assert.throws(()=>importedCalendarEvent('summary' in bad?'google':'outlook',bad,event));
});
test('provider requests never follow redirects, use conditional writes and suppress Google attendee updates',async()=>{
 configure();const original=globalThis.fetch;const requests=[];
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600});};
 try {
  await calendarRequest('google','token','id/with spaces','PATCH',{summary:'safe'},'etag');let request=requests.at(-1);assert.ok(request.url.includes('id%2Fwith%20spaces?sendUpdates=none'));assert.equal(request.options.headers['If-Match'],'etag');assert.equal(request.options.redirect,'error');
  await calendarRequest('outlook','token','safe-id');assert.equal(requests.at(-1).options.headers.Prefer,'outlook.timezone="UTC", IdType="ImmutableId"');
  await calendarTokens('outlook',{grant_type:'authorization_code',code:'fixture-code',code_verifier:'fixture-verifier'});request=requests.at(-1);assert.equal(new URL(request.url).hostname,'login.microsoftonline.com');assert.equal(request.options.body.get('client_secret'),'fixture-secret');
  globalThis.fetch=async()=>Response.json({access_token:'',expires_in:3600});await assert.rejects(()=>calendarTokens('google',{}));
 }finally{globalThis.fetch=original;}
});

test('access token refresh persists encrypted rotating credentials and does not expose plaintext',async()=>{
 const {Module}=await import('node:module');const {readFileSync}=await import('node:fs');const {default:ts}=await import('typescript');const provider=await import('./provider.ts');
 const route=new Module(import.meta.filename);route.require=name=>{if(name==='server-only') return {};if(name==='@supabase/supabase-js') return {};if(name==='./provider') return provider;throw Error(name);};
 route._compile(ts.transpileModule(readFileSync(new URL('./server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,import.meta.filename);
 configure();const connection={id:'connection',user_id:'owner',provider:'outlook'};let stored={access_token:seal('cached-access','owner:connection:access'),refresh_token:seal('old-refresh','owner:connection:refresh'),expires_at:new Date(Date.now()+3600000).toISOString()};let updated;
 const admin={from(table){assert.equal(table,'calendar_tokens');const q={select(){return q;},eq(field,id){assert.equal(field,'connection_id');assert.equal(id,'connection');return q;},single:async()=>({data:stored}),update(value){updated=value;return q;},then(resolve){resolve({});}};return q;}};
 const old=globalThis.fetch;globalThis.fetch=async(url,options)=>{assert.equal(options.body.get('refresh_token'),'old-refresh');return Response.json({access_token:'refreshed-access',refresh_token:'new-refresh',expires_in:3600});};
 try {assert.equal(await route.exports.calendarAccess(admin,connection),'cached-access');assert.equal(updated,undefined);stored.expires_at=new Date(Date.now()-1000).toISOString();assert.equal(await route.exports.calendarAccess(admin,connection),'refreshed-access');assert.equal(unseal(updated.refresh_token,'owner:connection:refresh'),'new-refresh');assert.equal(unseal(updated.access_token,'owner:connection:access'),'refreshed-access');}finally{globalThis.fetch=old;}
});

test('calendar branding preserves imports of existing JobPilot events and new Parth Careers events', () => {
  for (const provider of ['google', 'outlook']) {
    const remote = calendarEventBody(provider, event);
    const field = provider === 'google' ? 'summary' : 'subject';
    assert.equal(remote[field], `Parth Careers: ${event.round}`);
    for (const prefix of ['JobPilot', 'Parth Careers']) {
      assert.equal(importedCalendarEvent(provider, { ...remote, [field]: `${prefix}: ${event.round}` }, event).round, event.round);
      const cancelled = importedCalendarEvent(provider, { ...remote, [field]: `[Cancelled] ${prefix}: ${event.round}` }, event);
      assert.equal(cancelled.round, event.round);
      assert.equal(cancelled.status, 'cancelled');
    }
  }
});

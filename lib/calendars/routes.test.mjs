import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import * as providers from './provider.ts';
import { interviewId } from '../applications/interviews.ts';
let client,admin,cookie,remoteCalls=[];
let remoteGet,remoteWrite;
function responseCookies(response){response.cookies={values:[],set(...args){this.values.push(args);}};return response;}
function load(path){
 const route=new Module(import.meta.filename);route.require=name=>{
  if(name==='node:crypto') return crypto;
  if(name==='@/lib/supabase/server') return {createClient:async()=>client};
  if(name==='@/lib/applications/interviews') return {interviewId};
  if(name==='@/lib/calendars/server') return {calendarAdmin:()=>admin,calendarAccess:async()=> 'fixture-access'};
  if(name==='@/lib/calendars/provider') return {...providers,calendarRequest:async(...args)=>{remoteCalls.push(args);return (args[3]||'GET')==='GET'?remoteGet():remoteWrite();}};
  if(name==='next/headers') return {cookies:async()=>({get:()=>({value:cookie})})};
  if(name==='next/server') return {NextResponse:{json:(body,options)=>responseCookies(Response.json(body,options)),redirect:url=>responseCookies(new Response(null,{status:307,headers:{Location:String(url)}}))}};
  throw Error(name);
 };
 route._compile(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,import.meta.filename);return route.exports;
}
const api=load('../../app/api/calendars/route.ts'),connect=load('../../app/api/calendars/connect/route.ts'),callback=load('../../app/api/calendars/callback/route.ts');
const owner='00000000-0000-4000-8000-000000000030',connectionId='00000000-0000-4000-8000-000000000031',interview='00000000-0000-4000-8000-000000000032',linkId='00000000-0000-4000-8000-000000000033';
const event={id:interview,user_id:owner,application_id:'00000000-0000-4000-8000-000000000034',round:'Chat',starts_at:'2026-10-06T03:30:00Z',duration_minutes:60,timezone:'Asia/Kolkata',location:'Office',notes:'private',outcome:'private',status:'scheduled',version:1};
function setup({signedIn=true,provider='google',foreign=false,stale=false,claimed=true,link=true,connectExisting=false,deleting=false}={}){
 process.env.CALENDAR_ENCRYPTION_KEY=crypto.randomBytes(32).toString('base64');process.env.NEXT_PUBLIC_SITE_URL='https://jobpilot.test';process.env.SUPABASE_SECRET_KEY='fixture';for(const prefix of ['GOOGLE_CALENDAR','OUTLOOK_CALENDAR']){process.env[prefix+'_CLIENT_ID']='fixture';process.env[prefix+'_CLIENT_SECRET']='fixture-secret';}
 remoteCalls=[];cookie=null;const calls=[];let storedLink=link?{id:linkId,user_id:owner,connection_id:connectionId,interview_id:interview,event_id:'remote',etag:'v1'}:null;
 function query(table,isAdmin){const filters={};let mutation=null;const q={select(){return q;},eq(key,value){filters[key]=value;return q;},limit(){return q;},insert(value){mutation={method:'insert',value};return q;},update(value){mutation={method:'update',value};return q;},delete(){mutation={method:'delete'};return q;},maybeSingle:async()=>result(),single:async()=>result(),then(resolve){resolve(result());}};
  function result(){calls.push({table,filters:{...filters},mutation,admin:isAdmin});
   if(mutation?.method==='insert'&&table==='calendar_event_links'){storedLink={...mutation.value,etag:null};return {data:storedLink};}
   if(mutation) return {data:null};
   if(table==='calendar_connections') return {data:isAdmin?(foreign?null:{id:connectionId,user_id:owner,provider}):filters.provider?(connectExisting?{id:connectionId}:null):[{id:connectionId,provider}]};
   if(table==='account_deletion_requests') return {data:deleting?{user_id:owner}:null};
   if(table==='application_interviews') return {data:{...event,version:stale?2:1}};
   if(table==='calendar_event_links') return {data:isAdmin?storedLink:storedLink?[storedLink]:[]};
   return {data:null};
  }return q;
 }
 client={auth:{getUser:async()=>({data:{user:signedIn?{id:owner}:null}})},from:table=>query(table,false)};
 admin={from:table=>query(table,true),rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:name==='claim_calendar_sync'?claimed:null};}};
 remoteGet=()=>Response.json(provider==='google'?{id:'remote',etag:'v1',summary:'JobPilot: Imported',start:{dateTime:'2026-10-07T03:30:00Z'},end:{dateTime:'2026-10-07T04:15:00Z'},location:'Office'}:{id:'remote','@odata.etag':'v1',subject:'JobPilot: Imported',start:{dateTime:'2026-10-07T03:30:00',timeZone:'UTC'},end:{dateTime:'2026-10-07T04:15:00',timeZone:'UTC'},location:{displayName:'Office'},type:'singleInstance'});
 remoteWrite=()=>Response.json({id:'remote',etag:'v2','@odata.etag':'v2'});
 return calls;
}
const req=(action='export',version=1,origin='https://jobpilot.test')=>new Request('https://jobpilot.test/api/calendars',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({connection:connectionId,interview,version,action})});
test('calendar sync requires authentication, same origin, owner connection and current saved version',async()=>{
 let calls=setup();assert.equal((await api.POST(req('export',1,'https://evil.test'))).status,403);assert.equal(calls.length,0);
 setup({signedIn:false});assert.equal((await api.POST(req())).status,401);
 setup({foreign:true});assert.equal((await api.POST(req())).status,404);assert.equal(remoteCalls.length,0);
 calls=setup({stale:true});assert.equal((await api.POST(req())).status,409);assert.equal(remoteCalls.length,0);assert.ok(calls.some(x=>x.table==='calendar_connections'&&x.mutation?.value.lease_token===null));
 setup({claimed:false});assert.equal((await api.POST(req())).status,409);assert.equal(remoteCalls.length,0);
});
test('both providers export schedule-only fields conditionally and import via owner/version-bound transaction',async()=>{
 for(const provider of ['google','outlook']){
  let calls=setup({provider});assert.equal((await api.POST(req())).status,200);const write=remoteCalls.at(-1);assert.equal(write[3],'PATCH');assert.equal(write[5],'v1');assert.equal(JSON.stringify(write[4]).includes('private'),false);
  assert.ok(calls.filter(x=>x.table==='calendar_event_links'&&x.mutation).every(x=>x.filters.user_id===owner));
  calls=setup({provider});assert.equal((await api.POST(req('import'))).status,200);const imported=calls.find(x=>x.rpc==='import_calendar_round');assert.equal(imported.args.p_user,owner);assert.equal(imported.args.p_version,1);assert.equal(imported.args.p_event.duration_minutes,45);assert.equal('notes' in imported.args.p_event,false);
 }
});
test('conflicts, meetings with attendees, and precondition failures never silently overwrite provider edits',async()=>{
 setup();remoteGet=()=>Response.json({etag:'changed'});assert.equal((await api.POST(req())).status,409);assert.equal(remoteCalls.length,1);
 setup();remoteGet=()=>Response.json({etag:'v1',attendees:[{email:'person@example.com'}]});assert.equal((await api.POST(req())).status,409);assert.equal(remoteCalls.length,1);
 setup();remoteGet=()=>Response.json({etag:"v1",status:"cancelled"});assert.equal((await api.POST(req())).status,409);assert.equal(remoteCalls.length,1);
 setup();remoteGet=()=>Response.json({etag:"v1",summary:"All day",start:{date:"2026-10-06"},end:{date:"2026-10-07"}});assert.equal((await api.POST(req("import"))).status,400);
 setup();remoteWrite=()=>new Response(null,{status:412});assert.equal((await api.POST(req())).status,409);
 setup();remoteGet=()=>new Response(null,{status:404});assert.equal((await api.POST(req())).status,409);
 let calls=setup();remoteGet=()=>new Response(null,{status:404});assert.equal((await api.POST(req('import'))).status,200);assert.deepEqual(calls.find(x=>x.rpc==='import_calendar_round').args.p_event,{status:'cancelled'});assert.equal(calls.find(x=>x.rpc==='import_calendar_round').args.p_etag,'v1');
 setup({link:false});assert.equal((await api.POST(req('import'))).status,409);
 calls=setup({link:false});remoteGet=()=>new Response(null,{status:404});assert.equal((await api.POST(req())).status,200);const inserted=calls.find(x=>x.table==='calendar_event_links'&&x.mutation?.method==='insert');assert.equal(remoteCalls.at(-1)[4].id,inserted.mutation.value.event_id);assert.equal(remoteCalls.at(-1)[4].visibility,"private");
 setup({provider:"outlook",link:false});assert.equal((await api.POST(req())).status,200);assert.equal(remoteCalls.at(-1)[4].sensitivity,"private");
});
test('calendar unlink/disconnect are owner-bound and retain provider-owned events',async()=>{
 for(const query of [`?connection=${connectionId}`,`?connection=${connectionId}&interview=${interview}`]){
  const calls=setup();const response=await api.DELETE(new Request('https://jobpilot.test/api/calendars'+query,{method:'DELETE',headers:{Origin:'https://jobpilot.test'}}));assert.equal(response.status,200);assert.equal(remoteCalls.length,0);const removed=calls.find(x=>x.mutation?.method==='delete');assert.equal(removed.filters.user_id,owner);
 }
});
test('calendar OAuth callback rejects wrong state/account before any token request and atomically stores encrypted tokens',async()=>{
 let calls=setup();let response=await connect.POST(new Request('https://jobpilot.test/api/calendars/connect?provider=google',{method:'POST',headers:{Origin:'https://jobpilot.test'}}));assert.equal(response.status,200);assert.equal(response.cookies.values[0][2].httpOnly,true);const state=new URL((await response.json()).url).searchParams.get('state');cookie=response.cookies.values[0][1];
 const original=globalThis.fetch;let tokenRequests=0;globalThis.fetch=async()=>{tokenRequests++;return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,scope:providers.calendarScope.google});};
 try {
  response=await callback.GET(new Request('https://jobpilot.test/api/calendars/callback?code=fixture&state=forged'));assert.ok(response.headers.get('Location').endsWith('calendar=failed'));assert.equal(tokenRequests,0);
  response=await callback.GET(new Request('https://jobpilot.test/api/calendars/callback?code=fixture&state='+state));assert.ok(response.headers.get('Location').endsWith('calendar=connected'));const stored=calls.find(x=>x.rpc==='store_calendar_connection');assert.equal(stored.args.p_user,owner);assert.notEqual(stored.args.p_access,'fixture-access');assert.equal(providers.unseal(stored.args.p_access,`${owner}:${stored.args.p_id}:access`),'fixture-access');assert.equal(response.cookies.values[0][2].maxAge,0);
 }finally{globalThis.fetch=original;}
});

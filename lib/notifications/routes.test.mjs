import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { createECDH } from 'node:crypto';
import ts from 'typescript';
import * as helpers from './reminders.ts';
import { authorizedCron } from '../autopilot/schedule.ts';
let client, admin, pushed=[];
function load(path) {
  const routeModule=new Module(import.meta.filename);
  routeModule.require=name=>{
    if(name==='server-only') return {};
    if(name==='@/lib/supabase/server') return {createClient:async()=>client};
    if(name==='@supabase/supabase-js') return {createClient:()=>admin};
    if(name==='@/lib/notifications/reminders'||name==='./reminders') return helpers;
    if(name==='@/lib/notifications/delivery') return load('./delivery.ts');
    if(name==='@/lib/autopilot/schedule') return {authorizedCron};
    if(name==='web-push') return {sendNotification:async(...args)=>{pushed.push(args); if(pushStatus) throw {statusCode:pushStatus};}};
    throw Error(name);
  };
  routeModule._compile(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,import.meta.filename);
  return routeModule.exports;
}
const api=load('../../app/api/notifications/route.ts'), cron=load('../../app/api/cron/reminders/route.ts');
const owner='00000000-0000-4000-8000-000000000034';
const curve=createECDH('prime256v1');curve.generateKeys();
const device={id:'00000000-0000-4000-8000-000000000035',endpoint:'https://fcm.googleapis.com/send/fixture',p256dh:curve.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')};
let pushStatus=0;
function configure() {
  process.env.CRON_SECRET='fixture';process.env.SUPABASE_SECRET_KEY='fixture';process.env.NEXT_PUBLIC_SITE_URL='https://jobpilot.test';process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';process.env.RESEND_API_KEY='fixture';process.env.REMINDER_FROM_EMAIL='reminders@example.com';process.env.VAPID_PUBLIC_KEY='fixture';process.env.VAPID_PRIVATE_KEY='fixture';
}
function setup({signedIn=true,confirmed=true,deleting=false,due=true,claim=true,insertError=null}={}) {
  configure();pushed=[];pushStatus=0;
  const calls=[];
  const user={id:owner,email:'candidate@example.com',email_confirmed_at:confirmed?'2026-10-01':null};
  function query(table) {
    const filters={};let mutation=null;
    const q={ select(){return q;},eq(k,v){filters[k]=v;return q;},or(){return q;},order(){return q;},range(){return q;},not(){return q;},gte(){return q;},lte(){return q;},limit(){return q;},
      update(value){mutation={method:'update',value};return q;},upsert(value){mutation={method:'upsert',value};return q;},insert(value){mutation={method:'insert',value};return q;},delete(){mutation={method:'delete'};return q;},
      maybeSingle:async()=>result(),then(resolve){resolve(result());},
    };
    function result(){
      calls.push({table,filters:{...filters},mutation});
      if(mutation) return {error:mutation.method==='insert'?insertError:null};
      if(table==='account_deletion_requests') return {data:deleting?{user_id:owner}:null};
      if(table==='notification_preferences') return {data:[{user_id:owner,email_enabled:true,push_enabled:true,timezone:'UTC'}]};
      if(table==='applications') return {data:due?[{id:'app',status:'applied',follow_up_at:new Date().toISOString()}]:[]};
      if(table==='application_interviews') return {data:[]};
      if(table==='push_subscriptions') return {data:filters.endpoint?null:[device]};
      return {data:null};
    }
    return q;
  }
  client={auth:{getUser:async()=>({data:{user:signedIn?user:null}})},from:query};
  admin={from:query,auth:{admin:{getUserById:async()=>({data:{user}})}},rpc:async(name,args)=>{assert.equal(name,'claim_reminder');calls.push({claim:args});return {data:claim?[{id:'delivery',attempts:2}]:[]};}};
  return calls;
}
const request=(method,body,origin='https://jobpilot.test')=>new Request('https://jobpilot.test/api/notifications',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const prefs={email_enabled:true,push_enabled:true,timezone:'UTC'};
const cronRequest=(secret='fixture')=>new Request('https://jobpilot.test/api/cron/reminders',{headers:{Authorization:`Bearer ${secret}`}});
test('preference writes bind owner, enforce origin/confirmed email and allow disabling unconfigured channels',async()=>{
  let calls=setup();assert.equal((await api.PATCH(request('PATCH',prefs,'https://evil.test'))).status,403);assert.equal(calls.length,0);
  assert.equal((await api.PATCH(request('PATCH',{...prefs,user_id:'foreign'}))).status,400);
  assert.equal((await api.PATCH(request('PATCH',prefs))).status,200);assert.equal(calls.at(-1).mutation.value.user_id,owner);
  setup({confirmed:false});assert.equal((await api.PATCH(request('PATCH',prefs))).status,409);
  delete process.env.RESEND_API_KEY;delete process.env.VAPID_PRIVATE_KEY;
  assert.equal((await api.PATCH(request('PATCH',{email_enabled:false,push_enabled:false,timezone:'UTC'}))).status,200);
  setup({signedIn:false});assert.equal((await api.GET()).status,401);
  setup();assert.equal((await api.POST(request('POST',{endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}}))).status,201);
  calls=setup();assert.equal((await api.DELETE(request('DELETE',{endpoint:device.endpoint,user_id:'other'}))).status,200);assert.equal(calls.at(-1).filters.user_id,owner);
  setup({insertError:{code:'23505',message:'duplicate'}});assert.equal((await api.POST(request('POST',{endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}}))).status,409);
});
test('cron authorization, deletion, absent schedules and already claimed deliveries never send',async()=>{
  for(const options of [{deleting:true},{due:false},{claim:false}]) {
    setup(options);const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('unexpected external request');};
    try { assert.equal((await cron.GET(cronRequest())).status,200);assert.equal(pushed.length,0); } finally{globalThis.fetch=old;}
  }
  const calls=setup();assert.equal((await cron.GET(cronRequest('wrong'))).status,401);assert.equal(calls.length,0);
});
test('dispatcher sends only confirmed owner email, uses idempotency and generic push, and persists attempt match',async()=>{
  const calls=setup();const old=globalThis.fetch;let email;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');email=options;return new Response('{}',{status:200});};
  try {
    const response=await cron.GET(cronRequest());assert.equal(response.status,200);assert.equal((await response.json()).sent,2);
    assert.deepEqual(JSON.parse(email.body).to,['candidate@example.com']);assert.match(email.headers['Idempotency-Key'],new RegExp(owner));
    assert.equal(JSON.parse(pushed[0][1]).kind,'reminder');assert.equal(pushed[0][2].TTL,3600);
    assert.ok(calls.filter(x=>x.table==='reminder_deliveries').every(x=>x.filters.attempts===2 && x.mutation.value.status==='sent'));
    setup({confirmed:false});email=null;await cron.GET(cronRequest());assert.equal(email,null);assert.equal(pushed.length,1);
  } finally{globalThis.fetch=old;}
});
test('failed email does not suppress push; expired devices are removed only for their owner',async()=>{
  let calls=setup();const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:503});
  try {
    const response=await cron.GET(cronRequest());assert.equal(response.status,503);assert.equal(pushed.length,1);
    assert.ok(calls.some(x=>x.table==='reminder_deliveries'&&x.mutation.value.status==='failed'));
    calls=setup({confirmed:false});pushStatus=410;assert.equal((await cron.GET(cronRequest())).status,200);
    const removed=calls.find(x=>x.table==='push_subscriptions'&&x.mutation?.method==='delete');assert.equal(removed.filters.user_id,owner);assert.equal(removed.filters.id,device.id);
  } finally{globalThis.fetch=old;}
});

test('oversized subscription requests fail before database writes',async()=>{
 const calls=setup();const body={endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth},extra:'x'.repeat(8192)};
 assert.equal((await api.POST(request('POST',body))).status,413);assert.equal(calls.length,0);
});

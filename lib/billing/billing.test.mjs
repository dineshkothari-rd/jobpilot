import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import ts from 'typescript';
import { extractText } from 'unpdf';
import * as provider from './provider.ts';
import { receiptPdf } from './receipt.ts';
function load(path, overrides={}) {
 const m=new Module(import.meta.filename);m.require=name=>{if(name==='server-only')return {};if(name==='./provider'||name==='@/lib/billing/provider')return provider;if(overrides[name])return overrides[name];if(name==='node:crypto')return {randomUUID:()=>crypto.randomUUID()};throw Error(name);};
 m._compile(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,import.meta.filename);return m.exports;
}
function configured(){process.env.BILLING_MODE='test';process.env.RAZORPAY_KEY_ID='rzp_test_fixture';process.env.RAZORPAY_KEY_SECRET='fixture';process.env.RAZORPAY_WEBHOOK_SECRET='fixture';}
test('billing is disabled without test keys and cannot enable live collection before acceptance',()=>{
 delete process.env.BILLING_MODE;assert.equal(provider.billingConfiguration().ready,false);configured();assert.equal(provider.billingConfiguration().ready,true);
 process.env.BILLING_MODE='live';process.env.RAZORPAY_KEY_ID='rzp_live_fixture';process.env.BILLING_LIVE_ENABLED='true';assert.equal(provider.billingConfiguration().ready,false);configured();
 const body='{"event":"payment_link.paid"}';const signature=createHmac('sha256','fixture').update(body).digest('hex');assert.equal(provider.verifyWebhook(body,signature,'fixture'),true);assert.equal(provider.verifyWebhook(body+' ',signature,'fixture'),false);assert.equal(provider.verifyWebhook(body,'bad','fixture'),false);
 for(const url of ['https://rzp.io.evil.test/pay','http://rzp.io/pay','https://user@rzp.io/pay','https://rzp.io:8080/pay'])assert.throws(()=>provider.hostedUrl(url));assert.equal(provider.hostedUrl('https://rzp.io/pay'),'https://rzp.io/pay');assert.throws(()=>provider.providerId('../escape','pay'));
 assert.throws(()=>provider.matchedPlan({period:'monthly',interval:1,item:{amount:1,currency:'INR'}},29900));
});
test('provider requests cannot escape fixed API host or accept caller query strings',async()=>{
 configured();let calls=0;const original=global.fetch;global.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.razorpay.com/v1/payment_links/plink_fixture');assert.equal(options.redirect,'error');return Response.json({id:'plink_fixture'});};try{await assert.rejects(provider.razorpay('/payments/../secrets'));await assert.rejects(provider.razorpay('/invoices?subscription_id=sub_fixture&count=100&escape=true'));assert.equal(calls,0);await provider.razorpay('/payment_links/plink_fixture');assert.equal(calls,1);}finally{global.fetch=original;}
});
test('canonical provider checks recover missed link payment, reject identity/amount mismatch and release leases',async()=>{
 configured();const rpcCalls=[], releases=[];let dedupe=false,amount=49900,reference='00000000-0000-4000-8000-000000000001';
 const intent={id:reference,user_id:'owner',product_id:'posting_single',mode:'test',amount_minor:49900,provider_resource:'plink_fixture',provider_plan:null};
 const admin={rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:name==='claim_billing_event'?!dedupe:null};},from(table){const q={select(){return q;},eq(){return q;},single:async()=>({data:{kind:'posting_pack'}}),update(value){releases.push({table,value});return q;},then(resolve){resolve({error:null});}};return q;}};
 const {reconcileBilling}=load('./server.ts');const original=global.fetch;global.fetch=async url=>Response.json(url.includes('/payment_links/')?{reference_id:reference,amount:49900,currency:'INR',accept_partial:false,status:'paid',payments:[{payment_id:'pay_fixture',status:'captured'}]}:{id:'pay_fixture',status:'captured',amount,currency:'INR',amount_refunded:0,created_at:Math.floor(Date.now()/1000)});
 try{await reconcileBilling(admin,intent,'event_fixture');assert.equal(rpcCalls.at(-1).args.p_payment,'pay_fixture');assert.equal(rpcCalls.at(-1).args.p_status,'paid');assert.equal(releases.length,1);
 amount=1;await assert.rejects(reconcileBilling(admin,intent,'event_amount'));assert.equal(releases.length,2);reference='forged';await assert.rejects(reconcileBilling(admin,intent,'event_foreign'));assert.equal(releases.length,3);
 dedupe=true;const prior=rpcCalls.length;await reconcileBilling(admin,intent,'event_duplicate');assert.equal(rpcCalls.length,prior+1);assert.equal(releases.length,3);
 }finally{global.fetch=original;}
});
test('receipts parse as a real PDF and distinguish a receipt from a tax invoice',async()=>{
 const pdf=receiptPdf({id:'pay_fixture',amount_minor:49900,refunded_minor:100,paid_at:'2026-10-07T00:00:00Z'});const result=await extractText(new Uint8Array(pdf),{mergePages:true});assert.equal(result.totalPages,1);assert.match(result.text,/Amount: INR 499.00/);assert.match(result.text,/Refunded: INR 1.00/);assert.match(result.text,/not a tax invoice/);
});

test('billing APIs use fresh owner auth, origin checks, private receipts and signed webhook retries',async()=>{
 configured();process.env.SUPABASE_SECRET_KEY='fixture';process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';let signedIn=true,pending=false,receipt=false;const calls=[];
 const user={id:'00000000-0000-4000-8000-000000000001',email_confirmed_at:'2026-10-07'};
 const admin={from(table){const filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},single:async()=>result(),maybeSingle:async()=>result()};function result(){calls.push({table,filters:{...filters}});if(table==='account_deletion_requests')return {data:null};if(table==='billing_payments')return {data:receipt?{id:'pay_fixture',amount_minor:100,refunded_minor:0,paid_at:'2026-10-07'}:null};if(table==='billing_intents')return {data:pending?{id:user.id}:null};return {data:null,error:{message:'unavailable'}};}return q;}};
 const overrides={'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?user:null}})}})},'@supabase/supabase-js':{createClient:()=>admin},'@/lib/recruiter/validation':{uuid:v=>{if(v!==user.id)throw Error();return v;}},'@/lib/billing/receipt':{receiptPdf},'@/lib/billing/server':{reconcileBilling:async()=>{throw Error('Unexpected grant');}}};
 overrides['@/lib/recruiter/server']=load('../recruiter/server.ts',overrides);
 const checkout=load('../../app/api/billing/checkout/route.ts',overrides),billing=load('../../app/api/billing/route.ts',overrides),receipts=load('../../app/api/billing/receipts/route.ts',overrides),webhook=load('../../app/api/billing/webhook/route.ts',overrides);
 const request=(body,method='POST',origin='https://jobpilot.test')=>new Request('https://jobpilot.test/api/billing',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await checkout.POST(request({},'POST','https://evil.test'))).status,403);assert.equal(calls.length,0);
 signedIn=false;for(const route of [billing,receipts])assert.equal((await route.GET(new Request('https://jobpilot.test/api/billing'))).status,401);assert.equal((await checkout.POST(request({}))).status,401);assert.equal(calls.length,0);
 signedIn=true;assert.equal((await checkout.POST(request({id:user.id,product:'candidate_pro',user_id:'forged'}))).status,400);
 assert.equal((await receipts.GET(new Request('https://jobpilot.test/api/billing/receipts?id=pay_fixture'))).status,404);assert.equal(calls.at(-1).filters.user_id,user.id);
 receipt=true;const pdf=await receipts.GET(new Request('https://jobpilot.test/api/billing/receipts?id=pay_fixture'));assert.equal(pdf.status,200);assert.equal(pdf.headers.get('cache-control'),'private, no-store');assert.equal(pdf.headers.get('content-type'),'application/pdf');
 const event={event:'payment_link.paid',payload:{payment_link:{entity:{id:'plink_fixture',notes:{jobpilot_checkout:user.id}}}}};const raw=JSON.stringify(event);const signature=createHmac('sha256','fixture').update(raw).digest('hex');const hook=()=>new Request('https://jobpilot.test/api/billing/webhook',{method:'POST',headers:{'x-razorpay-signature':signature,'x-razorpay-event-id':'event_fixture'},body:raw});
 assert.equal((await webhook.POST(new Request('https://jobpilot.test/api/billing/webhook',{method:'POST',body:raw}))).status,400);assert.equal((await webhook.POST(hook())).status,200);pending=true;assert.equal((await webhook.POST(hook())).status,503);
});

test('subscription access uses the paid invoice period, never a later unpaid subscription period',async()=>{
 configured();const expiry=Math.floor(Date.now()/1000)-86400,calls=[];const intent={id:'00000000-0000-4000-8000-000000000001',product_id:'candidate_pro',mode:'test',amount_minor:29900,provider_resource:'sub_fixture',provider_plan:'plan_fixture'};
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:true};},from(){const q={select(){return q;},eq(){return q;},single:async()=>({data:{kind:'subscription'}}),update(){return q;},then(resolve){resolve({error:null});}};return q;}};
 const original=global.fetch;global.fetch=async url=>Response.json(url.includes('/subscriptions/')?{plan_id:'plan_fixture',status:'active',current_end:expiry+2592000}:url.includes('/payments/')?{id:'pay_fixture',invoice_id:'inv_fixture',status:'captured',amount:29900,currency:'INR',amount_refunded:0,created_at:expiry-86400}:{subscription_id:'sub_fixture',payment_id:'pay_fixture',billing_end:expiry,short_url:'https://rzp.io/i/fixture'});
 try{await load('./server.ts').reconcileBilling(admin,intent,'event_old_period','pay_fixture');assert.equal(calls.at(-1).args.p_expires,new Date(expiry*1000).toISOString());assert.equal(calls.at(-1).args.p_invoice,'https://rzp.io/i/fixture');}finally{global.fetch=original;}
});

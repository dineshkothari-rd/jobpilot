import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
let active={data:true,error:null};let signedIn=true;let calls=0;
const route=new Module(import.meta.filename);route.require=name=>{
 if(name==="@supabase/ssr")return{createServerClient:()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:"owner"}:null},error:null})},rpc:async name=>{assert.equal(name,"current_account_is_active");calls++;return active;}})};
 if(name==="@supabase/supabase-js")return{AuthError:class extends Error{}};
 if(name==="next/headers")return{cookies:async()=>({getAll:()=>[]})};throw Error(name);
};
route._compile(ts.transpileModule(readFileSync(new URL("./server.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,import.meta.filename);
test("shared server auth admits active users and rejects suspended/stale sessions or unavailable access checks",async()=>{
 for(const [state,allowed] of [[{data:true,error:null},true],[{data:false,error:null},false],[{data:null,error:{message:"DB unavailable"}},false]]){active=state;const c=await route.exports.createClient();const r=await c.auth.getUser();assert.equal(Boolean(r.data.user),allowed);if(!allowed)assert.ok(r.error);}
 signedIn=false;calls=0;assert.equal((await(await route.exports.createClient()).auth.getUser()).data.user,null);assert.equal(calls,0);
});

import test from 'node:test';import assert from 'node:assert/strict';import { Module } from 'node:module';import { readFileSync } from 'node:fs';import ts from 'typescript';import * as validation from './validation.ts';import * as hiring from './applications.ts';import * as scorer from '../matching/scorer.ts';import * as communications from './communications.ts';
let client,admin,calls;
function load(path){const routeModule=new Module(import.meta.filename);routeModule.require=name=>{if(name==='@/lib/matching/scorer')return scorer;if(name==='@/lib/recruiter/communications')return communications;if(name==='@/lib/plans/server')return {consumeAllowance:async()=>{},AllowanceError:class extends Error{}};if(name==='server-only')return {};if(name==='@/lib/supabase/server')return {createClient:async()=>client};if(name==='@supabase/supabase-js')return {createClient:()=>admin};if(name==='@/lib/recruiter/server')return load('./server.ts');if(name==='@/lib/recruiter/validation')return validation;if(name==='@/lib/recruiter/applications')return hiring;throw Error(name);};routeModule._compile(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,import.meta.filename);return routeModule.exports;}
const recruiter=load('../../app/api/recruiter/route.ts'),jobs=load('../../app/api/recruiter/jobs/route.ts'),review=load('../../app/api/admin/company-verifications/route.ts'),verification=load('../../app/api/recruiter/verification/route.ts');
const owner='00000000-0000-4000-8000-000000000003',company='00000000-0000-4000-8000-000000000004',jobId='00000000-0000-4000-8000-000000000006';
function setup({signedIn=true,isAdmin=false,deleting=false,rpcError=null,rpcData=jobId,hasCompany=true}={}){calls=[];process.env.SUPABASE_SECRET_KEY='fixture';process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.supabase.co';client={auth:{getUser:async()=>({data:{user:signedIn?{id:owner,email:'owner@example.com',app_metadata:{role:isAdmin?'admin':'candidate'},user_metadata:{role:'admin'}}:null}})}};
admin={rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:rpcData,error:rpcError};},from(table){let filters={};const q={select(){return q;},update(value){calls.push({update:table,value});return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},or(value){calls.push({or:value});return q;},limit(){return q;},range(){return q;},maybeSingle:async()=>result(),then(resolve){resolve(result());}};function result(){calls.push({table,filters:{...filters}});if(table==='account_deletion_requests')return {data:deleting?{user_id:owner}:null};if(table==='recruiter_companies')return {data:hasCompany?{id:company,user_id:owner}:null};if(table==='resumes')return {data:{id:company,file_name:'Resume',raw_text:'Reviewed resume',parsed_data:{skills:['React']},updated_at:'2026-10-07T00:00:00Z'}};if(table==='profiles')return {data:{full_name:'Candidate',target_role:'Engineer',location:'India',experience_years:2,updated_at:'2026-10-07T00:00:00Z'}};if(table==='moderated_jobs')return {data:{...fields,id:jobId,source:'jobpilot',version:1}};return {data:[]};}return q;}};return calls;}
function request(body,method='POST',origin='https://jobpilot.test'){return new Request('https://jobpilot.test/api/recruiter',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
const companyBody={name:'Example Company',contact_name:'Example Recruiter',website:'https://example.com',evidence_url:'https://example.com/registration',details:'Registered business and authorized hiring representative.'};
const fields={title:'Software engineer',description:'Build and maintain useful software with a collaborative engineering team.',location:'India remote',country:'India',employment_type:'full-time',seniority:'senior',skills:['React'],salary_currency:'INR',application_url:'https://example.com/apply',posting_status:'draft'};
test('recruiter routes verify origin, fresh Auth, deletion freeze and admin role independently of user metadata',async()=>{
 setup();assert.equal((await recruiter.POST(request(companyBody,'POST','https://evil.test'))).status,403);assert.equal(calls.length,0);
 setup({signedIn:false});assert.equal((await recruiter.GET(new Request('https://jobpilot.test/api/recruiter'))).status,401);assert.equal(calls.length,0);
 setup({deleting:true});assert.equal((await jobs.POST(request({company_id:company,id:null,version:0,fields}))).status,409);assert.equal(calls.some(x=>x.rpc),false);
 setup();assert.equal((await review.GET(new Request('https://jobpilot.test/api/admin/company-verifications'))).status,403);assert.equal(calls.length,0);
 setup({isAdmin:true});assert.equal((await review.GET(new Request('https://jobpilot.test/api/admin/company-verifications?offset=-1'))).status,400);
});
test('onboarding, re-review and posting RPCs receive only authenticated owner identities and parsed fields',async()=>{
 setup();assert.equal((await recruiter.POST(request({...companyBody,user_id:'forged',verification_status:'verified'}))).status,201);let call=calls.find(x=>x.rpc);assert.equal(call.args.p_user,owner);assert.equal(call.args.p_domain,'example.com');assert.equal(call.args.p_verified,undefined);
 setup();assert.equal((await verification.POST(request({company_id:company,version:3,evidence_url:companyBody.evidence_url,details:companyBody.details}))).status,200);call=calls.find(x=>x.rpc);assert.equal(call.args.p_user,owner);assert.equal(call.args.p_version,3);
 setup();assert.equal((await jobs.POST(request({company_id:company,id:jobId,version:2,user_id:'forged',fields:{...fields,created_by:'forged',posting_status:'published'}}))).status,200);call=calls.find(x=>x.rpc);assert.equal(call.args.p_user,owner);assert.equal(call.args.p_version,2);assert.equal(call.args.p_fields.created_by,undefined);
 setup({rpcError:{message:'company_not_verified'}});assert.equal((await jobs.POST(request({company_id:company,id:jobId,version:2,fields:{...fields,posting_status:'published'}}))).status,409);
 setup({rpcError:{message:'posting_conflict'}});assert.equal((await jobs.POST(request({company_id:company,id:jobId,version:2,fields}))).status,409);
});
test('workspace reads are company/owner filtered and admin review binds actor plus version',async()=>{
 setup();assert.equal((await recruiter.GET(new Request('https://jobpilot.test/api/recruiter'))).status,200);assert.equal(calls.find(x=>x.table==='recruiter_companies').filters.user_id,owner);assert.equal(calls.find(x=>x.table==='jobs').filters.recruiter_company_id,company);assert.equal(calls.find(x=>x.table==='company_verification_requests').filters.user_id,owner);
 setup({isAdmin:true});assert.equal((await review.PATCH(request({id:company,version:1,decision:'approved',note:'Business and hiring authority verified',actor:'forged'},'PATCH'))).status,200);const call=calls.find(x=>x.rpc);assert.equal(call.args.p_admin,owner);assert.equal(call.args.p_version,1);
 setup({isAdmin:true});assert.equal((await review.PATCH(request({id:company,version:1,decision:'approved',note:'short'},'PATCH'))).status,400);assert.equal(calls.some(x=>x.rpc),false);
 setup();assert.equal((await recruiter.POST(request({...companyBody,details:'x'.repeat(65536)}))).status,400);assert.equal(calls.some(x=>x.rpc),false);
});

const candidateApplications=load('../../app/api/hiring-applications/route.ts'),candidatePrivacy=load('../../app/api/candidate-visibility/route.ts'),applicantReview=load('../../app/api/recruiter/applications/route.ts'),candidateProfile=load('../../app/api/recruiter/candidates/route.ts'),hiringHistory=load('../../app/api/hiring-applications/history/route.ts');
test('hiring APIs block signed-out, cross-origin and deleting accounts before data access',async()=>{
 for(const route of [candidateApplications,candidatePrivacy,applicantReview,candidateProfile,hiringHistory]){setup({signedIn:false});assert.equal((await route.GET(new Request('https://jobpilot.test/api/test'))).status,401);assert.equal(calls.length,0);}
 setup();assert.equal((await candidateApplications.POST(request({},'POST','https://evil.test'))).status,403);assert.equal(calls.length,0);
 setup({deleting:true});assert.equal((await candidatePrivacy.PATCH(request({},'PATCH'))).status,409);assert.equal(calls.some(x=>x.rpc),false);
});
test('explicit application consent is required and submitted user identity comes only from Auth',async()=>{
 const body={job_id:jobId,resume_id:company,cover_note:'Reviewed note',share_contact:false,confirmed:true,review:{resume_updated_at:'2026-10-07T00:00:00Z',profile_updated_at:'2026-10-07T00:00:00Z',job_version:1,match_score:100},user_id:'forged',company_id:'forged'};
 setup();assert.equal((await candidateApplications.POST(request({...body,confirmed:false}))).status,400);assert.equal(calls.some(x=>x.rpc),false);
 setup();assert.equal((await candidateApplications.POST(request(body))).status,201);assert.deepEqual(calls.at(-1),{rpc:'submit_employer_application',args:{p_user:owner,p_job:jobId,p_resume:company,p_note:'Reviewed note',p_contact:false,p_review:{resume_updated_at:body.review.resume_updated_at,profile_updated_at:body.review.profile_updated_at,job_version:1,match_score:scorer.calculateMatchScore(fields,{target_role:'Engineer',location:'India',experience_years:2,skills:scorer.getResumeSkills({skills:['React']})},{preferred_roles:[],preferred_locations:[],remote_only:false,employment_types:[],minimum_salary:null,preferred_countries:[]}).score}}});
 setup({rpcError:{message:'job_unavailable'}});assert.equal((await candidateApplications.POST(request(body))).status,409);
 setup({rpcError:{message:'application_limit'}});assert.equal((await candidateApplications.POST(request(body))).status,429);
});
test('privacy and withdrawal carry versions, own identity and bounded whitelisted values',async()=>{
 setup();assert.equal((await candidatePrivacy.PATCH(request({version:0,discoverable:true,share_contact:false,resume_id:null,user_id:'forged'},'PATCH'))).status,200);assert.deepEqual(calls.at(-1).args,{p_user:owner,p_version:0,p_discoverable:true,p_contact:false,p_resume:null,p_anonymous:false,p_featured:false});
 setup();assert.equal((await candidateApplications.PATCH(request({id:jobId,version:2,confirmation:'WITHDRAW',status:'offer',user_id:'forged'},'PATCH'))).status,200);assert.equal(calls.at(-1).args.p_user,owner);assert.equal(calls.at(-1).args.p_status,'withdrawn');assert.equal(calls.at(-1).args.p_withdraw,true);
 setup();assert.equal((await candidateApplications.PATCH(request({id:jobId,version:2},'PATCH'))).status,400);assert.equal(calls.some(x=>x.rpc),false);
 setup();assert.equal((await candidatePrivacy.PATCH(request({version:0,discoverable:'yes',share_contact:false,resume_id:null},'PATCH'))).status,400);
});
test('recruiter reviews cannot forge actors or arbitrary stages, note size and version are bounded',async()=>{
 const body={id:jobId,version:1,status:'screening',shortlisted:true,note:'Reviewed',user_id:'forged'};
 setup();assert.equal((await applicantReview.PATCH(request(body,'PATCH'))).status,200);assert.deepEqual(calls.at(-1).args,{p_user:owner,p_application:jobId,p_version:1,p_status:'screening',p_shortlisted:true,p_note:'Reviewed',p_withdraw:false});
 for(const change of [{version:0},{status:'withdrawn'},{note:'x'.repeat(1001)},{shortlisted:'true'}]){setup();assert.equal((await applicantReview.PATCH(request({...body,...change},'PATCH'))).status,400);assert.equal(calls.some(x=>x.rpc),false);}
 setup({rpcError:{message:'application_conflict'}});assert.equal((await applicantReview.PATCH(request(body,'PATCH'))).status,409);
});
test('candidate history is owner-filtered and recruiter lists/detail access are server-scoped',async()=>{
 setup();assert.equal((await hiringHistory.GET(new Request(`https://jobpilot.test/api/test?id=${jobId}`))).status,200);assert.equal(calls.find(x=>x.table==='employer_application_events').filters.user_id,owner);
 setup();assert.equal((await hiringHistory.GET(new Request(`https://jobpilot.test/api/test?id=${jobId}&before=9999999999999999999`))).status,400);
 setup({rpcData:{applications:[],counts:{applied:0},recent_activity:[]}});assert.equal((await applicantReview.GET(new Request('https://jobpilot.test/api/test?shortlisted=true&offset=50'))).status,200);assert.equal(calls.at(-1).args.p_user,owner);assert.equal(calls.at(-1).args.p_shortlisted,true);
 setup({rpcData:null});assert.equal((await applicantReview.GET(new Request(`https://jobpilot.test/api/test?id=${jobId}`))).status,404);
 setup({rpcData:null});assert.equal((await candidateProfile.GET(new Request(`https://jobpilot.test/api/test?id=${company}`))).status,404);
});

test('review snapshots and score filters reject missing or forged review inputs',async()=>{
 setup();assert.equal((await candidateApplications.POST(request({job_id:jobId,resume_id:company,confirmed:true,share_contact:false,cover_note:''}))).status,400);assert.equal(calls.some(x=>x.rpc),false);
 setup();assert.equal((await candidateApplications.GET(new Request(`https://jobpilot.test/api/test?job_id=${jobId}&preview_resume=${company}`))).status,200);assert.equal(calls.find(x=>x.table==='resumes').filters.user_id,owner);
 setup();assert.equal((await applicantReview.GET(new Request('https://jobpilot.test/api/test?min_score=101'))).status,400);
 setup({rpcData:{applications:[]}});assert.equal((await applicantReview.GET(new Request('https://jobpilot.test/api/test?min_score=70'))).status,200);assert.equal(calls.at(-1).args.p_min_score,70);
});

const messages=load('../../app/api/hiring-messages/route.ts'),invitations=load('../../app/api/hiring-invitations/route.ts'),notices=load('../../app/api/hiring-notifications/route.ts'),branding=load('../../app/api/recruiter/branding/route.ts'),operations=load('../../app/api/admin/operations/route.ts'),employers=load('../../app/api/employers/[id]/route.ts');
test('new hiring and operations APIs enforce fresh Auth, origin, admin claims and deletion freeze',async()=>{
 for(const route of [messages,notices,branding,operations]){setup({signedIn:false});assert.equal((await route.GET(new Request('https://jobpilot.test/api/test'))).status,401);assert.equal(calls.length,0);}
 setup({signedIn:false});assert.equal((await employers.GET(new Request('https://jobpilot.test/api/test'),{params:Promise.resolve({id:company})})).status,401);
 setup();assert.equal((await operations.GET(new Request('https://jobpilot.test/api/test'))).status,403);
 setup();assert.equal((await invitations.POST(request({},'POST','https://foreign.test'))).status,403);assert.equal(calls.length,0);
 setup({deleting:true});assert.equal((await messages.POST(request({}))).status,409);assert.equal(calls.some(call=>call.rpc),false);
});
test('sourcing search has bounded literal filters and private notes bind only the authenticated company owner',async()=>{
 setup({rpcData:[]});assert.equal((await candidateProfile.GET(new Request('https://jobpilot.test/api/test?role=Engineer&skill=React&experience=3&shortlists=true'))).status,200);assert.deepEqual(calls.at(-1).args,{p_user:owner,p_role:'Engineer',p_location:null,p_skill:'React',p_experience:3,p_offset:0,p_shortlists:true});
 setup();assert.equal((await candidateProfile.GET(new Request('https://jobpilot.test/api/test?experience=81'))).status,400);
 setup();assert.equal((await candidateProfile.PATCH(request({candidate_id:company,version:0,status:'shortlist',notes:'Private note',user_id:'forged'},'PATCH'))).status,200);assert.equal(calls.at(-1).args.p_user,owner);assert.equal(calls.at(-1).args.p_notes,'Private note');
 setup({rpcData:{full_name:'Opted-in candidate',resume_text:'Shared text'}});assert.equal((await candidateProfile.GET(new Request(`https://jobpilot.test/api/test?id=${company}`))).status,200);assert.equal(calls.at(-1).rpc,'record_hiring_view');assert.equal(calls.at(-1).args.p_resume,true);
});
test('messages bind sender and participant checks precede scoped content reads',async()=>{
 setup();assert.equal((await messages.POST(request({id:jobId,thread_id:company,message:'Hello',sender_id:'forged'}))).status,200);assert.deepEqual(calls.at(-1).args,{p_user:owner,p_thread:company,p_id:jobId,p_body:'Hello'});
 setup();assert.equal((await messages.POST(request({id:jobId,thread_id:company,message:'x'.repeat(4001)}))).status,400);assert.equal(calls.some(call=>call.rpc),false);
 setup({rpcError:{message:'application_unavailable'}});assert.equal((await messages.GET(new Request(`https://jobpilot.test/api/test?thread=${company}`))).status,403);assert.equal(calls.some(call=>call.table==='hiring_messages'),false);
 setup({rpcData:{is_candidate:true,can_send:true}});assert.equal((await messages.GET(new Request(`https://jobpilot.test/api/test?thread=${company}`))).status,200);assert.equal(calls.find(call=>call.table==='hiring_messages').filters.thread_id,company);
 setup();assert.equal((await messages.PATCH(request({thread_id:company,blocked:true},'PATCH'))).status,200);assert.equal(calls.at(-1).args.p_user,owner);
});
test('interview scheduling validates confirmed timezone, future time, versions and candidate actions',async()=>{
 const fields={id:jobId,thread_id:company,job_id:jobId,version:0,round:'Technical',local_time:new Date(Date.now()+2*86400000).toISOString().slice(0,16),timezone:'UTC',duration_minutes:30,location:'Video',notes:'Prepare project discussion'};
 setup();assert.equal((await invitations.POST(request(fields))).status,200);assert.equal(calls.at(-1).rpc,'save_hiring_invitation');assert.equal(calls.at(-1).args.p_user,owner);assert.equal(calls.at(-1).args.p_fields.starts_at,fields.local_time+':00.000Z');
 setup();assert.equal((await invitations.POST(request({...fields,timezone:'Invalid/Zone'}))).status,400);
 setup();assert.equal((await invitations.PATCH(request({id:jobId,version:1,status:'accepted',response:'Confirmed',candidate_id:'forged'},'PATCH'))).status,200);assert.equal(calls.at(-1).args.p_user,owner);
 setup();assert.equal((await invitations.PATCH(request({id:jobId,version:1,status:'arbitrary',response:''},'PATCH'))).status,400);
});
test('branding accepts only plain bounded fields and account reviews require fresh trusted admin identity',async()=>{
 const fields={version:0,tagline:'Build useful products',about:'Employer description',culture:'Practical teams',perks:['Flexible work'],tech_stack:['React'],leadership:[{name:'Leader',role:'Founder'}],banner_style:'blue',published:true,user_id:'forged'};
 setup();assert.equal((await branding.PATCH(request(fields,'PATCH'))).status,200);assert.equal(calls.at(-1).args.p_user,owner);assert.equal(calls.at(-1).args.p_fields.user_id,undefined);
 setup();assert.equal((await branding.PATCH(request({...fields,perks:Array(21).fill('Perk')},'PATCH'))).status,400);
 setup();assert.equal((await operations.PATCH(request({user_id:company,version:0,status:'review_needed',notes:'Support follow-up'},'PATCH'))).status,403);
 setup({isAdmin:true});assert.equal((await operations.PATCH(request({user_id:company,version:0,status:'review_needed',notes:'Support follow-up',actor_id:'forged'},'PATCH'))).status,200);assert.equal(calls.at(-1).args.p_actor,owner);
 setup();assert.equal((await notices.GET(new Request('https://jobpilot.test/api/test'))).status,200);assert.equal(calls.find(call=>call.table==='hiring_notifications').filters.user_id,owner);
});

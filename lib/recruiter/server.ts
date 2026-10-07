import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function recruiterContext(request?:Request,adminOnly=false){
  if(request&&(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site'))return {response:json({error:'This request must come from JobPilot.'},403)};
  const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return {response:json({error:'Sign in to continue.'},401)};
  if(adminOnly&&user.app_metadata?.role!=='admin')return {response:json({error:'Admin access required.'},403)};
  if(!process.env.SUPABASE_SECRET_KEY)return {response:json({error:'Recruiter features are not available yet.'},503)};
  const admin=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const deletion=await admin.from('account_deletion_requests').select('user_id').eq('user_id',user.id).maybeSingle();
  if(deletion.error)return {response:json({error:'Unable to verify account access.'},503)};
  if(deletion.data)return {response:json({error:'This account is being deleted.'},409)};
  return {user,admin};
}
export async function requestBody(request:Request){
  const reader=request.body?.getReader();if(!reader)throw Error('Invalid request.');const chunks:Uint8Array[]=[];let length=0;
  for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536){await reader.cancel();throw Error('Request too large.');}chunks.push(value);}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Error('Invalid request.');}
}
export function mutationError(error:{message:string;code?:string}){
  const hiring:Record<string,[string,number]>={account_unavailable:['This account is unavailable.',409],confirm_email:['Confirm your email before submitting.',409],job_unavailable:['This job is not accepting applications.',409],application_limit:['Maximum 20 applications per day. Try again later.',429],invalid_application:['Review your resume, profile and application details.',400],application_unavailable:['Application access is unavailable.',403],application_conflict:['This application changed. Reload before saving.',409],invalid_transition:['This stage is final or the requested transition is invalid.',409],visibility_conflict:['Privacy settings changed. Reload before saving.',409],invalid_visibility:['Select your own saved resume and valid privacy settings.',400]};
  if(error.message==='application_preview_changed')return json({error:'Your resume, profile or job changed. Review the current details before submitting.'},409);
  if(hiring[error.message])return json({error:hiring[error.message][0]},hiring[error.message][1]);
  if(error.message==='review_limit')return json({error:'Maximum 100 updates per applicant per day. Try again later.'},429);
  const messages:Record<string,string>={company_not_verified:'Company approval is required before publishing.',posting_conflict:'This posting changed. Reload and try again.',posting_closed:'Closed jobs cannot be reopened. Create a new draft.',verification_conflict:'This verification changed. Reload and try again.',verification_limit:'Up to three verification requests per day.',posting_limit:'Close an old posting before creating more. Maximum 100 open postings.',recruiter_confirm_email:'Confirm your account email before registering your company.',draft_required:'New postings must be saved as a draft first.'};
  return json({error:messages[error.message]||(error.code==='23505'?'This account or company domain is already registered.':'Unable to save this change. Please reload and try again.')},error.code==='23505'||messages[error.message]?409:503);
}

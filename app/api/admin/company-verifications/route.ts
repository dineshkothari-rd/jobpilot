import { json, mutationError, recruiterContext, requestBody } from '@/lib/recruiter/server';
import { uuid, version } from '@/lib/recruiter/validation';
export async function GET(request:Request){
  try{const context=await recruiterContext(undefined,true);if(context.response)return context.response;const url=new URL(request.url);const raw=url.searchParams.get('offset')||'0';if(!/^\d{1,8}$/.test(raw))return json({error:'Invalid page.'},400);const offset=Number(raw);
    const result=await context.admin.from('company_verification_requests').select('*,recruiter_companies!inner(id,name,domain,website,contact_name,contact_email,corporate_email_verified,verification_status)').order('created_at',{ascending:false}).order('id').range(offset,offset+49);
    return result.error?json({error:'Unable to load company verification queue.'},503):json({requests:result.data||[],has_more:result.data?.length===50});
  }catch{return json({error:'Unable to load company verification queue.'},503);}
}
export async function PATCH(request:Request){
  try{const context=await recruiterContext(request,true);if(context.response)return context.response;let body,id,v;try{body=await requestBody(request);id=uuid(body.id);v=version(body.version);if(!['approved','rejected','revoked'].includes(body.decision)||typeof body.note!=='string'||body.note.trim().length<10||body.note.length>2000)throw Error('Choose a decision and provide a 10–2,000 character review note.');}catch(cause){return json({error:(cause as Error).message},400);}
    const {error}=await context.admin.rpc('review_company_verification',{p_admin:context.user.id,p_request:id,p_version:v,p_decision:body.decision,p_note:body.note.trim()});return error?mutationError(error):json({reviewed:true});
  }catch{return json({error:'Unable to review company verification.'},503);}
}

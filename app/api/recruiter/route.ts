import { json, mutationError, recruiterContext, requestBody } from '@/lib/recruiter/server';
import { parseCompany } from '@/lib/recruiter/validation';
export async function GET(request:Request){
  try{const context=await recruiterContext();if(context.response)return context.response;const {admin,user}=context;
    const raw=new URL(request.url).searchParams.get('offset')||'0';if(!/^\d{1,8}$/.test(raw))return json({error:'Invalid page.'},400);const offset=Number(raw);
    const company=await admin.from('recruiter_companies').select('*').eq('user_id',user.id).maybeSingle();if(company.error)return json({error:'Recruiter features are not available yet.'},503);
    if(!company.data)return json({company:null,jobs:[],verifications:[]});
    const [jobs,verifications]=await Promise.all([admin.from('jobs').select('*').eq('recruiter_company_id',company.data.id).order('updated_at',{ascending:false}).order('id').range(offset,offset+49),admin.from('company_verification_requests').select('*').eq('company_id',company.data.id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(50)]);
    if(jobs.error||verifications.error)return json({error:'Unable to load recruiter workspace.'},503);
    const summaries=await Promise.all(['published','draft','paused','closed'].map(status=>admin.from('jobs').select('id',{count:'exact',head:true}).eq('recruiter_company_id',company.data.id).eq('posting_status',status)));
    if(summaries.some(result=>result.error))return json({error:'Unable to load posting metrics.'},503);
    const counts=Object.fromEntries(['published','draft','paused','closed'].map((status,index)=>[status,summaries[index].count||0]));
    return json({company:company.data,jobs:jobs.data||[],counts,has_more:jobs.data?.length===50,verifications:verifications.data||[],applicant_pipeline_available:false});
  }catch{return json({error:'Unable to load recruiter workspace.'},503);}
}
export async function POST(request:Request){
  try{const context=await recruiterContext(request);if(context.response)return context.response;let value;try{value=parseCompany(await requestBody(request));}catch(cause){return json({error:(cause as Error).message},400);}
    const {error}=await context.admin.rpc('register_recruiter',{p_user:context.user.id,p_name:value.name,p_domain:value.domain,p_contact:value.contact_name,p_website:value.website,p_evidence:value.evidence_url,p_details:value.details});
    return error?mutationError(error):json({registered:true},201);
  }catch{return json({error:'Unable to register company.'},503);}
}

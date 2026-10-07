import { json, mutationError, recruiterContext, requestBody } from '@/lib/recruiter/server';
import { hiringStages, reviewInput } from '@/lib/recruiter/applications';
import { uuid } from '@/lib/recruiter/validation';
export async function GET(request:Request){
  try{const context=await recruiterContext();if(context.response)return context.response;const params=new URL(request.url).searchParams;
    if(params.has('id')){let id;try{id=uuid(params.get('id'));}catch{return json({error:'Invalid application.'},400);}const {data,error}=await context.admin.rpc('get_recruiter_application',{p_user:context.user.id,p_application:id});return error?mutationError(error):data?json({application:data}):json({error:'Application not found.'},404);}
    let job,status,shortlisted,offset,minScore;try{job=params.get('job_id');if(job)uuid(job);status=params.get('status');if(status&&!hiringStages.includes(status as typeof hiringStages[number]))throw Error();const shortlist=params.get('shortlisted');if(shortlist!==null&&!['true','false'].includes(shortlist))throw Error();shortlisted=shortlist===null?null:shortlist==='true';const raw=params.get('offset')||'0';if(!/^\d{1,6}$/.test(raw)||Number(raw)>100000)throw Error();offset=Number(raw);const minimum=params.get('min_score');if(minimum!==null&&(!/^\d{1,3}$/.test(minimum)||Number(minimum)>100))throw Error();minScore=minimum===null?null:Number(minimum);}catch{return json({error:'Invalid applicant filters.'},400);}
    const {data,error}=await context.admin.rpc('get_recruiter_applications',{p_user:context.user.id,p_job:job,p_status:status,p_shortlisted:shortlisted,p_offset:offset,p_min_score:minScore});if(error)return mutationError(error);return json({...data,applications:(data.applications||[]).slice(0,50),has_more:(data.applications?.length||0)>50});
  }catch{return json({error:'Unable to load applicants.'},503);}
}
export async function PATCH(request:Request){
  try{const context=await recruiterContext(request);if(context.response)return context.response;let fields;try{fields=reviewInput(await requestBody(request));}catch(cause){return json({error:(cause as Error).message},400);}
    const {error}=await context.admin.rpc('update_employer_application',{p_user:context.user.id,p_application:fields.id,p_version:fields.version,p_status:fields.status,p_shortlisted:fields.shortlisted,p_note:fields.note,p_withdraw:false});return error?mutationError(error):json({saved:true});
  }catch{return json({error:'Unable to update application.'},503);}
}

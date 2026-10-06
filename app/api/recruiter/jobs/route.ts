import { json, mutationError, recruiterContext, requestBody } from '@/lib/recruiter/server';
import { parsePosting, uuid, version } from '@/lib/recruiter/validation';
export async function POST(request:Request){
  try{const context=await recruiterContext(request);if(context.response)return context.response;let body,fields,company,id,v;try{body=await requestBody(request);fields=parsePosting(body.fields);company=uuid(body.company_id);id=body.id?uuid(body.id):null;v=id?version(body.version):0;if(!id&&body.version!==0)throw Error('New posting version must be zero.');}catch(cause){return json({error:(cause as Error).message},400);}
    const {data,error}=await context.admin.rpc('save_recruiter_job',{p_user:context.user.id,p_company:company,p_job:id,p_version:v,p_fields:fields});return error?mutationError(error):json({id:data},id?200:201);
  }catch{return json({error:'Unable to save job posting.'},503);}
}

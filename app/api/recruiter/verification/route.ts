import { json, mutationError, recruiterContext, requestBody } from '@/lib/recruiter/server';
import { parseEvidence, uuid, version } from '@/lib/recruiter/validation';
export async function POST(request:Request){
  try{const context=await recruiterContext(request);if(context.response)return context.response;let body,value,id,v;try{body=await requestBody(request);value=parseEvidence(body);id=uuid(body.company_id);v=version(body.version);}catch(cause){return json({error:(cause as Error).message},400);}
    const {error}=await context.admin.rpc('request_company_verification',{p_user:context.user.id,p_company:id,p_version:v,p_evidence:value.evidence_url,p_details:value.details});return error?mutationError(error):json({submitted:true});
  }catch{return json({error:'Unable to request company verification.'},503);}
}

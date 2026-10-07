import { json, mutationError, recruiterContext } from '@/lib/recruiter/server';
import { uuid } from '@/lib/recruiter/validation';
export async function GET(request:Request){
  try{const context=await recruiterContext();if(context.response)return context.response;let candidate;try{candidate=uuid(new URL(request.url).searchParams.get('id'));}catch{return json({error:'Invalid candidate.'},400);}
    const {data,error}=await context.admin.rpc('get_recruiter_candidate_profile',{p_user:context.user.id,p_candidate:candidate});return error?mutationError(error):data?json({profile:data}):json({error:'This candidate has not shared a discoverable profile.'},404);
  }catch{return json({error:'Unable to load candidate profile.'},503);}
}

import { json, mutationError, recruiterContext, requestBody } from '@/lib/recruiter/server';
import { visibilityInput } from '@/lib/recruiter/applications';
export async function GET(){
  try{const context=await recruiterContext();if(context.response)return context.response;const [settings,resumes,profile]=await Promise.all([context.admin.from('candidate_visibility').select('*').eq('user_id',context.user.id).maybeSingle(),context.admin.from('resumes').select('id,file_name').eq('user_id',context.user.id).order('created_at',{ascending:false}).limit(100),context.admin.from('profiles').select('full_name,target_role,location,experience_years').eq('id',context.user.id).maybeSingle()]);
    if(settings.error||resumes.error||profile.error)return json({error:'Recruiter privacy controls are not available yet.'},503);return json({settings:settings.data||{version:0,anonymous:false,discoverable:false,share_contact:false,resume_id:null},resumes:resumes.data||[],profile:profile.data});
  }catch{return json({error:'Unable to load privacy settings.'},503);}
}
export async function PATCH(request:Request){
  try{const context=await recruiterContext(request);if(context.response)return context.response;let fields;try{fields=visibilityInput(await requestBody(request));}catch(cause){return json({error:(cause as Error).message},400);}
    const {error}=await context.admin.rpc('set_candidate_visibility',{p_user:context.user.id,p_version:fields.version,p_discoverable:fields.discoverable,p_contact:fields.contact,p_resume:fields.resume,p_anonymous:fields.anonymous,p_featured:fields.featured});return error?mutationError(error):json({saved:true});
  }catch{return json({error:'Unable to save privacy settings.'},503);}
}

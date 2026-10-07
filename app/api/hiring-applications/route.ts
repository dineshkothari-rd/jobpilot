import { json, mutationError, recruiterContext, requestBody } from '@/lib/recruiter/server';
import { applicationInput, hiringInput } from '@/lib/recruiter/applications';
import { calculateMatchScore,getResumeSkills } from '@/lib/matching/scorer';
import { uuid, version } from '@/lib/recruiter/validation';
export async function GET(request:Request){
  try{const context=await recruiterContext();if(context.response)return context.response;
    const params=new URL(request.url).searchParams,job=params.get('job_id');let offset=0;try{if(job)uuid(job);const raw=params.get('offset')||'0';if(!/^\d{1,6}$/.test(raw)||Number(raw)>100000)throw Error();offset=Number(raw);}catch{return json({error:'Invalid page or job.'},400);}
    if(params.has('preview_resume')){let resumeId;try{resumeId=uuid(params.get('preview_resume'));if(!job)throw Error();}catch{return json({error:'Select a job and your own resume.'},400);}
      const [resume,profile,listing]=await Promise.all([context.admin.from('resumes').select('id,file_name,raw_text,updated_at').eq('user_id',context.user.id).eq('id',resumeId).maybeSingle(),context.admin.from('profiles').select('full_name,target_role,location,updated_at').eq('id',context.user.id).maybeSingle(),context.admin.from('moderated_jobs').select('id,title,company_name,version,source').eq('id',job).maybeSingle()]);
      if(resume.error||profile.error||listing.error)return json({error:'Unable to review this application.'},503);if(!resume.data||!profile.data||!listing.data||listing.data.source!=='jobpilot')return json({error:'Resume or direct job not found.'},404);
      if(typeof resume.data.raw_text!=='string'||!resume.data.raw_text.trim()||resume.data.raw_text.length>250000)return json({error:'Select a readable resume under the sharing limit.'},400);
      return json({resume:resume.data,profile:profile.data,job:listing.data,account_email:context.user.email});
    }
    let query=context.admin.from('employer_applications').select('id,job_id,job_title,company_name,status,shortlisted,version,submitted_at,updated_at').eq('user_id',context.user.id).order('submitted_at',{ascending:false}).order('id').range(offset,offset+50);if(job)query=query.eq('job_id',job);
    const [applications,resumes]=await Promise.all([query,context.admin.from('resumes').select('id,file_name,is_primary').eq('user_id',context.user.id).order('created_at',{ascending:false}).limit(100)]);
    if(applications.error||resumes.error)return json({error:'Direct applications are not available yet.'},503);
    return json({applications:(applications.data||[]).slice(0,50),has_more:(applications.data?.length||0)>50,resumes:resumes.data||[]});
  }catch{return json({error:'Unable to load direct applications.'},503);}
}
export async function POST(request:Request){
  try{const context=await recruiterContext(request);if(context.response)return context.response;let fields;try{fields=applicationInput(await requestBody(request));}catch(cause){return json({error:(cause as Error).message},400);}
    const [resume,profile,job]=await Promise.all([context.admin.from('resumes').select('parsed_data').eq('user_id',context.user.id).eq('id',fields.resume).maybeSingle(),context.admin.from('profiles').select('target_role,location,experience_years').eq('id',context.user.id).maybeSingle(),context.admin.from('moderated_jobs').select('title,description,location,country,employment_type,seniority,salary_min,salary_max,skills').eq('id',fields.job).maybeSingle()]);
    if(resume.error||profile.error||job.error)return json({error:'Unable to verify this application.'},503);if(!resume.data||!profile.data||!job.data)return json({error:'Resume, profile or job unavailable.'},409);
    const match=calculateMatchScore(job.data,{...profile.data,skills:getResumeSkills(resume.data.parsed_data)},{preferred_roles:[],preferred_locations:[],remote_only:false,employment_types:[],minimum_salary:null,preferred_countries:[]});
    const {data,error}=await context.admin.rpc('submit_employer_application' ,{p_user:context.user.id,p_job:fields.job,p_resume:fields.resume,p_note:fields.note,p_contact:fields.contact,p_review:{...fields.review,match_score:match.score}});return error?mutationError(error):json({id:data,submitted:true},201);
  }catch{return json({error:'Unable to submit your application. Your draft has been kept.'},503);}
}
export async function PATCH(request:Request){
  try{const context=await recruiterContext(request);if(context.response)return context.response;let id,v;try{const body=hiringInput(await requestBody(request));if(body.confirmation!=='WITHDRAW')throw Error('Confirm withdrawal.');id=uuid(body.id);v=version(body.version);}catch(cause){return json({error:(cause as Error).message},400);}
    const {error}=await context.admin.rpc('update_employer_application',{p_user:context.user.id,p_application:id,p_version:v,p_status:'withdrawn',p_shortlisted:false,p_note:'Candidate withdrew; shared resume and contact details were removed.',p_withdraw:true});return error?mutationError(error):json({withdrawn:true});
  }catch{return json({error:'Unable to withdraw your application.'},503);}
}

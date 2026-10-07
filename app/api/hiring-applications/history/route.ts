import { json, recruiterContext } from '@/lib/recruiter/server';
import { uuid } from '@/lib/recruiter/validation';
export async function GET(request:Request){
  try{const context=await recruiterContext();if(context.response)return context.response;const params=new URL(request.url).searchParams;let id;const before=params.get('before');try{id=uuid(params.get('id'));if(before&&(!/^[1-9]\d{0,18}$/.test(before)||BigInt(before)>BigInt('9223372036854775807')))throw Error();}catch{return json({error:'Invalid history request.'},400);}
    let query=context.admin.from('employer_application_events').select('id,actor,status,shortlisted,note,created_at').eq('application_id',id).eq('user_id',context.user.id).order('id',{ascending:false}).limit(51);if(before)query=query.lt('id',before);const {data,error}=await query;
    return error?json({error:'Unable to load history.'},503):json({events:(data||[]).slice(0,50),has_more:(data?.length||0)>50});
  }catch{return json({error:'Unable to load history.'},503);}
}

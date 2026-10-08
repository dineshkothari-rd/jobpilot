import { createClient } from '@/lib/supabase/server';
import { reminderConfiguration } from '@/lib/notifications/reminders';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
  try {
    const client=await createClient();const {data:{user},error}=await client.auth.getUser();
    if(error||!user)return json({error:'Sign in to manage job alerts.'},401);
    const {data,error:readError}=await client.from('job_alert_preferences').select('email_enabled,push_enabled').eq('user_id',user.id).maybeSingle();
    if(readError)return json({error:'Job alerts are not available yet.'},503);
    const config=reminderConfiguration();return json({preferences:data,availability:{email:config.email&&Boolean(user.email_confirmed_at),push:config.push}});
  }catch{return json({error:'Unable to load job alerts.'},503);}
}
export async function PATCH(request:Request){
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'This request must come from Parth Careers.'},403);
    const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return json({error:'Sign in to manage job alerts.'},401);
    const reader=request.body?.getReader();if(!reader)return json({error:'Invalid preferences.'},400);
    const chunks:Uint8Array[]=[];let length=0;
    for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>1024){await reader.cancel();return json({error:'Request too large.'},413);}chunks.push(value);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return json({error:'Invalid preferences.'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['email_enabled','push_enabled'].includes(k))||typeof body.email_enabled!=='boolean'||typeof body.push_enabled!=='boolean')return json({error:'Invalid preferences.'},400);
    const config=reminderConfiguration();if(body.email_enabled&&(!config.email||!user.email_confirmed_at)||body.push_enabled&&!config.push)return json({error:'This channel is not configured or your email is not confirmed.'},409);
    const {error:writeError}=await client.from('job_alert_preferences').upsert({user_id:user.id,email_enabled:body.email_enabled,push_enabled:body.push_enabled},{onConflict:'user_id'});
    return writeError?json({error:'Unable to save job alerts.'},503):json({saved:true});
  }catch{return json({error:'Unable to save job alerts.'},503);}
}

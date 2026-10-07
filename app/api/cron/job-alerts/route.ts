import { monitoredCron } from "@/lib/operations/cron";
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authorizedCron } from '@/lib/autopilot/schedule';
import { reminderConfiguration } from '@/lib/notifications/reminders';
import { claimDelivery, sendEmail, sendPush } from '@/lib/notifications/delivery';
import { alertDigest, matchesSavedSearch, type AlertJob } from '@/lib/notifications/job-alerts';
import { calculateMatchScore, getResumeSkills } from '@/lib/matching/scorer';
export const runtime='nodejs';export const maxDuration=300;
async function run(request:Request){
  const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(!authorizedCron(request.headers.get('authorization'),process.env.CRON_SECRET))return json({error:'Unauthorized'},401);
  const config=reminderConfiguration();if(!config.email&&!config.push)return json({skipped:'Job alert providers are not configured.'});
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const now=new Date();const day=now.toISOString().slice(0,10),deadline=Date.now()+240_000;let sent=0,failed=0;
  try {
    // ponytail: four-minute paginated daily worker; introduce a resumable queue if this budget is exceeded.
    for(let offset=0;;offset+=100){
      const prefs=await admin.from('job_alert_preferences').select('*').or('email_enabled.eq.true,push_enabled.eq.true').order('user_id').range(offset,offset+99);if(prefs.error)throw Error('Preferences unavailable');
      for(const pref of prefs.data||[]){
        if(Date.now()>=deadline)return json({sent,failed,incomplete:true},503);
        try {
          const deletion=await admin.from('account_deletion_requests').select('user_id').eq('user_id',pref.user_id).maybeSingle();if(deletion.error)throw Error('Deletion check failed');if(deletion.data)continue;
          let run=await admin.from('job_alert_runs').select('*').eq('user_id',pref.user_id).eq('run_day',day).maybeSingle();if(run.error)throw Error('Digest unavailable');
          if(!run.data){
            const [searches,profile,preferences,resume,last]=await Promise.all([
              admin.from('saved_searches').select('criteria').eq('user_id',pref.user_id).order('id').limit(101),
              admin.from('profiles').select('target_role,experience_years,location,current_company').eq('id',pref.user_id).maybeSingle(),
              admin.from('job_preferences').select('*').eq('user_id',pref.user_id).maybeSingle(),
              admin.from('resumes').select('parsed_data').eq('user_id',pref.user_id).eq('is_primary',true).order('created_at',{ascending:false}).limit(1).maybeSingle(),
              admin.from('job_alert_runs').select('window_end').eq('user_id',pref.user_id).order('window_end',{ascending:false}).limit(1).maybeSingle(),
            ]);
            if([searches,profile,preferences,resume,last].some(x=>x.error))throw Error('Matching data unavailable');
            if(!profile.data||!preferences.data||!searches.data?.length)continue;
            // ponytail: 100 searches / 5,000 newly ingested rows per account; fail without advancing the window if exceeded.
            if(searches.data.length>100)throw Error('Search ceiling exceeded');
            const since=last.data?.window_end&&Date.parse(last.data.window_end)>Date.parse(pref.enabled_at)?last.data.window_end:pref.enabled_at;const jobs:AlertJob[]=[];
            for(let page=0;;page+=500){
              if(Date.now()>=deadline)throw Error('Scan budget exceeded');
              const rows=await admin.from('moderated_jobs').select('*').is('created_by',null).gt('alert_available_at',since).lte('alert_available_at',now.toISOString()).or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`).order('alert_available_at').order('id').range(page,page+499);
              if(rows.error)throw Error('Jobs unavailable');
              if(page>=5000&&rows.data?.length)throw Error('Scan ceiling exceeded');
              for(const job of rows.data||[]){
                const excluded=(profile.data.current_company||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(excluded&&(job.company_name||'').toLowerCase().replace(/[^a-z0-9]/g,'')===excluded)continue;
                const scored={...job,match_score:calculateMatchScore(job,{...profile.data,skills:getResumeSkills(resume.data?.parsed_data)},preferences.data).score} as AlertJob;
                if(searches.data.some(search=>matchesSavedSearch(scored,search.criteria,preferences.data!.minimum_match_score??70,now.getTime())))jobs.push(scored);
              }
              if(!rows.data||rows.data.length<500)break;
            }
            jobs.sort((a,b)=>b.match_score-a.match_score||a.id.localeCompare(b.id));
            const saved=await admin.from('job_alert_runs').upsert({user_id:pref.user_id,run_day:day,window_end:now.toISOString(),job_ids:jobs.map(j=>j.id),digest:alertDigest(jobs,config.siteUrl)},{onConflict:'user_id,run_day',ignoreDuplicates:true});if(saved.error)throw Error('Digest save failed');
            run=await admin.from('job_alert_runs').select('*').eq('user_id',pref.user_id).eq('run_day',day).single();if(run.error)throw Error('Digest unavailable');
          }
          if(!run.data?.job_ids.length || Date.parse(run.data.window_end)<Date.parse(pref.enabled_at))continue;
          // Never email a frozen snapshot whose visible listings have since been removed or moderated.
          const visible=await admin.from('moderated_jobs').select('id').in('id',run.data.job_ids.slice(0,20)).or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
          if(visible.error)throw Error('Digest visibility unavailable');
          if(visible.data?.length!==Math.min(run.data.job_ids.length,20))continue;
          if(pref.email_enabled&&config.email){try{const {data:{user},error}=await admin.auth.admin.getUserById(pref.user_id);if(error)throw Error('Account unavailable');if(user?.email&&user.email_confirmed_at&&await claimDelivery(admin,'job_alert',pref.user_id,day,'email','email',()=>sendEmail(user.email!,'Your JobPilot saved-search job digest',run.data!.digest,`job-alert/${pref.user_id}/${day}`)))sent++;}catch{failed++;}}
          if(pref.push_enabled&&config.push){const devices=await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',pref.user_id);if(devices.error)throw Error('Devices unavailable');for(const device of devices.data||[]){if(Date.now()>=deadline)return json({sent,failed,incomplete:true},503);try{if(await claimDelivery(admin,'job_alert',pref.user_id,day,'push',device.id,()=>sendPush(admin,pref.user_id,device,'jobs',day)))sent++;}catch{failed++;}}}
        }catch{failed++;}
      }
      if(!prefs.data||prefs.data.length<100)break;
    }
    return json({sent,failed},failed?503:200);
  }catch{return json({error:'Job alert run failed.',sent,failed},503);}
}

export async function GET(request: Request) {
  return monitoredCron(request, "job_alerts", () => run(request));
}

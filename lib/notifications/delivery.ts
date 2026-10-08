import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';
import { parseSubscription, reminderConfiguration } from './reminders';
export async function sendEmail(to: string, subject: string, text: string, key: string) {
  if(process.env.EMAIL_DELIVERY_ENABLED!=='true')throw Error('Email delivery is disabled until its sender is configured');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({from:process.env.REMINDER_FROM_EMAIL,to:[to],subject,text}) });
  if (!response.ok) throw Error('Email delivery failed');
}
export async function sendPush(admin: SupabaseClient, userId: string, device: {id:string;endpoint:string;p256dh:string;auth:string}, kind: 'reminder' | 'jobs', day: string) {
  const config=reminderConfiguration(); const subscription=parseSubscription({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}});
  try { await webPush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify({kind}),{vapidDetails:{subject:config.siteUrl,publicKey:config.publicKey,privateKey:process.env.VAPID_PRIVATE_KEY!},TTL:3600,timeout:10_000,topic:`${kind}-${day}`}); }
  catch(cause) {
    if ([404,410].includes((cause as {statusCode:number}).statusCode)) {
      const {error}=await admin.from('push_subscriptions').delete().eq('user_id',userId).eq('id',device.id); if(error) throw Error('Expired browser cleanup failed'); return;
    }
    throw Error('Push delivery failed');
  }
}
export async function claimDelivery(admin: SupabaseClient, kind: 'reminder' | 'job_alert', user: string, day: string, channel: 'email' | 'push', recipient: string, send:()=>Promise<void>) {
  const {data,error}=await admin.rpc(`claim_${kind}`,{p_user:user,p_day:day,p_channel:channel,p_recipient:recipient});
  if(error?.message==='account_suspended')return false;
  if(error) throw Error('Delivery claim failed'); const claim=data?.[0]; if(!claim)return false;
  let sent=false;
  try { await send(); sent=true; } finally {
    const {error}=await admin.from(kind==='reminder'?'reminder_deliveries':'job_alert_deliveries').update({status:sent?'sent':'failed',sent_at:sent?new Date().toISOString():null}).eq('id',claim.id).eq('attempts',claim.attempts);
    if(error)throw Error('Delivery status failed');
  }
  return sent;
}

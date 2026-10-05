import assert from 'node:assert/strict';
import test from 'node:test';
import { createECDH } from 'node:crypto';
import { activeApplication, calendarDay, followUpDue, interviewDue, parsePreferences, parseSubscription, pushEndpoint } from './reminders.ts';
test('reminders use local dates across midnight and DST, only upcoming active schedules', () => {
  const now = new Date('2026-10-05T00:30:00Z');
  assert.equal(calendarDay(now,'America/Los_Angeles'),'2026-10-04');
  assert.equal(followUpDue('2026-10-04T17:00:00Z',now,'America/Los_Angeles'),true);
  assert.equal(followUpDue('2026-10-06T17:00:00Z',now,'America/Los_Angeles'),false);
  assert.equal(followUpDue(null,now,'UTC'),false); assert.equal(followUpDue('invalid',now,'UTC'),false);
  assert.equal(followUpDue('2026-11-02T17:00:00Z',new Date('2026-11-01T07:30:00Z'),'America/Los_Angeles'),true);
  assert.equal(interviewDue('2026-10-05T00:29:00Z',now),false);
  assert.equal(interviewDue('2026-10-06T02:30:00Z',now),true);
  assert.equal(interviewDue('2026-10-06T02:31:00Z',now),false);
  assert.equal(activeApplication('rejected'),false); assert.equal(activeApplication('withdrawn'),false); assert.equal(activeApplication('interview'),true);
});
test('notification preferences reject forged owners and invalid channel/timezone values', () => {
  assert.deepEqual(parsePreferences({email_enabled:false,push_enabled:true,timezone:'Asia/Kolkata'}),{email_enabled:false,push_enabled:true,timezone:'Asia/Kolkata'});
  for (const value of [null,[],{email_enabled:'yes',push_enabled:false,timezone:'UTC'},{email_enabled:false,push_enabled:false,timezone:'invalid'},{email_enabled:false,push_enabled:false,timezone:'UTC',user_id:'other'}]) assert.throws(()=>parsePreferences(value));
});
test('push subscriptions accept valid browser keys and reject SSRF endpoints and invalid curves', () => {
  const key=createECDH('prime256v1'); key.generateKeys();
  const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')}};
  assert.equal(parseSubscription(subscription).endpoint,subscription.endpoint);
  for (const endpoint of ['http://fcm.googleapis.com/fcm/send/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://fcm.googleapis.com@evil.test/a','https://evil.test@fcm.googleapis.com/a','https://fcm.googleapis.com:444/a','https://fcm.googleapis.com/a#secret','https://notify.windows.com.evil.test/a']) assert.throws(()=>pushEndpoint(endpoint));
  assert.equal(pushEndpoint('https://web.push.apple.com/fixture'),'https://web.push.apple.com/fixture');
  assert.throws(()=>parseSubscription({...subscription,keys:{...subscription.keys,p256dh:Buffer.alloc(65,4).toString('base64url')}}));
  assert.throws(()=>parseSubscription({...subscription,keys:{...subscription.keys,auth:'short'}}));
});

test('service worker ignores arbitrary push text and opens only the same-origin application workspace', async () => {
  const { readFileSync } = await import('node:fs'); const { runInNewContext } = await import('node:vm');
  const events={}; const shown=[]; const opened=[];
  const self={location:{origin:'https://jobpilot.test'},addEventListener:(type,handler)=>events[type]=handler,
    registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async(url)=>opened.push(url)}};
  runInNewContext(readFileSync(new URL('../../public/reminder-sw.js',import.meta.url),'utf8'),{self,URL});
  const pending=[]; events.push({data:{json:()=>({body:'private notes',url:'https://evil.test'})},waitUntil:promise=>pending.push(promise)});
  events.notificationclick({notification:{close(){}},waitUntil:promise=>pending.push(promise)});
  await Promise.all(pending);assert.equal(shown[0][0],'JobPilot reminder');assert.equal(shown[0][1].body.includes('private notes'),false);assert.deepEqual(opened,['https://jobpilot.test/applications']);
});

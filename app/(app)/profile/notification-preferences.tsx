"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { connectPushBrowser, currentPushSubscription, disconnectPushBrowser } from "@/lib/notifications/browser";
type Preferences = { email_enabled: boolean; push_enabled: boolean; timezone: string };
type Settings = { preferences: Preferences | null; devices: { id: string; endpoint: string }[]; availability: { email: boolean; push: boolean; publicKey: string } };
export function NotificationPreferences() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prefs, setPrefs] = useState<Preferences>({ email_enabled: false, push_enabled: false, timezone: "UTC" });
  const [endpoint, setEndpoint] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const lock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" }); const data = await response.json();
        if (!response.ok) throw Error(data.error || "Unable to load reminders.");
        const subscription = await currentPushSubscription();
        if (!cancelled) { setSettings(data); setPrefs(data.preferences || { email_enabled: false, push_enabled: false, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }); setEndpoint(subscription?.endpoint || ""); }
      } catch (cause) { if (!cancelled) setError((cause as Error).message); }
    })();
    return () => { cancelled = true; };
  }, []);
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (cause) { setError((cause as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault(); void action(async () => {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || "Unable to save reminders.");
      setMessage("Reminder preferences saved.");
    });
  }
  const connected = Boolean(endpoint && settings?.devices.some(device => device.endpoint === endpoint));
  return <section className="mt-6 rounded-2xl border bg-background p-5 sm:p-6" aria-labelledby="reminder-title">
    <h2 id="reminder-title" className="text-sm font-bold">Interview & follow-up reminders</h2>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Daily heads-up for interviews in the next 26 hours and follow-ups due today or tomorrow. Timing can vary; use your calendar for exact-time alarms. Messages link to your application workspace.</p>
    {!settings && !error && <p className="mt-3 text-xs" role="status">Loading reminders…</p>}
    {settings && <form onSubmit={save} className="mt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.email_enabled} disabled={busy || !settings.availability.email && !prefs.email_enabled} onChange={event => setPrefs({ ...prefs, email_enabled: event.target.checked })} /> Email reminders to my confirmed account email</label>
      {!settings.availability.email && <p className="text-xs text-muted-foreground">Email delivery needs a configured sender and a confirmed account email.</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.push_enabled} disabled={busy || !settings.availability.push && !prefs.push_enabled} onChange={event => setPrefs({ ...prefs, push_enabled: event.target.checked })} /> Browser push reminders on my connected browsers</label>
      {!settings.availability.push && <p className="text-xs text-muted-foreground">Browser push setup is pending.</p>}
      <label htmlFor="reminder-timezone" className="block text-xs font-semibold">Timezone for follow-up dates</label>
      <input id="reminder-timezone" className="w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-sm" value={prefs.timezone} onChange={event => setPrefs({ ...prefs, timezone: event.target.value })} maxLength={100} required disabled={busy} placeholder="Asia/Kolkata" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={busy}>Save reminder preferences</Button>
        <Button type="button" variant="outline" disabled={busy || !connected && !settings.availability.push} onClick={() => void action(async () => {
          if (connected) { await disconnectPushBrowser(); setEndpoint(""); setSettings({ ...settings, devices: settings.devices.filter(device => device.endpoint !== endpoint) }); setMessage("This browser is disconnected."); }
          else { const value = await connectPushBrowser(settings.availability.publicKey); setEndpoint(value); setSettings({ ...settings, devices: [...settings.devices, { id: "current", endpoint: value }] }); setMessage("Browser connected. Enable push reminders and save preferences to receive them."); }
        })}>{connected ? "Disconnect this browser" : "Connect this browser"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{settings.devices.length} connected browser{settings.devices.length === 1 ? "" : "s"}. Push messages contain no interview notes or company details. Signing out disconnects this browser.</p>
    </form>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    {message && <p role="status" className="mt-3 text-xs text-muted-foreground">{message}</p>}
  </section>;
}

export function JobAlertPreferences() {
  const [prefs,setPrefs]=useState({email_enabled:false,push_enabled:false});
  const [availability,setAvailability]=useState<{email:boolean;push:boolean}|null>(null);
  const [busy,setBusy]=useState(false);const lock=useRef(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  useEffect(()=>{let stopped=false;(async()=>{try{const response=await fetch('/api/job-alerts',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error);if(!stopped){setPrefs(data.preferences||{email_enabled:false,push_enabled:false});setAvailability(data.availability);}}catch(cause){if(!stopped)setError((cause as Error).message);}})();return()=>{stopped=true;};},[]);
  return <section className="mt-6 rounded-2xl border bg-background p-5 sm:p-6" aria-labelledby="job-alert-title">
    <h2 id="job-alert-title" className="text-sm font-bold">Saved-search job alerts</h2>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">A daily digest of newly added jobs matching any of your saved searches and your profile match threshold. Save searches from Find jobs first. Email includes job titles, companies and links; browser push stays generic. No alerts are sent for jobs added before you enabled alerts.</p>
    {!availability&&!error&&<p role="status" className="mt-3 text-xs">Loading job alerts…</p>}
    {availability&&<form className="mt-4 space-y-3" onSubmit={event=>{event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');void(async()=>{try{const response=await fetch('/api/job-alerts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(prefs)});const data=await response.json();if(!response.ok)throw Error(data.error);setMessage('Job alert preferences saved.');}catch(cause){setError((cause as Error).message);}finally{lock.current=false;setBusy(false);}})();}}>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.email_enabled} disabled={busy||!availability.email&&!prefs.email_enabled} onChange={e=>setPrefs({...prefs,email_enabled:e.target.checked})}/>Email job digests</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.push_enabled} disabled={busy||!availability.push&&!prefs.push_enabled} onChange={e=>setPrefs({...prefs,push_enabled:e.target.checked})}/>Browser push job alerts</label>
      <p className="text-xs text-muted-foreground">Use the browser connection above for push delivery. Unconfigured channels remain unavailable.</p>
      <Button variant="outline" disabled={busy} type="submit">Save job alert preferences</Button>
    </form>}
    {error&&<p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}{message&&<p role="status" className="mt-3 text-xs">{message}</p>}
  </section>;
}

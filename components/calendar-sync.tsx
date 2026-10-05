"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Interview } from "@/lib/applications/interviews";
export type CalendarSettings = { connections: { id:string; provider:"google"|"outlook" }[]; links:{id:string;connection_id:string;interview_id:string;synced_at:string|null}[]; availability:{google:boolean;outlook:boolean} };
const names={google:"Google",outlook:"Outlook"};
export function CalendarConnections() {
  const [settings,setSettings]=useState<CalendarSettings|null>(null);const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const lock=useRef(false);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{try {
      const response=await fetch("/api/calendars",{cache:"no-store"});const data=await response.json();if(!response.ok) throw Error(data.error || "Unable to load calendars.");
      if(!cancelled){setSettings(data);const result=new URL(window.location.href).searchParams.get("calendar");if(result==="connected") setMessage("Calendar connected. Use the sync controls on a saved interview round.");if(result==="failed") setError("Calendar connection failed or was cancelled. Check setup and retry.");}
    }catch(cause){if(!cancelled) setError((cause as Error).message);}})();return()=>{cancelled=true;};
  },[]);
  async function manage(provider:"google"|"outlook") {
    if(lock.current || !settings) return;
    const connection=settings.connections.find(item=>item.provider===provider);
    if(connection && !window.confirm(`Disconnect ${names[provider]}? Calendar events stay in your calendar. You can revoke app access in the provider’s account settings.`)) return;
    lock.current=true;setBusy(true);setError("");setMessage("");
    try {
      const response=await fetch(connection?`/api/calendars?connection=${connection.id}`:`/api/calendars/connect?provider=${provider}`,{method:connection?"DELETE":"POST"});const data=await response.json();if(!response.ok) throw Error(data.error || "Unable to update the connection.");
      if(connection){setSettings({...settings,connections:settings.connections.filter(item=>item.id!==connection.id)});setMessage(`${names[provider]} disconnected. Existing calendar events remain.`);}
      else window.location.assign(data.url);
    }catch(cause){setError((cause as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  return <section className="mt-6 rounded-2xl border bg-background p-5 sm:p-6" aria-labelledby="calendar-title">
    <h2 id="calendar-title" className="text-sm font-bold">Google & Outlook calendars</h2>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Connect your primary calendar, then send a saved interview round or import calendar changes from the interview planner. Sync runs when you use these controls. Round names, times and meeting links/venues may be visible to anyone you share your calendar with. Preparation notes and outcomes stay in JobPilot.</p>
    {!settings && !error && <p className="mt-3 text-xs" role="status">Loading calendars…</p>}
    {settings && <div className="mt-3 flex flex-wrap gap-2">{(["google","outlook"] as const).map(provider=>{
      const connected=settings.connections.some(item=>item.provider===provider);
      return <div key={provider}><Button variant="outline" disabled={busy || !connected && !settings.availability[provider]} onClick={()=>void manage(provider)}>{connected?"Disconnect":"Connect"} {names[provider]}</Button>{!connected && !settings.availability[provider] && <p className="mt-1 text-xs text-muted-foreground">{names[provider]} setup pending.</p>}</div>;
    })}</div>}
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}{message && <p role="status" className="mt-3 text-xs text-muted-foreground">{message}</p>}
  </section>;
}
export function InterviewCalendarSync({event,settings,disabled,onSynced}:{event:Interview;settings:CalendarSettings;disabled:boolean;onSynced:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");const lock=useRef(false);
  async function sync(connection:string,action:"export"|"import"|"unlink") {
    if(lock.current || disabled) return;
    const prompt=action==="export"?"Send this round’s saved name, time and venue to your primary calendar? Cancelled rounds appear as free time with [Cancelled] in their title.":action==="import"?"Replace this round’s saved name, time, duration and venue with calendar changes? A removed event marks the round cancelled. Your preparation notes and outcomes stay unchanged.":"Unlink this round? The existing calendar event stays. Sending again creates another event.";
    if(!window.confirm(prompt)) return;
    lock.current=true;setBusy(true);setError("");setMessage("");
    try {
      const response=await fetch(action==="unlink"?`/api/calendars?connection=${connection}&interview=${event.id}`:"/api/calendars",{method:action==="unlink"?"DELETE":"POST",headers:{"Content-Type":"application/json"},...(action!=="unlink"?{body:JSON.stringify({connection,interview:event.id,version:event.version,action})}:{})});
      const data=await response.json();if(!response.ok) throw Error(data.error || "Calendar sync failed.");
      await onSynced();setMessage(action==="export"?"Round sent to calendar.":action==="import"?"Calendar changes imported.":"Round unlinked. Calendar event retained.");
    }catch(cause){setError((cause as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  return <div className="mt-3 space-y-2">{settings.connections.map(connection=>{
    const link=settings.links.find(item=>item.connection_id===connection.id && item.interview_id===event.id);
    return <div key={connection.id} className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={disabled || busy || !settings.availability[connection.provider]} onClick={()=>void sync(connection.id,"export")}>Send to {names[connection.provider]}</Button>
      <Button variant="outline" size="sm" disabled={disabled || busy || !link || !settings.availability[connection.provider]} onClick={()=>void sync(connection.id,"import")}>Import from {names[connection.provider]}</Button>
      {link && <Button variant="ghost" size="sm" disabled={disabled || busy} onClick={()=>void sync(connection.id,"unlink")}>Unlink {names[connection.provider]}</Button>}
    </div>;
  })}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}{message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}</div>;
}

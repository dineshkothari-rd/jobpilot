import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { interviewId, type Interview } from "@/lib/applications/interviews";
import { calendarAdmin, calendarAccess } from "@/lib/calendars/server";
import { calendarConfig, calendarEventBody, calendarRequest, importedCalendarEvent, type CalendarProvider } from "@/lib/calendars/provider";
export const runtime = "nodejs";
export const maxDuration = 120;
const json = (body: unknown, status = 200) => Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request: Request) {
  try {
    const client = await createClient();const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({error:"Sign in to manage calendars."},401);
    const interview = new URL(request.url).searchParams.get("interview");
    const application = new URL(request.url).searchParams.get("application");
    if (application && !interviewId(application)) return json({error:"Choose a valid application."},400);
    if (interview && !interviewId(interview)) return json({error:"Choose a valid interview."},400);
    const connections = await client.from("calendar_connections").select("id,provider,created_at").eq("user_id",user.id);
    if (connections.error) return json({error:"Calendar sync is not available yet."},503);
    const links = interview ? await client.from("calendar_event_links").select("id,connection_id,interview_id,synced_at").eq("user_id",user.id).eq("interview_id",interview) : application ? await client.from("calendar_event_links").select("id,connection_id,interview_id,synced_at,application_interviews!inner(application_id)").eq("user_id",user.id).eq("application_interviews.application_id",application).limit(400) : { data:[],error:null };
    if (links.error) return json({error:"Calendar links could not be loaded."},503);
    return json({connections:connections.data || [],links:links.data || [],availability:{google:calendarConfig("google").ready,outlook:calendarConfig("outlook").ready}});
  } catch { return json({error:"Unable to load calendars."},503); }
}
async function mutation(request: Request, remove: boolean) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return json({error:"This request must come from Parth Careers."},403);
  try {
    const client = await createClient();const { data: { user },error } = await client.auth.getUser();
    if (error || !user) return json({error:"Sign in to sync a calendar."},401);
    let input: { connection: string; interview: string; version: number; action: "export" | "import" };
    if (remove) input = { connection:new URL(request.url).searchParams.get("connection") || "",interview:new URL(request.url).searchParams.get("interview") || "",version:0,action:"export" };
    else {
      const reader = request.body?.getReader();if (!reader) return json({error:"Invalid calendar request."},400);
      let length=0;const chunks:Uint8Array[]=[];
      for (;;) { const {value,done}=await reader.read();if(done) break;length+=value.byteLength;if(length>2048){await reader.cancel();return json({error:"Request too large."},413);}chunks.push(value); }
      try { input=JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return json({error:"Invalid calendar request."},400); }
    }
    if (!input || !interviewId(input.connection) || input.interview && !interviewId(input.interview) || !remove && (!interviewId(input.interview) || !Number.isSafeInteger(input.version) || input.version<1 || !["export","import"].includes(input.action) || Object.keys(input).some(key=>!["connection","interview","version","action"].includes(key)))) return json({error:"Invalid calendar request."},400);
    const admin = calendarAdmin();
    const {data:connection,error:connectionError}=await admin.from("calendar_connections").select("id,user_id,provider").eq("id",input.connection).eq("user_id",user.id).maybeSingle();
    if (connectionError) return json({error:"Calendar connection unavailable."},503);
    if (!connection) return json({error:"Calendar connection not found."},404);
    if (remove && !input.interview) {
      // Deleting credentials stops future sync. Provider-owned events and consent are retained.
      const {error:deleteError}=await admin.from("calendar_connections").delete().eq("id",connection.id).eq("user_id",user.id);
      return deleteError ? json({error:"Unable to disconnect your calendar."},503) : json({disconnected:true});
    }
    // ponytail: serialize per calendar; add a queue if bulk syncing is required.
    const lease = randomUUID();const {data:claimed,error:claimError}=await admin.rpc("claim_calendar_sync",{p_user:user.id,p_connection:connection.id,p_token:lease});
    if (claimError) return json({error:"Calendar sync is unavailable."},503);
    if (!claimed) return json({error:"Another sync is running, or account deletion is pending. Try again shortly."},409);
    try {
      if (remove) {
        const {error:unlinkError}=await admin.from("calendar_event_links").delete().eq("connection_id",connection.id).eq("interview_id",input.interview).eq("user_id",user.id);
        return unlinkError ? json({error:"Unable to unlink this round."},503) : json({unlinked:true});
      }
      const provider = connection.provider as CalendarProvider;
      if (!calendarConfig(provider).ready) return json({error:"Calendar provider setup is pending."},503);
      const {data:event,error:eventError}=await admin.from("application_interviews").select("*").eq("id",input.interview).eq("user_id",user.id).maybeSingle();
      if (eventError) return json({error:"Interview unavailable."},503);
      if (!event) return json({error:"Interview not found."},404);
      if (event.version!==input.version) return json({error:"This interview changed. Reload saved rounds before syncing."},409);
      const linkRead=await admin.from("calendar_event_links").select("*").eq("connection_id",connection.id).eq("interview_id",event.id).eq("user_id",user.id).maybeSingle();
      let link=linkRead.data;
      if (linkRead.error) return json({error:"Calendar link unavailable."},503);
      if (!link && input.action==="import") return json({error:"Send this round to your calendar first."},409);
      if (!link) {
        const id=randomUUID();const result=await admin.from("calendar_event_links").insert({id,user_id:user.id,connection_id:connection.id,interview_id:event.id,event_id:provider==="google"?id.replace(/-/g,""):""}).select("*").single();
        if(result.error) return json({error:"Unable to prepare calendar sync."},503);link=result.data;
      }
      const token=await calendarAccess(admin,{...connection,provider});
      const remoteResponse=link.event_id ? await calendarRequest(provider,token,link.event_id) : null;
      const missing=!remoteResponse || remoteResponse.status===404 || remoteResponse.status===410;
      if (remoteResponse && !remoteResponse.ok && !missing) return json({error:"Calendar access failed. Check permissions or reconnect."},503);
      const remote = !missing ? await remoteResponse!.json() : null;
      const remoteEtag=remote?.etag || remote?.["@odata.etag"];
      if (!missing && (typeof remoteEtag!=="string" || !remoteEtag || remoteEtag.length>2048)) return json({error:"Calendar event version could not be checked."},503);
      if (input.action==="import") {
        if (missing && !link.etag) return json({error:"This round has not been sent successfully yet. Send it before importing."},409);
        let patch;
        try { patch=missing ? {status:"cancelled"} : importedCalendarEvent(provider,remote,event as Interview); }
        catch(cause) { return json({error:(cause as Error).message},400); }
        const {error:importError}=await admin.rpc("import_calendar_round",{p_user:user.id,p_link:link.id,p_version:event.version,p_event:patch,p_etag:remoteEtag || link.etag});
        if(importError) return json({error:"The import could not be saved, or this round changed. Reload saved rounds before retrying."},409);
        return json({imported:true});
      }
      if (remote?.status==="cancelled" || remote?.isCancelled===true) return json({error:"This calendar event was cancelled. Import cancellation or unlink the round before recreating it."},409);
      if (missing && link.etag) return json({error:"This calendar event was removed. Import its cancellation or unlink the round before recreating it."},409);
      if (!missing && link.etag && link.etag!==remoteEtag) return json({error:"Your calendar event changed. Import those changes before sending Parth Careers edits."},409);
      if (!missing && (remote.attendees?.length || remote.recurrence || remote.recurringEventId || remote.type && remote.type!=="singleInstance")) return json({error:"Sync supports single interview events without attendees. Edit meetings with attendees or recurrence in your calendar."},409);
      const body=calendarEventBody(provider,event as Interview);
      const write=await calendarRequest(provider,token,missing?"":link.event_id,missing?"POST":"PATCH",{...body,...(missing ? provider==="google"?{id:link.event_id,visibility:"private"}:{transactionId:link.id,sensitivity:"private"}: {})},missing?undefined:remoteEtag);
      if(write.status===412 || write.status===409) return json({error:"The calendar event changed or was already created. Retry to read its current state before sending."},409);
      if(!write.ok) return json({error:"Calendar update failed. Reload and retry; a provider timeout can be ambiguous."},503);
      const saved=await write.json();const etag=saved.etag || saved["@odata.etag"];
      if(typeof saved.id!=="string" || !saved.id || [".",".."].includes(saved.id) || saved.id.length>2048 || typeof etag!=="string" || !etag || etag.length>2048) return json({error:"Calendar may have been updated, but its response was incomplete. Reload before retrying."},503);
      const {error:saveError}=await admin.from("calendar_event_links").update({event_id:saved.id,etag,synced_at:new Date().toISOString()}).eq("id",link.id).eq("user_id",user.id);
      return saveError ? json({error:"Calendar was updated, but its link could not be saved. Retry to recover the same event."},503) : json({exported:true});
    } finally { await admin.from("calendar_connections").update({lease_until:null,lease_token:null}).eq("id",connection.id).eq("user_id",user.id).eq("lease_token",lease); }
  } catch { return json({error:"Calendar sync failed. Reload saved rounds and reconnect if access expired. Provider timeouts can be ambiguous."},503); }
}
export const POST=(request:Request)=>mutation(request,false);
export const DELETE=(request:Request)=>mutation(request,true);

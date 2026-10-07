import { boolean, hiringInput, hiringNote } from "@/lib/recruiter/applications";
import { hiringPage } from "@/lib/recruiter/communications";
import {
  json,
  mutationError,
  recruiterContext,
  requestBody,
} from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
export async function GET(request: Request) {
  try {
    const c = await recruiterContext();
    if (c.response) return c.response;
    const params = new URL(request.url).searchParams;
    let offset, thread;
    try {
      offset = hiringPage(params);
      thread = params.has("thread") ? uuid(params.get("thread")) : null;
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    if (!thread) {
      const r = await c.admin.rpc("list_hiring_threads", {
        p_user: c.user.id,
        p_offset: offset,
      });
      return r.error
        ? mutationError(r.error)
        : json({
            threads: (r.data || []).slice(0, 50),
            has_more: (r.data?.length || 0) > 50,
          });
    }
    const access = await c.admin.rpc("get_hiring_thread", {
      p_user: c.user.id,
      p_thread: thread,
    });
    if (access.error) return mutationError(access.error);
    const [messages, invitations] = await Promise.all([
      c.admin
        .from("hiring_messages")
        .select("id,sender_id,body,created_at")
        .eq("thread_id", thread)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 50),
      c.admin
        .from("hiring_invitations")
        .select(
          "id,job_id,round,starts_at,timezone,duration_minutes,location,notes,response,status,version",
        )
        .eq("thread_id", thread)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (messages.error || invitations.error)
      return json({ error: "Unable to load conversation." }, 503);
    return json({
      thread: access.data,
      messages: (messages.data || []).slice(0, 50).map((m) => ({
        ...m,
        mine: m.sender_id === c.user.id,
        sender_id: undefined,
      })),
      has_more: (messages.data?.length || 0) > 50,
      invitations: invitations.data || [],
    });
  } catch {
    return json({ error: "Unable to load messages." }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const c = await recruiterContext(request);
    if (c.response) return c.response;
    let b, thread, id, message, candidate;
    try {
      b = hiringInput(await requestBody(request));
      if (b.action === "open") candidate = uuid(b.candidate_id);
      else {
        thread = uuid(b.thread_id);
        id = uuid(b.id);
        message = hiringNote(b.message);
        if (!message) throw Error("Enter a message.");
      }
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    const r = candidate
      ? await c.admin.rpc("open_hiring_thread", {
          p_user: c.user.id,
          p_candidate: candidate,
        })
      : await c.admin.rpc("send_hiring_message", {
          p_user: c.user.id,
          p_thread: thread,
          p_id: id,
          p_body: message,
        });
    return r.error
      ? mutationError(r.error)
      : json(candidate ? { thread_id: r.data } : { sent: true });
  } catch {
    return json({ error: "Unable to send. Your draft is kept." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request);
    if (c.response) return c.response;
    let thread, blocked;
    try {
      const b = hiringInput(await requestBody(request));
      thread = uuid(b.thread_id);
      blocked = boolean(b.blocked);
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    const r = await c.admin.rpc("set_hiring_thread_block", {
      p_user: c.user.id,
      p_thread: thread,
      p_blocked: blocked,
    });
    return r.error ? mutationError(r.error) : json({ saved: true });
  } catch {
    return json({ error: "Unable to update contact preference." }, 503);
  }
}

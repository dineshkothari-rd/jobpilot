import { hiringPage } from "@/lib/recruiter/communications";
import { json, recruiterContext, requestBody } from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
export async function GET(request: Request) {
  try {
    const c = await recruiterContext();
    if (c.response) return c.response;
    let offset;
    try {
      offset = hiringPage(new URL(request.url).searchParams);
    } catch {
      return json({ error: "Invalid page." }, 400);
    }
    const r = await c.admin
      .from("hiring_notifications")
      .select("id,company_name,kind,thread_id,read_at,created_at")
      .eq("user_id", c.user.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 50);
    return r.error
      ? json({ error: "Notifications unavailable." }, 503)
      : json({
          notifications: (r.data || []).slice(0, 50),
          has_more: (r.data?.length || 0) > 50,
        });
  } catch {
    return json({ error: "Unable to load notifications." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request);
    if (c.response) return c.response;
    let id;
    try {
      id = uuid((await requestBody(request)).id);
    } catch {
      return json({ error: "Invalid notification." }, 400);
    }
    const r = await c.admin
      .from("hiring_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", c.user.id)
      .select("id")
      .maybeSingle();
    return r.error
      ? json({ error: "Unable to mark notification read." }, 503)
      : r.data
        ? json({ saved: true })
        : json({ error: "Notification not found." }, 404);
  } catch {
    return json({ error: "Unable to update notification." }, 503);
  }
}

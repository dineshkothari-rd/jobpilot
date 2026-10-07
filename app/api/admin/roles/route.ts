import { hiringInput } from "@/lib/recruiter/applications";
import { json, recruiterContext, requestBody } from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
export async function GET(request: Request) {
  try {
    const c = await recruiterContext(undefined, true);
    if (c.response) return c.response;
    let target: string;
    try { target = uuid(new URL(request.url).searchParams.get("user_id")); }
    catch { return json({ error: "Choose a valid account." }, 400); }
    const result = await c.admin.from("admin_operation_events").select("status,reason,created_at")
      .eq("user_id", target).like("status", "role_changed:%").order("created_at", { ascending: false }).limit(20);
    return result.error ? json({ error: "Unable to load role history." }, 503) : json({ events: result.data || [] });
  } catch { return json({ error: "Unable to load role history." }, 503); }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request, true);
    if (c.response) return c.response;
    let target: string, expected: string, role: string, reason: string;
    try {
      const b = hiringInput(await requestBody(request));
      if (Object.keys(b).some(key => !["user_id", "expected_role", "role", "reason"].includes(key))) throw Error();
      target = uuid(b.user_id); expected = String(b.expected_role); role = String(b.role);
      if (!["member", "admin"].includes(expected) || !["member", "admin"].includes(role) || typeof b.reason !== "string") throw Error();
      reason = b.reason.trim();
      if (reason.length < 10 || reason.length > 1000) throw Error();
    } catch { return json({ error: "Choose an account role and explain the change (10–1000 characters)." }, 400); }
    const r = await c.admin.rpc("set_admin_role", { p_actor: c.user.id, p_user: target, p_expected: expected, p_role: role, p_reason: reason });
    if (r.error) {
      const messages: Record<string, string> = {
        self_role_change: "You cannot change your own role. Another admin must review this change.",
        role_conflict: "This account role changed. Reload before saving.",
        admin_required: "Your admin access is no longer active.",
        role_target_unavailable: "The account must have a profile and confirmed email before its role can change.",
      };
      return json({ error: messages[r.error.message] || "Unable to update the account role." }, r.error.message === "admin_required" ? 403 : messages[r.error.message] ? 409 : 503);
    }
    return json({ changed: r.data === true });
  } catch { return json({ error: "Unable to update the account role." }, 503); }
}

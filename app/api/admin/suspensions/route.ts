import { hiringInput } from "@/lib/recruiter/applications";
import { json, recruiterContext, requestBody } from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
export async function GET(request: Request) {
  try {
    const c = await recruiterContext(undefined, true);
    if (c.response) return c.response;
    let target: string;
    try {
      target = uuid(new URL(request.url).searchParams.get("user_id"));
    } catch {
      return json({ error: "Choose a valid account." }, 400);
    }
    const result = await c.admin
      .from("admin_operation_events")
      .select("status,reason,created_at")
      .eq("user_id", target)
      .in("status", ["account_suspended", "account_restored"])
      .order("created_at", { ascending: false })
      .limit(20);
    return result.error
      ? json({ error: "Unable to load access history." }, 503)
      : json({ events: result.data || [] });
  } catch {
    return json({ error: "Unable to load access history." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request, true);
    if (c.response) return c.response;
    let target: string, expected: boolean, suspended: boolean, reason: string;
    try {
      const b = hiringInput(await requestBody(request));
      if (
        Object.keys(b).some(
          (key) =>
            !["user_id", "expected_suspended", "suspended", "reason"].includes(
              key,
            ),
        ) ||
        typeof b.expected_suspended !== "boolean" ||
        typeof b.suspended !== "boolean" ||
        typeof b.reason !== "string"
      )
        throw Error();
      target = uuid(b.user_id);
      expected = b.expected_suspended;
      suspended = b.suspended;
      reason = b.reason.trim();
      if (reason.length < 10 || reason.length > 1000) throw Error();
    } catch {
      return json(
        {
          error:
            "Choose an account, access state and reason (10–1000 characters).",
        },
        400,
      );
    }
    const r = await c.admin.rpc("set_account_suspension", {
      p_actor: c.user.id,
      p_user: target,
      p_expected: expected,
      p_suspended: suspended,
      p_reason: reason,
    });
    const messages: Record<string, string> = {
      self_suspension: "You cannot suspend yourself.",
      admin_suspension:
        "Remove this account's admin role before suspending it.",
      suspension_conflict: "Access changed. Reload before saving.",
      account_unavailable: "Account is unavailable.",
      admin_required: "Active admin access is required.",
    };
    if (r.error)
      return json(
        {
          error:
            messages[r.error.message] || "Unable to update account access.",
        },
        r.error.message === "admin_required"
          ? 403
          : messages[r.error.message]
            ? 409
            : 503,
      );
    return json({ changed: r.data === true });
  } catch {
    return json({ error: "Unable to update account access." }, 503);
  }
}

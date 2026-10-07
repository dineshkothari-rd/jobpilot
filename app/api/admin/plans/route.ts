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
      return json({ error: "Choose an account." }, 400);
    }
    const [plan, catalog] = await Promise.all([
      c.admin.rpc("effective_launch_plan", { p_user: target }),
      c.admin.from("launch_plans").select("id,name,audience").order("id"),
    ]);
    return plan.error || catalog.error
      ? json({ error: "Unable to load plan." }, 503)
      : json({ plan: plan.data, catalog: catalog.data });
  } catch {
    return json({ error: "Unable to load plan." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request, true);
    if (c.response) return c.response;
    let user: string,
      expected: string,
      plan: string,
      days: number,
      reason: string;
    try {
      const b = hiringInput(await requestBody(request));
      if (
        Object.keys(b).some(
          (k) =>
            !["user_id", "expected_plan", "plan", "days", "reason"].includes(k),
        ) ||
        typeof b.expected_plan !== "string" ||
        typeof b.plan !== "string" ||
        typeof b.days !== "number" ||
        !Number.isInteger(b.days) ||
        b.days < 1 ||
        b.days > 90 ||
        typeof b.reason !== "string"
      )
        throw Error();
      user = uuid(b.user_id);
      expected = b.expected_plan;
      plan = b.plan;
      days = b.days;
      reason = b.reason.trim();
      if (
        reason.length < 10 ||
        reason.length > 1000 ||
        plan.length > 100 ||
        expected.length > 100
      )
        throw Error();
    } catch {
      return json(
        {
          error: "Choose a plan, 1–90 days and a reason (10–1000 characters).",
        },
        400,
      );
    }
    const r = await c.admin.rpc("assign_launch_plan", {
      p_actor: c.user.id,
      p_user: user,
      p_expected: expected,
      p_plan: plan,
      p_days: days,
      p_reason: reason,
    });
    const errors: Record<string, string> = {
      plan_conflict: "Plan changed. Reload before saving.",
      invalid_plan:
        "This plan is unavailable for this account. Recruiter plans require verification.",
      self_plan_change: "Another admin must review your plan change.",
      account_unavailable: "Account is unavailable.",
      admin_required: "Active admin access required.",
    };
    return r.error
      ? json(
          { error: errors[r.error.message] || "Unable to assign plan." },
          r.error.message === "admin_required"
            ? 403
            : errors[r.error.message]
              ? 409
              : 503,
        )
      : json({ changed: r.data === true });
  } catch {
    return json({ error: "Unable to assign plan." }, 503);
  }
}

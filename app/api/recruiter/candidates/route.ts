import { AllowanceError, consumeAllowance } from "@/lib/plans/server";
import { searchInput, shortlistInput } from "@/lib/recruiter/communications";
import {
  json,
  mutationError,
  recruiterContext,
  requestBody,
} from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
export async function GET(request: Request) {
  try {
    const context = await recruiterContext();
    if (context.response) return context.response;
    const params = new URL(request.url).searchParams;
    if (params.has("id")) {
      let candidate;
      try {
        candidate = uuid(params.get("id"));
      } catch {
        return json({ error: "Invalid candidate." }, 400);
      }
      const { data, error } = await context.admin.rpc(
        "get_recruiter_candidate_profile",
        { p_user: context.user.id, p_candidate: candidate },
      );
      if (error) return mutationError(error);
      if (!data)
        return json(
          { error: "This candidate has not shared a discoverable profile." },
          404,
        );
      const view = await context.admin.rpc("record_hiring_view", {
        p_user: context.user.id,
        p_candidate: candidate,
        p_resume: !!data.resume_text,
      });
      if (view.error) return mutationError(view.error);
      return json({ profile: data });
    }
    let filters;
    try {
      filters = searchInput(params);
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    await consumeAllowance(context.user.id, "candidate_search", context.admin);
    const { data, error } = await context.admin.rpc(
      "search_hiring_candidates",
      { p_user: context.user.id, ...filters },
    );
    return error
      ? mutationError(error)
      : json({
          candidates: (data || []).slice(0, 50),
          has_more: (data?.length || 0) > 50,
        });
  } catch (cause) {
    if (cause instanceof AllowanceError) return json({ error: cause.message }, cause.status);
    return json({ error: "Unable to load candidates." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const context = await recruiterContext(request);
    if (context.response) return context.response;
    let fields;
    try {
      fields = shortlistInput(await requestBody(request));
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    const { error } = await context.admin.rpc("save_recruiter_shortlist", {
      p_user: context.user.id,
      ...fields,
    });
    return error ? mutationError(error) : json({ saved: true });
  } catch {
    return json({ error: "Unable to save shortlist. Your note is kept." }, 503);
  }
}

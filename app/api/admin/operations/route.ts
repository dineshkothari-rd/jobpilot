import { hiringInput, hiringNote } from "@/lib/recruiter/applications";
import { hiringPage, initialVersion } from "@/lib/recruiter/communications";
import {
  json,
  mutationError,
  recruiterContext,
  requestBody,
} from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
export async function GET(request: Request) {
  try {
    const c = await recruiterContext(undefined, true);
    if (c.response) return c.response;
    let offset, query;
    try {
      const params = new URL(request.url).searchParams;
      offset = hiringPage(params);
      query = params.get("q")?.trim() || null;
      if (query && query.length > 200) throw Error();
    } catch {
      return json({ error: "Invalid account search." }, 400);
    }
    const r = await c.admin.rpc("get_admin_operations", {
      p_user: c.user.id,
      p_offset: offset,
      p_query: query,
    });
    return r.error
      ? mutationError(r.error)
      : json({
          ...r.data,
          accounts: (r.data.accounts || []).slice(0, 50),
          has_more: (r.data.accounts?.length || 0) > 50,
        });
  } catch {
    return json({ error: "Unable to load admin operations." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request, true);
    if (c.response) return c.response;
    let user, v, status, notes;
    try {
      const b = hiringInput(await requestBody(request));
      user = uuid(b.user_id);
      v = initialVersion(b.version);
      status = String(b.status);
      if (!["clear", "review_needed", "resolved"].includes(status))
        throw Error("Choose a review status.");
      notes = hiringNote(b.notes);
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    const r = await c.admin.rpc("save_admin_account_case", {
      p_actor: c.user.id,
      p_user: user,
      p_version: v,
      p_status: status,
      p_notes: notes,
    });
    return r.error ? mutationError(r.error) : json({ saved: true });
  } catch {
    return json({ error: "Unable to save account review." }, 503);
  }
}

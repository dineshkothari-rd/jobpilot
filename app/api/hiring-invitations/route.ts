import { hiringInput, hiringNote } from "@/lib/recruiter/applications";
import { invitationInput } from "@/lib/recruiter/communications";
import {
  json,
  mutationError,
  recruiterContext,
  requestBody,
} from "@/lib/recruiter/server";
import { uuid, version } from "@/lib/recruiter/validation";
export async function POST(request: Request) {
  try {
    const c = await recruiterContext(request);
    if (c.response) return c.response;
    let fields;
    try {
      fields = invitationInput(await requestBody(request));
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    const r = await c.admin.rpc("save_hiring_invitation", {
      p_user: c.user.id,
      ...fields,
    });
    return r.error ? mutationError(r.error) : json({ saved: true });
  } catch {
    return json(
      { error: "Unable to save invitation. Your draft is kept." },
      503,
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request);
    if (c.response) return c.response;
    let id, v, status, response;
    try {
      const b = hiringInput(await requestBody(request));
      id = uuid(b.id);
      v = version(b.version);
      status = String(b.status);
      if (
        !["accepted", "reschedule_requested", "declined", "cancelled"].includes(
          status,
        )
      )
        throw Error("Choose a valid response.");
      response = hiringNote(b.response, 1000);
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    const r = await c.admin.rpc("respond_hiring_invitation", {
      p_user: c.user.id,
      p_id: id,
      p_version: v,
      p_status: status,
      p_response: response,
    });
    return r.error ? mutationError(r.error) : json({ saved: true });
  } catch {
    return json({ error: "Unable to save invitation response." }, 503);
  }
}

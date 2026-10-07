import { json, recruiterContext } from "@/lib/recruiter/server";
export async function GET() {
  try {
    const c = await recruiterContext();
    if (c.response) return c.response;
    const result = await c.admin.rpc("get_launch_usage", { p_user: c.user.id });
    return result.error
      ? json({ error: "Unable to load your free allowance." }, 503)
      : json(result.data);
  } catch {
    return json({ error: "Unable to load your free allowance." }, 503);
  }
}

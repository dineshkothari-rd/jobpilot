import "server-only";
import { createClient } from "@supabase/supabase-js";
import { authorizedCron } from "@/lib/autopilot/schedule";
import { workerResult, type WorkerName } from "./status";

// One shared boundary: unauthorized callers never create records or run work.
export async function monitoredCron(request: Request, worker: WorkerName, run: () => Promise<Response>) {
  const json = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!authorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) return json("Unauthorized.", 401);
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return json("Background monitoring setup is incomplete.", 503);
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
  });
  let id: string | undefined;
  try {
    const start = await admin.rpc("begin_worker_run", { p_worker: worker });
    if (start.error) return json("Background monitoring is unavailable.", 503);
    if (!start.data) return json("This background job is already running.", 409);
    id = start.data;
    let response: Response;
    try { response = await run(); }
    catch { response = json("Background job failed safely.", 503); }
    let result = workerResult(503, {});
    try { result = workerResult(response.status, await response.clone().json()); } catch { /* Invalid output is a failed run. */ }
    const finish = await admin.rpc("finish_worker_run", { p_id: id, p_state: result.state, p_completed: result.completed, p_failed: result.failed, p_skipped: result.skipped });
    if (finish.error || finish.data !== true) return json("Background job ran, but its final status could not be recorded. Check hosting logs before retrying.", 503);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch { return json(id ? "Background job status is incomplete. Check hosting logs before retrying." : "Background monitoring is unavailable.", 503); }
}

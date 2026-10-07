export const workerNames = ["autopilot", "reminders", "job_alerts"] as const;
export type WorkerName = typeof workerNames[number];
export function workerResult(status: number, body: Record<string, unknown>) {
  const count = (key: string) => typeof body[key] === "number" && Number.isSafeInteger(body[key]) && (body[key] as number) >= 0 ? Math.min(body[key] as number, 2147483647) : 0;
  return {
    state: body.incomplete === true ? "incomplete" : status >= 400 || count("failed") > 0 ? "failed" : typeof body.skipped === "string" ? "skipped" : "succeeded",
    completed: Math.min(count("completed") + count("sent"), 2147483647), failed: count("failed"), skipped: count("skipped"),
  };
}
export function workerHealth(run: { state: string; started_at: string } | undefined, now = Date.now()) {
  if (!run) return "never_run";
  const age = now - Date.parse(run.started_at);
  if (!Number.isFinite(age)) return "unknown";
  if (run.state === "running" && age > 600_000) return "abandoned";
  if (age > 36 * 3600_000) return "overdue";
  return run.state;
}

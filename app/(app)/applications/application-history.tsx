"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Event = {
  id: number;
  kind: "created" | "snapshot" | "updated";
  actor: string;
  created_at: string;
  changes: Record<string, { from: string | null; to: string | null }>;
};
const labels: Record<string, string> = { status: "Status", notes: "Notes", follow_up_at: "Follow-up", resume_id: "Resume", applied_at: "Application date" };

export function ApplicationHistory({ applicationId, version }: { applicationId: string; version: number }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let ignore = false;
    generation.current += 1;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/applications/${applicationId}/events`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load activity.");
        if (!ignore) { setEvents(data.events); setHasMore(data.hasMore); }
      } catch (cause) {
        if (!ignore) setError(cause instanceof Error ? cause.message : "Unable to load activity.");
      } finally { if (!ignore) setLoading(false); }
    }
    void load();
    return () => { ignore = true; generation.current += 1; };
  }, [applicationId, version, revision]);

  async function loadMore() {
    const currentGeneration = generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${applicationId}/events?before=${events.at(-1)?.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load activity.");
      if (generation.current !== currentGeneration) return;
      setEvents((previous) => [...previous, ...data.events]);
      setHasMore(data.hasMore);
    } catch (cause) { if (generation.current === currentGeneration) setError(cause instanceof Error ? cause.message : "Unable to load activity."); }
    finally { if (generation.current === currentGeneration) setLoading(false); }
  }
  return <section className="mt-6" aria-label="Application activity history">
    <h3 className="text-sm font-bold">Activity history</h3>
    <p className="mt-1 text-xs text-muted-foreground">Changes recorded from the start of activity tracking. Earlier changes cannot be reconstructed.</p>
    {error && <div role="alert" className="mt-3 text-xs">{error} <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>Retry</Button></div>}
    <ol className="mt-3 space-y-3 border-l pl-4">
      {events.map((event) => <li key={event.id} className="text-xs">
        <details>
          <summary className="cursor-pointer font-semibold">{event.kind === "snapshot" ? "Current state when tracking began" : event.kind === "created" ? "Added to pipeline" : Object.keys(event.changes).map((key) => labels[key] || key).join(", ") + " updated"}
            <span className="mt-1 block font-normal text-muted-foreground"><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time> · {event.actor}</span>
          </summary>
          <dl className="mt-2 space-y-2 rounded-xl border p-3">
            {Object.entries(event.changes).map(([field, change]) => <div key={field}><dt className="font-semibold">{labels[field] || field}</dt><dd className="whitespace-pre-wrap break-words text-muted-foreground">{field === "resume_id" ? (change.to ? "Resume selected or changed" : "Resume removed") : event.kind === "updated" ? `${change.from || "Not set"} → ${change.to || "Not set"}` : change.to || "Not set"}</dd></div>)}
          </dl>
        </details>
      </li>)}
    </ol>
    {loading && <p role="status" className="mt-3 text-xs">Loading activity…</p>}
    {!loading && !error && !events.length && <p className="mt-3 text-xs text-muted-foreground">No activity recorded yet.</p>}
    {hasMore && <Button className="mt-3" variant="outline" size="sm" disabled={loading} onClick={() => void loadMore()}>Load older activity</Button>}
  </section>;
}

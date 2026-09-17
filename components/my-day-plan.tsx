"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dayKeyValid, parseDayPreferences, splitDayActions, type DayAction, type DayPreferences } from "@/lib/home-next-action";

export type SavedDayPlan = { preferences: DayPreferences; version: number; storageReady: boolean };
const localTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function MyDayPlan({ actions, plan, now, progressUnavailable, onSaved }: { actions: DayAction[]; plan: SavedDayPlan; now: number; progressUnavailable: boolean; onSaved: (plan: SavedDayPlan) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState("");
  const { active, deferred } = splitDayActions(actions, plan.preferences, now);

  const save = async (key: string, until: string | null) => {
    if (busy || !plan.storageReady) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/my-day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, until, version: plan.version }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your plan was not saved. Try again.");
      if (!Number.isSafeInteger(result.version) || result.version <= plan.version || result.storageReady !== true) throw new Error("Couldn’t confirm the saved plan. Refresh before trying again.");
      onSaved({ preferences: parseDayPreferences(result.preferences), version: result.version, storageReady: true });
      setEditing(""); setDate("");
      setNotice(until ? "Saved for later. This changes only your suggestions, not application or learning progress." : "Suggestion restored. Your underlying work is unchanged.");
    } catch (e) { setError(e instanceof Error ? e.message : "Your plan was not saved. Try again."); }
    finally { setBusy(false); }
  };

  const skipToday = (key: string) => {
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
    void save(key, tomorrow.toISOString());
  };
  const reschedule = (key: string) => {
    const time = new Date(date).getTime();
    if (!date || !Number.isFinite(time) || time <= Date.now() || time > Date.now() + 30 * 86400000) { setError("Choose a future time within 30 days."); return; }
    void save(key, new Date(time).toISOString());
  };

  return (
    <section aria-labelledby="my-day-plan" className="mt-4 border-y">
      {error ? <p role="alert" className="py-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" aria-live="polite" className="py-2 text-xs text-muted-foreground">{notice}</p> : null}
      <details className="pb-2">
      <summary id="my-day-plan" className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Your plan, your pace · {active.length} {active.length === 1 ? "suggestion" : "suggestions"}{deferred.length ? ` · ${deferred.length} set aside` : ""}</summary>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Based on your saved work. Opening a link never marks work complete. Skip today returns at midnight in your current timezone.</p>
      {!plan.storageReady ? <p role="status" className="mt-2 text-xs text-muted-foreground">Your saved plan couldn’t be checked. Suggestions are available; refresh to enable planning controls.</p> : null}
      {progressUnavailable ? <p role="status" className="mt-2 text-xs text-muted-foreground">Some saved learning or practice progress couldn’t be checked. Your job search still works; refresh to retry.</p> : null}
      {!active.length ? <p className="mt-3 text-sm text-muted-foreground">You’ve set these suggestions aside. You can open or restore them below whenever you want.</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {active.slice(0, 6).map(action => (
          <article key={action.href} className="min-w-0 rounded-xl border p-4">
            <h3 className="break-words text-sm font-semibold">{action.title}</h3>
            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{action.text}</p>
            <Link href={action.href} className="inline-flex min-h-11 items-center text-xs font-semibold text-primary">{action.cta} →</Link>
            {dayKeyValid(action.href) ? <div className="flex flex-wrap gap-2 border-t pt-2">
              <Button size="sm" variant="ghost" className="min-h-11" aria-label={`Skip ${action.title} today`} disabled={busy || !plan.storageReady} onClick={() => skipToday(action.href)}>Skip today</Button>
              <Button size="sm" variant="ghost" className="min-h-11" aria-label={`Choose a time for ${action.title}`} disabled={busy || !plan.storageReady} aria-expanded={editing === action.href} onClick={() => { setEditing(editing === action.href ? "" : action.href); setDate(""); }}>Choose a time</Button>
            </div> : <p className="text-xs text-muted-foreground">Finish this setup first to unlock personalized suggestions.</p>}
            {editing === action.href ? <form className="mt-2 space-y-2" onSubmit={event => { event.preventDefault(); reschedule(action.href); }}>
              <label className="block text-xs font-medium">When would you like to return? (your local time)
                <input required type="datetime-local" value={date} min={localTime(new Date(now))} max={localTime(new Date(now + 30 * 86400000))} onChange={event => setDate(event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-background px-2 text-sm" />
              </label>
              <Button size="sm" className="min-h-11" type="submit" disabled={busy || !plan.storageReady}>Save time</Button>
              <Button size="sm" variant="ghost" className="min-h-11" type="button" disabled={busy} onClick={() => setEditing("")}>Cancel</Button>
            </form> : null}
          </article>
        ))}
      </div>
      {active.length > 6 ? <p className="mt-2 text-xs text-muted-foreground">Showing your first six suggestions. Set one aside to see the next, or review all recorded applications in <Link href="/applications" className="font-semibold text-primary underline">Applications</Link>.</p> : null}
      {deferred.length ? <div className="mt-4">
        <h3 className="text-sm font-semibold">Set aside—not completed</h3>
        <p className="mt-1 text-xs text-muted-foreground">Recorded follow-up dates can still be overdue. Deferring a suggestion does not change them or contact the company.</p>
        <ul className="mt-2 divide-y">{deferred.map(action => <li key={action.href} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0"><Link href={action.href} className="text-sm font-medium hover:underline">{action.title}</Link><p className="text-xs text-muted-foreground">Returns {new Date(plan.preferences[action.href]).toLocaleString()}</p></div>
          <Button size="sm" variant="outline" className="min-h-11" aria-label={`Undo deferral for ${action.title}`} disabled={busy || !plan.storageReady} onClick={() => void save(action.href, null)}>Undo</Button>
        </li>)}</ul>
      </div> : null}
      <div className="mt-2 flex flex-wrap gap-x-5">
        <Link href="/learn" className="inline-flex min-h-11 items-center text-xs font-semibold text-primary">Explore free learning →</Link>
        <Link href="/practice" className="inline-flex min-h-11 items-center text-xs font-semibold text-primary">Choose interview practice →</Link>
      </div>
      </details>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseLearningGoals } from "@/lib/learning/model";
import { learningMutation, useUnsavedLearning } from "./learning-client";

export type LearningGoals = { skills: string[]; minutes_per_day: number; version: number };

export function LearningGoalsForm({ goals, ready, onSaved }: { goals: LearningGoals; ready: boolean; onSaved: () => void }) {
  const [skills, setSkills] = useState(goals.skills.join(", "));
  const [minutes, setMinutes] = useState(goals.minutes_per_day);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const dirty = !saved && (skills !== goals.skills.join(", ") || minutes !== goals.minutes_per_day);
  useUnsavedLearning(dirty);
  return <details className="surface p-5"><summary className="cursor-pointer font-bold">Make this plan yours · {goals.minutes_per_day} minutes/day</summary>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Choose skills you want to learn, from any profession. Your profile and resume help suggest paths; your goals take priority. Changing goals never resets started paths.</p>
    {!ready ? <p role="status" className="mt-3 text-sm">Learning goals could not load. Refresh before saving; courses still work.</p> : null}
    <form className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]" onSubmit={async event => {
      event.preventDefault(); if (busy || !ready) return;
      setBusy(true); setError("");
      try {
        const value = parseLearningGoals({ skills: skills.split(",").map(skill => skill.trim()).filter(Boolean), minutes_per_day: minutes, version: goals.version });
        await learningMutation({ action: "goals", goals: value }); setSaved(true); onSaved();
      } catch (error) { setError(error instanceof Error ? error.message : "Could not save goals. Your edits remain here."); }
      finally { setBusy(false); }
    }}>
      <label className="text-sm font-semibold">Skills to learn<input value={skills} maxLength={2500} disabled={busy || !ready} onChange={event => { setSkills(event.target.value); setSaved(false); }} placeholder="Your learning goals, separated by commas" className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3" /><span className="mt-2 block text-xs font-normal text-muted-foreground">Up to 20 skills. Leave empty to use your profile and resume.</span></label>
      <label className="text-sm font-semibold">Minutes per day<input type="number" min={10} max={180} required value={minutes} disabled={busy || !ready} onChange={event => { setMinutes(Number(event.target.value)); setSaved(false); }} className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3" /></label>
      <div className="sm:col-span-2"><Button disabled={busy || !ready || !dirty}>{busy ? "Saving…" : "Save my goals"}</Button>{error ? <><p role="alert" className="mt-3 text-sm text-destructive">{error}</p><Button type="button" variant="outline" className="mt-3" disabled={busy} onClick={() => { if (!dirty || window.confirm("Copy any goal edits you want to keep. Reload saved goals and discard this draft?")) onSaved(); }}>Reload saved goals</Button></> : null}{saved ? <p role="status" className="mt-3 text-sm">Goals saved. Updating suggestions; your existing progress is unchanged.</p> : null}</div>
    </form>
  </details>;
}

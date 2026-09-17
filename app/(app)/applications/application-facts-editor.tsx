"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { applicationFactFields, parseApplicationFacts, type ApplicationFacts } from "@/lib/applications/facts";

export function ApplicationFactsEditor({ facts, storageReady, onSave, onEditing }: {
  facts: ApplicationFacts;
  storageReady: boolean;
  onSave: (facts: ApplicationFacts) => void;
  onEditing: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(facts);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const lock = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(facts);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (lock.current || !confirmed || !storageReady) return;
    lock.current = true;
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/applications/answers", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed, facts: draft, previousFacts: facts }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save answers.");
      const saved = parseApplicationFacts(result.facts);
      onSave(saved);
      setDraft(saved);
      setConfirmed(false);
      setFeedback("Saved. These facts are reusable across your applications; review them for each employer.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save. Retry without losing your edits.");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
    <summary className="cursor-pointer font-semibold">Save frequently requested answers</summary>
    <p className="mt-3 leading-5 text-muted-foreground">Optional. Store only facts you want reused. Legal and compensation answers remain manual on the employer form. Name, location and social links are edited in Profile.</p>
    <p className="mt-2 leading-5 text-muted-foreground">Work authorization and notice period already have shared storage: <Link href="/autopilot#settings" className="font-semibold text-primary underline">edit them in Autopilot settings</Link>. They are not duplicated here.</p>
    {!storageReady ? <p role="status" className="mt-3 leading-5">Complete your Profile first. If it is already complete, an administrator needs to apply the saved-answer migration. You can still copy existing answers and apply normally.</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-3 space-y-3">
      {applicationFactFields.map((field) => <label key={field.question} className="block">
        <span className="font-semibold">{field.question}</span>
        <span className="mt-1 block leading-5 text-muted-foreground">{field.hint}</span>
        <input type={field.question === "Portfolio URL" ? "url" : "text"} maxLength={1000} value={draft[field.question] || ""} disabled={saving || !storageReady}
          onChange={(event) => {
            const next = { ...draft, [field.question]: event.target.value };
            setDraft(next); setConfirmed(false); onEditing(JSON.stringify(next) !== JSON.stringify(facts));
          }}
          className="mt-1 h-10 w-full rounded-lg border bg-background px-3" />
      </label>)}
      <label className="flex min-h-11 items-start gap-2 leading-5"><input type="checkbox" checked={confirmed} disabled={saving || !storageReady} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />These are my actual facts. Save them for reuse in my applications.</label>
      <Button type="submit" size="sm" disabled={saving || !confirmed || !storageReady}>{saving ? "Saving…" : "Save verified answers"}</Button>
      {dirty ? <Button type="button" variant="outline" size="sm" className="ml-2" disabled={saving} onClick={() => {
        if (!window.confirm("Discard your unsaved application-answer edits?")) return;
        setDraft(facts); setConfirmed(false); setFeedback(""); onEditing(false);
      }}>Discard edits</Button> : null}
      <p role="status" className="leading-5">{feedback}</p>
    </form>
  </details>;
}

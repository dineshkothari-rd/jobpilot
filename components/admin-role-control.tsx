"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
export function AdminRoleControl({ account, onSaved }: { account: { id: string; email: string; access_role: "member" | "admin" }; onSaved: () => Promise<void> }) {
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ status: string; reason: string; created_at: string }[]>([]), [historyError, setHistoryError] = useState(""), [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/roles?user_id=${account.id}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw Error(value.error || "Unable to load role history.");
      setHistory(value.events); setHistoryError("");
    }).catch(cause => { if (!controller.signal.aborted) setHistoryError(cause.message); });
    return () => controller.abort();
  }, [account.id, revision]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget), role = String(form.get("role"));
    if (role === account.access_role) { setNotice("Role is already selected."); return; }
    if (!window.confirm(`Change ${account.email || account.id} from ${account.access_role} to ${role}? Admin access includes private moderation, support and account review data.`)) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: account.id, expected_role: account.access_role, role, reason: form.get("reason") }) });
      const value = await response.json();
      if (!response.ok) throw Error(value.error || "Unable to save role.");
      setNotice(value.changed ? "Role changed and recorded in admin audit history." : "Role already matches."); setRevision(value => value + 1); await onSaved();
    } catch (cause) { setError((cause as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form onSubmit={save} className="mt-4 rounded-xl border p-4">
    <h3 className="font-semibold">Account access role</h3><p className="mt-2 text-sm text-muted-foreground">Self role changes are blocked. Member access preserves candidate/recruiter features. This does not suspend the account.</p>
    {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}{notice && <p role="status" className="mt-2">{notice}</p>}
    <fieldset disabled={busy} className="mt-3 space-y-3"><label className="block text-sm">Role<select key={account.access_role} name="role" defaultValue={account.access_role} className="ml-2 rounded-lg border bg-background p-2"><option value="member">Member</option><option value="admin">Admin</option></select></label>
    <label className="block text-sm">Reason for access change<textarea name="reason" required minLength={10} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border bg-background p-2" /></label><Button type="submit">Save role</Button></fieldset>
    <h4 className="mt-4 text-sm font-semibold">Recent role changes</h4>
    {historyError && <p role="alert" className="mt-2 text-sm text-destructive">{historyError}</p>}
    <ul className="mt-2 space-y-2 text-sm">{history.map((event, index) => <li key={`${event.created_at}/${index}`}>{new Date(event.created_at).toLocaleString()} · {event.status.replace("role_changed:", "Changed to ")} · {event.reason}</li>)}</ul>
  </form>;
}

"use client";

import { disconnectPushBrowser } from "@/lib/notifications/browser";

import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function AccountControls() {
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);

  async function exportData() {
    if (lock.current) return;
    lock.current = true; setBusy("export"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to export your data."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "jobpilot-data.json";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(response.headers.get("X-Parth Careers-Export-Warning") || "Your data export has been downloaded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to export your data."); }
    finally { lock.current = false; setBusy(null); }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || confirmation !== "DELETE") return;
    lock.current = true; setBusy("delete"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const data = await response.json();
      if (!response.ok || !data.deleted) throw new Error(data.error || "Unable to delete your account.");
      await disconnectPushBrowser().catch(() => {});
      // Reload clears all account data held by client components.
      window.location.replace(new URL("/", window.location.origin).toString());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete your account."); lock.current = false; setBusy(null); }
  }
  return <section className="mt-6 rounded-2xl border bg-background p-5 sm:p-6" aria-labelledby="account-data-title">
    <h2 id="account-data-title" className="text-sm font-bold">Your account and data</h2>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Download your profile, applications, resume text and parsed data, reviews, and other saved records as JSON. Original PDF files are not included.</p>
    <Button className="mt-3" variant="outline" disabled={Boolean(busy)} onClick={() => void exportData()}>{busy === "export" ? "Preparing export…" : "Export my data"}</Button>
    <details className="mt-5 border-t pt-4">
      <summary className="cursor-pointer text-sm font-semibold text-destructive">Permanently delete account</summary>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">This removes your account, uploaded resumes, applications, private job listings and other personal records, and signs you out on all devices. Calendar events already copied to Google/Outlook remain there; revoke app access in the provider’s account settings. This cannot be undone. Download your data first if you want to keep it.</p>
      <form className="mt-3 space-y-3" onSubmit={(event) => void deleteAccount(event)}>
        <label className="block text-xs font-semibold" htmlFor="account-deletion-confirmation">Type DELETE to confirm</label>
        <input id="account-deletion-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required disabled={Boolean(busy)} className="w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-sm" />
        <Button type="submit" variant="destructive" className="block" disabled={Boolean(busy) || confirmation !== "DELETE"}>{busy === "delete" ? "Deleting account…" : "Delete my account permanently"}</Button>
      </form>
    </details>
    {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    {message && <p role="status" className="mt-3 text-xs text-muted-foreground">{message}</p>}
  </section>;
}

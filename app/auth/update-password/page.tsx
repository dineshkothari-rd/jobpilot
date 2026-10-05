"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let ignore = false;
    async function check() {
      try {
        const { data: { user }, error: authError } = await createClient().auth.getUser();
        if (!ignore) { setReady(Boolean(user && !authError)); if (!user || authError) setError("This reset link has expired or is invalid. Request a new link from the sign-in page."); }
      } catch { if (!ignore) setError("Unable to verify this reset link. Please reload or request a new link."); }
      finally { if (!ignore) setChecking(false); }
    }
    void check();
    return () => { ignore = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy.current) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== form.get("confirmation")) { setError("Passwords do not match."); return; }
    busy.current = true; setSaving(true); setError("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.code === "weak_password" ? "Choose a stronger password with at least 8 characters." : updateError.code === "same_password" ? "Choose a password different from your current password." : "Unable to update your password. Please try again or request a new reset link.");
        return;
      }
      // The password is saved even if session cleanup fails.
      setDone(true);
      await supabase.auth.signOut({ scope: "global" });
    } catch { setError("Unable to complete this request. Please try again."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
    <div className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {checking && <p role="status" className="mt-4 text-sm">Checking your reset link…</p>}
      {error && !done && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {done ? <p role="status" className="mt-4 text-sm">Your password has been updated. Sign in with your new password.</p> : ready && <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">New password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={saving} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
        <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
        <label className="block text-sm font-medium">Confirm password<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={saving} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
        <button disabled={saving} className="h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Update password"}</button>
      </form>}
      <Link href="/auth/login" className="mt-5 inline-block text-sm underline">Back to sign in</Link>
    </div>
  </main>;
}

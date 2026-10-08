"use client";

import { CareerScene } from "@/components/career-scene";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl, getPasswordRecoveryUrl, safeInternalPath } from "@/lib/site-url";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, FileText, BriefcaseBusiness, CalendarClock } from "lucide-react";
import { type FormEvent, Suspense, useRef, useState } from "react";

const errorMessages: Record<string, string> = {
  oauth_callback_failed: "The sign-in or confirmation link could not be completed. Please try again or request a new link.",
  oauth_cancelled: "Sign-in was cancelled or the link has expired. Please try again.",
  missing_site_url: "Sign-in is temporarily unavailable. Please try again later.",
};
const inputClass = "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [accountPurpose, setAccountPurpose] = useState(() => searchParams.get("next") === "/recruiter" ? "recruiter" : "candidate");
  const requestedNext = safeInternalPath(searchParams.get("next"));
  const destination = accountPurpose === "recruiter" ? "/recruiter" : requestedNext && requestedNext !== "/recruiter" && !requestedNext.startsWith("/auth/") ? requestedNext : "/dashboard";
  const busy = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() => {
    const errorCode = searchParams.get("error");
    return errorCode ? errorMessages[errorCode] || "Sign-in could not be completed. Please try again." : "";
  });

  const handleGoogleLogin = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading("google"); setError(""); setMessage("");
    try {
      const { error: signInError } = await createClient().auth.signInWithOAuth({
        provider: "google", options: { redirectTo: getAuthCallbackUrl(destination, window.location.origin) },
      });
      if (signInError) throw signInError;
    } catch {
      setError("Google sign-in could not be completed. Please try again.");
      busy.current = false; setLoading(null);
    }
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (mode === "register" && password !== form.get("confirmPassword")) { setError("Passwords do not match."); return; }
    busy.current = true;
    setLoading("email"); setError(""); setMessage("");
    try {
      const supabase = createClient();
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getPasswordRecoveryUrl(window.location.origin) });
        if (resetError) throw resetError;
        setMessage("If this email has an account, a password reset link will arrive shortly. Open it in this browser.");
      } else if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password,
          options: { emailRedirectTo: getAuthCallbackUrl(destination, window.location.origin) } });
        if (signUpError) throw signUpError;
        if (data.session) { router.push(accountPurpose === "recruiter" ? "/recruiter" : "/profile"); router.refresh(); return; }
        setMessage("Check your email for a confirmation link. If you already have an account, sign in or reset your password. Open the link in this browser.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(destination); router.refresh();
      }
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      setError(code === "email_not_confirmed" ? "Confirm your email using the link sent when you registered, then sign in." :
        code === "weak_password" ? "Choose a stronger password with at least 8 characters." :
        code === "over_email_send_rate_limit" || code === "over_request_rate_limit" ? "Too many attempts. Please wait a few minutes and try again." :
        mode === "login" ? "Unable to sign in. Check your email and password, or reset your password." : "Unable to complete this request. Please try again later.");
    } finally { busy.current = false; setLoading(null); }
  }

  return <main className="auth-page flex min-h-screen items-center justify-center gap-16 px-5 py-10">
    <aside className="hidden max-w-md lg:block"><p className="mb-5 text-sm font-semibold text-primary">Your next chapter starts here</p><h2 className="text-5xl font-bold leading-tight tracking-tight">A little clarity.<br /><span className="text-primary">A lot of possibility.</span></h2><p className="mt-6 text-lg leading-8 text-muted-foreground">Bring your story, opportunities and next steps together. Move at your pace, with your choices in your hands.</p><CareerScene /><ol className="mt-8 space-y-4">{[{Icon:FileText,text:"Build on your real experience"},{Icon:BriefcaseBusiness,text:"Find a role worth your time"},{Icon:CalendarClock,text:"Keep every next step in view"}].map(({Icon,text})=><li key={text} className="flex items-center gap-3 text-sm"><span className="grid size-10 place-items-center rounded-xl border bg-card text-primary"><Icon aria-hidden="true" className="size-5" /></span>{text}</li>)}</ol></aside>
    <div className="auth-card w-full max-w-md rounded-3xl border bg-card p-6 sm:p-8">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold"><Image src="/brand/parth-careers.svg" width={36} height={36} alt="" />Parth Careers</Link>
      <h1 className="text-center text-2xl font-bold tracking-tight">{mode === "register" ? "Create your Parth Careers account" : mode === "reset" ? "Reset your password" : "Welcome to Parth Careers"}</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">{mode === "reset" ? "We’ll email you a link to choose a new password." : "Manage your jobs, resume, and applications."}</p>
      {mode !== "reset" && <label className="mt-5 block text-sm font-medium">I’m here to<select className={inputClass} disabled={Boolean(loading)} value={accountPurpose} onChange={event => setAccountPurpose(event.target.value)}><option value="candidate">Find a job</option><option value="recruiter">Hire for my company</option></select></label>}
      <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={Boolean(loading)} className={inputClass} /></label>
        {mode !== "reset" && <label className="block text-sm font-medium">Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} disabled={Boolean(loading)} className={inputClass} />{mode === "register" && <span className="mt-1 block text-xs text-muted-foreground">Use at least 8 characters.</span>}</label>}
        {mode === "register" && <label className="block text-sm font-medium">Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={Boolean(loading)} className={inputClass} /></label>}
        <button disabled={Boolean(loading)} className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{loading === "email" && <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />}{mode === "register" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      {message && <p className="mt-3 text-sm text-muted-foreground" role="status">{message}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        {mode !== "login" && <button disabled={Boolean(loading)} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Back to sign in</button>}
        {mode === "login" && <><button disabled={Boolean(loading)} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>Create account</button><button disabled={Boolean(loading)} onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>Forgot password?</button></>}
      </div>
      {mode !== "reset" && <><p className="my-5 text-center text-xs text-muted-foreground">or</p><button type="button" onClick={() => void handleGoogleLogin()} disabled={Boolean(loading)} className="flex h-11 w-full items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">{loading === "google" && <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />}{loading === "google" ? "Connecting to Google…" : "Continue with Google"}</button></>}
      <p className="mt-6 text-center text-xs text-muted-foreground">By continuing, you agree to the <Link href="/terms" className="underline">Terms</Link>. Read our <Link href="/privacy" className="underline">Privacy notice</Link>.</p>
    </div>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><p role="status">Loading sign-in…</p></main>}><LoginForm /></Suspense>;
}

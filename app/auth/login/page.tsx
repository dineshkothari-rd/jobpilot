"use client";

import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl, safeInternalPath } from "@/lib/site-url";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const errorMessages: Record<string, string> = {
  oauth_callback_failed: "Google sign-in could not be completed. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled.",
  missing_site_url: "Production sign-in is missing NEXT_PUBLIC_SITE_URL.",
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");
    return errorCode ? errorMessages[errorCode] || "Sign-in could not be completed. Please try again." : "";
  });

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const supabase = createClient();
      const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"));

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getAuthCallbackUrl(next, window.location.origin) },
      });
      if (signInError) throw signInError;
    } catch {
      setError("Google sign-in could not be completed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome to JobPilot
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage your jobs, resume, and applications.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-8 flex h-11 w-full items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {loading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        {error && <p className="mt-3 text-center text-sm text-destructive" role="alert">{error}</p>}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to use JobPilot responsibly.
        </p>
      </div>
    </main>
  );
}

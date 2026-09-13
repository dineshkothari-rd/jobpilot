"use client";

import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (signInError) throw signInError;
    } catch {
      setError("Sign-in could not start. Check your connection and try again.");
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
          {loading ? "Opening Google…" : "Continue with Google"}
        </button>

        {error && <p className="mt-3 text-center text-sm text-destructive" role="alert">{error}</p>}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to use JobPilot responsibly.
        </p>
      </div>
    </main>
  );
}

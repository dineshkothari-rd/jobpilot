"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, type FormEvent } from "react";
type Settings = {
  anonymous: boolean;
  version: number;
  discoverable: boolean;
  share_contact: boolean;
  resume_id: string | null;
};
export function CandidateVisibility() {
  const [settings, setSettings] = useState<Settings | null>(null),
    [resumes, setResumes] = useState<{ id: string; file_name: string }[]>([]),
    [profile, setProfile] = useState<{
      full_name: string;
      target_role: string;
      location: string;
      experience_years: number;
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function load() {
    const response = await fetch("/api/candidate-visibility", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    setSettings(data.settings);
    setResumes(data.resumes);
    setProfile(data.profile);
  }
  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const response = await fetch("/api/candidate-visibility", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!stopped) {
          setSettings(data.settings);
          setResumes(data.resumes);
          setProfile(data.profile);
        }
      } catch (cause) {
        if (!stopped) setError((cause as Error).message);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/candidate-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setMessage("Recruiter privacy settings saved.");
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Recruiter visibility & privacy</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Private by default. Discoverability shares your name, target role,
        location and experience with verified recruiters. Anonymous mode hides
        your name and keeps all resumes and contact details private.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}{" "}
          <button
            className="underline"
            onClick={() =>
              void load().catch((cause) => setError(cause.message))
            }
          >
            Reload
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      {settings && (
        <form className="mt-4" onSubmit={save}>
          <fieldset disabled={busy} className="space-y-3">
            <p className="text-sm">
              Profile preview:{" "}
              {settings.anonymous
                ? "Anonymous candidate"
                : profile?.full_name || "Name not set"}{" "}
              · {profile?.target_role || "Role not set"} ·{" "}
              {profile?.location || "Location not set"} ·{" "}
              {profile?.experience_years ?? "Unspecified"} years
            </p>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.discoverable}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discoverable: e.target.checked,
                    ...(!e.target.checked
                      ? { share_contact: false, resume_id: null }
                      : {}),
                  })
                }
              />
              Allow verified recruiters to view my profile
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!settings.discoverable}
                checked={settings.anonymous}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    anonymous: e.target.checked,
                    ...(e.target.checked
                      ? { share_contact: false, resume_id: null }
                      : {}),
                  })
                }
              />
              Anonymous profile (hide name, resume and contact)
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!settings.discoverable || settings.anonymous}
                checked={settings.share_contact}
                onChange={(e) =>
                  setSettings({ ...settings, share_contact: e.target.checked })
                }
              />
              Also share my confirmed account email
            </label>
            <label className="block text-sm">
              Resume text to share (optional)
              <select
                disabled={!settings.discoverable || settings.anonymous}
                value={settings.resume_id || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    resume_id: e.target.value || null,
                  })
                }
                className="mt-1 w-full rounded-lg border bg-background p-2"
              >
                <option value="">Keep all resumes private</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.file_name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              Turning visibility off removes recruiter access to this profile.
              Applications you explicitly submitted remain shared until you
              withdraw them. Shared resume text may contain contact details,
              even if account-email sharing is off. Private tracker notes,
              original PDFs and unselected resumes are never included. Opted-in
              non-anonymous profiles can receive in-app contact from verified
              recruiters after shortlisting. Block company contact in your
              hiring inbox. Viewing shared profiles or resumes creates an in-app
              notice.
            </p>
            <Button type="submit">Save privacy settings</Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

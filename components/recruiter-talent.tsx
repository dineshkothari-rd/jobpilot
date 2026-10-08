"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
type Candidate = {
  id: string;
  featured?: boolean;
  full_name: string;
  target_role: string;
  location: string;
  experience_years: number;
  anonymous: boolean;
  shortlist_id: string | null;
  shortlist_status: string | null;
  shortlist_notes: string;
  shortlist_version: number;
};
type Profile = {
  full_name: string;
  target_role: string;
  location: string;
  experience_years: number;
  contact_email: string | null;
  resume_text: string | null;
};
export function RecruiterTalent({ verified }: { verified: boolean }) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]),
    [revision, setRevision] = useState(0),
    [filters, setFilters] = useState(""),
    [offset, setOffset] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<Candidate | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [stage, setStage] = useState("shortlist"),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const url = useCallback(
    () =>
      `/api/recruiter/candidates?${filters}&offset=${offset}&revision=${revision}`,
    [filters, offset, revision],
  );
  const load = useCallback(async () => {
    const response = await fetch(url(), { cache: "no-store" }),
      data = await response.json();
    if (!response.ok) throw Error(data.error);
    setCandidates(data.candidates);
    setHasMore(data.has_more);
  }, [url]);
  useEffect(() => {
    if (!verified) return;
    let stopped = false;
    void fetch(url(), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!stopped) {
          setCandidates(data.candidates);
          setHasMore(data.has_more);
          setLoading(false);
          setError("");
        }
      })
      .catch((cause) => {
        if (!stopped) {
          setError(cause.message);
          setLoading(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, [url, verified]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      params = new URLSearchParams();
    for (const key of ["role", "location", "skill", "experience"]) {
      const value = String(form.get(key) || "").trim();
      if (value) params.set(key, value);
    }
    if (form.get("shortlists")) params.set("shortlists", "true");
    setLoading(true);
    setOffset(0);
    setFilters(params.toString());
    setRevision((value) => value + 1);
  }
  async function review(candidate: Candidate) {
    if (
      selected &&
      note !== selected.shortlist_notes &&
      !window.confirm("Discard your unsaved private note?")
    )
      return;
    setError("");
    setNotice("");
    setSelected(null);
    setProfile(null);
    try {
      const response = await fetch(
          `/api/recruiter/candidates?id=${candidate.id}`,
          { cache: "no-store" },
        ),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setSelected(candidate);
      setProfile(data.profile);
      setStage(candidate.shortlist_status || "shortlist");
      setNote(candidate.shortlist_notes || "");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/recruiter/candidates", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidate_id: selected.id,
            version: selected.shortlist_version,
            status: stage,
            notes: note,
          }),
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setSelected(null);
      setProfile(null);
      setNotice("Sourcing stage and private recruiter note saved.");
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function contact() {
    if (!selected || lock.current) return;
    if (
      note !== selected.shortlist_notes &&
      !window.confirm("Continue without saving your private note?")
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/hiring-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "open", candidate_id: selected.id }),
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      router.push(`/inbox?thread=${data.thread_id}`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!verified) return null;
  return (
    <section className="rounded-2xl border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Discover opted-in talent</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Verified recruiters can search shared roles, skills, experience and
        location. Anonymous profiles hide name, resume and contact. Viewing
        shared content creates a candidate-visible notice.
      </p>
      <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3">
        <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
          {["role", "location", "skill"].map((key) => (
            <label key={key} className="text-sm capitalize">
              {key}
              <input
                name={key}
                maxLength={100}
                className="mt-1 block w-full rounded-lg border bg-background p-2"
              />
            </label>
          ))}
          <label className="text-sm">
            Minimum years
            <input
              name="experience"
              type="number"
              min={0}
              max={80}
              className="mt-1 block w-24 rounded-lg border bg-background p-2"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input name="shortlists" type="checkbox" />
            My sourcing pipeline only
          </label>
          <Button type="submit">Search talent</Button>
        </fieldset>
      </form>
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
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="mt-4">Loading talent…</p>
      ) : (
        !candidates.length &&
        !error && (
          <p className="mt-4 text-sm">
            No opted-in candidates match this search.
          </p>
        )
      )}
      <div className="mt-4 space-y-3">
        {candidates.map((candidate) => (
          <article key={candidate.id} className="rounded-xl border p-4">
            <h3 className="font-semibold">
              {candidate.full_name || "Candidate"}{candidate.featured && <span className="ml-2 rounded border px-2 py-1 text-xs">Featured</span>}
            </h3>
            <p className="mt-1 text-sm">
              {candidate.target_role || "Role not set"} ·{" "}
              {candidate.location || "Location not set"} ·{" "}
              {candidate.experience_years ?? "Unspecified"} years
              {candidate.shortlist_status
                ? ` · ${candidate.shortlist_status.replaceAll("_", " ")}`
                : ""}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              disabled={busy}
              onClick={() => void review(candidate)}
            >
              Review shared profile
            </Button>
          </article>
        ))}
      </div>
      {selected && profile && (
        <form onSubmit={save} className="mt-5 space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">{profile.full_name}</h3>
          <p className="text-sm">
            {profile.contact_email || "Email not shared"}
          </p>
          {profile.resume_text && (
            <details>
              <summary>Shared resume text</summary>
              <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm">
                {profile.resume_text}
              </pre>
            </details>
          )}
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-sm">
              Sourcing stage
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                className="ml-2 rounded-lg border bg-background p-2"
              >
                {["shortlist", "in_review", "contacted", "passed"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-sm">
              Private recruiter note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={4000}
                rows={3}
                className="mt-1 w-full rounded-lg border bg-background p-2"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save sourcing stage</Button>
              <Button
                variant="outline"
                type="button"
                disabled={
                  selected.anonymous ||
                  !selected.shortlist_id ||
                  stage === "passed"
                }
                onClick={() => void contact()}
              >
                Message / invite
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (
                    note === selected.shortlist_notes ||
                    window.confirm("Discard unsaved note?")
                  ) {
                    setSelected(null);
                    setProfile(null);
                  }
                }}
              >
                Close
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Save a shortlist before contacting. Anonymous profiles cannot be
              contacted through sourcing. Notes here are private to your
              company.
            </p>
          </fieldset>
        </form>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          disabled={busy || offset === 0}
          onClick={() => {
            setLoading(true);
            setOffset(Math.max(0, offset - 50));
          }}
        >
          Previous talent
        </Button>
        <Button
          variant="outline"
          disabled={busy || !hasMore}
          onClick={() => {
            setLoading(true);
            setOffset(offset + 50);
          }}
        >
          Next talent
        </Button>
      </div>
    </section>
  );
}

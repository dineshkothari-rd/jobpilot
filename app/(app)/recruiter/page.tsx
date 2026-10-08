"use client";
import { EmployerBranding } from "@/components/employer-branding";
import { RecruiterApplicants } from "@/components/recruiter-applicants";
import { RecruiterTalent } from "@/components/recruiter-talent";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
type Company = {
  id: string;
  name: string;
  domain: string;
  website: string;
  verification_status: string;
  corporate_email_verified: boolean;
  version: number;
};
type Posting = {
  id: string;
  version: number;
  title: string;
  description: string;
  location: string;
  country: string;
  employment_type: string;
  seniority: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  equity_min: number | null;
  equity_max: number | null;
  skills: string[];
  application_url: string;
  posting_status: string;
  updated_at: string;
};
type Verification = {
  id: string;
  status: string;
  review_note: string | null;
  created_at: string;
};
type Workspace = {
  company: Company | null;
  jobs: Posting[];
  verifications: Verification[];
  counts?: Record<string, number>;
  has_more?: boolean;
};
const field = "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm";
const panel = "rounded-2xl border bg-background p-5 sm:p-6";
const blank = {
  title: "",
  description: "",
  location: "",
  country: "India",
  employment_type: "full-time",
  seniority: "Not specified",
  salary_min: "",
  salary_max: "",
  salary_currency: "INR",
  equity_min: "",
  equity_max: "",
  skills: "",
  application_url: "",
};
type Draft = typeof blank;
export default function RecruiterPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank),
    [editing, setEditing] = useState<Posting | null>(null),
    [editorOpen, setEditorOpen] = useState(false);
  const lock = useRef(false);
  const [offset, setOffset] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch(`/api/recruiter?offset=${offset}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "Unable to load recruiter workspace.");
    setWorkspace(data);
  }, [offset]);
  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const response = await fetch(`/api/recruiter?offset=${offset}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!stopped) setWorkspace(data);
      } catch (cause) {
        if (!stopped) setError((cause as Error).message);
      }
    })();
    return () => {
      stopped = true;
    };
  }, [offset]);
  async function action(work: () => Promise<void>, notice: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      await load();
      setMessage(notice);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function send(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Unable to save this change.");
  }
  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    void action(
      () => send("/api/recruiter", values),
      "Company registered. Your verification request is awaiting admin review.",
    );
  }
  function requestReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    void action(
      () =>
        send("/api/recruiter/verification", {
          ...values,
          company_id: workspace!.company!.id,
          version: workspace!.company!.version,
        }),
      "Verification request submitted.",
    );
  }
  function edit(job: Posting) {
    if (editorOpen && !window.confirm("Discard the current job draft?")) return;
    setEditing(job);
    setDraft({
      ...blank,
      ...Object.fromEntries(
        Object.keys(blank).map((key) => [
          key,
          key === "skills"
            ? job.skills.join(", ")
            : String(job[key as keyof Posting] ?? ""),
        ]),
      ),
    });
    setEditorOpen(true);
    setMessage("");
  }
  async function savePosting(status: string, job?: Posting) {
    if (
      status === "published" &&
      !window.confirm(
        "Publish this job for candidates? Confirm salary, equity, application link and all hiring claims are accurate.",
      )
    )
      return;
    if (
      status === "closed" &&
      !window.confirm(
        "Close this job permanently? Create a new draft if you hire again.",
      )
    )
      return;
    await action(
      async () => {
        const fields = job
          ? { ...job, posting_status: status }
          : {
              ...draft,
              skills: draft.skills
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              ...Object.fromEntries(
                ["salary_min", "salary_max", "equity_min", "equity_max"].map(
                  (key) => [
                    key,
                    draft[key as keyof Draft] === ""
                      ? null
                      : Number(draft[key as keyof Draft]),
                  ],
                ),
              ),
              posting_status: status,
            };
        await send("/api/recruiter/jobs", {
          company_id: workspace!.company!.id,
          id: job?.id || editing?.id || null,
          version: job?.version || editing?.version || 0,
          fields,
        });
        if (!job) {
          setEditing(null);
          setDraft(blank);
          setEditorOpen(false);
        }
      },
      status === "published" ? "Job published." : "Job posting saved.",
    );
  }
  const company = workspace?.company;
  const counts = (status: string) =>
    workspace?.counts?.[status] ??
    workspace?.jobs.filter((j) => j.posting_status === status).length ??
    0;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary">
            For employers & recruiters
          </p>
          <h1 className="mt-1 text-2xl font-bold">Hiring workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify your company, manage postings and build your hiring presence.
          </p>
        </div>
        <Link href="/jobs" className="text-sm text-primary underline">
          Switch to candidate workspace
        </Link>
      </header>
      {company ? <nav className="journey-navigation grid gap-2 sm:grid-cols-3" aria-label="Hiring journey">
        {[{label:"Set up your company",href:"#hiring-company"},{label:"Find your next teammate",href:"#hiring-talent"},{label:"Manage your openings",href:"#hiring-postings"}].map(({label,href},index) => <a key={label} href={href} className="journey-stop flex min-h-11 items-center gap-3 rounded-xl p-3 text-xs font-semibold"><span className="text-muted-foreground">0{index + 1}</span>{label}</a>)}
      </nav> : null}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
          <Button
            className="ml-3"
            variant="outline"
            disabled={busy}
            onClick={() => void action(load, "Workspace refreshed.")}
          >
            Retry
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="rounded-xl border p-4 text-sm">
          {message}
        </p>
      )}
      {!workspace && !error && <p role="status">Loading hiring workspace…</p>}
      {workspace && !company && (
        <section className={panel}>
          <h2 className="text-lg font-semibold">Register your company</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use a confirmed work email where possible. A matching corporate
            email is checked against your company website domain. Admins review
            your business evidence before approving publishing. One company per
            account; registering does not claim an existing company profile.
          </p>
          <form onSubmit={register} className="mt-5 grid gap-4 sm:grid-cols-2">
            <fieldset disabled={busy} className="contents">
              <label className="text-sm">
                Company name
                <input
                  className={field}
                  name="name"
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>
              <label className="text-sm">
                Your full name
                <input
                  className={field}
                  name="contact_name"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Company website
                <input
                  className={field}
                  name="website"
                  type="url"
                  placeholder="https://yourcompany.com"
                  maxLength={2048}
                  required
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Business verification document link
                <input
                  className={field}
                  name="evidence_url"
                  type="url"
                  placeholder="HTTPS link accessible to JobPilot reviewers"
                  maxLength={2048}
                  required
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Provide company registration or other evidence of hiring
                  authority. It stays private to you and admins. Do not include
                  unnecessary personal documents.
                </span>
              </label>
              <label className="text-sm sm:col-span-2">
                Your role and verification details
                <textarea
                  className={field}
                  name="details"
                  minLength={20}
                  maxLength={2000}
                  rows={4}
                  required
                />
              </label>
              <Button type="submit">Register & request verification</Button>
            </fieldset>
          </form>
        </section>
      )}
      {company && (
        <>
          <nav aria-label="Hiring workspace sections" className="section-shortcuts flex flex-wrap gap-2">{[["company", "Company"], ["branding", "Branding"], ["talent", "Talent search"], ["applicants", "Applicants"], ["postings", "Job postings"]].map(([id,label]) => <a key={id} href={`#hiring-${id}`}>{label}</a>)}</nav>
          <section id="hiring-company" className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{company.name}</h2>
              <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                Company: {company.verification_status}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {company.domain} · Corporate email{" "}
              {company.corporate_email_verified
                ? "confirmed and matched"
                : "not matched; business evidence requires manual review"}
            </p>
            {company.verification_status !== "verified" && (
              <p className="mt-3 text-sm">
                Drafts are private. Company approval is required to publish.
              </p>
            )}
            {workspace!.verifications.slice(0, 3).map((v) => (
              <div key={v.id} className="mt-3 border-t pt-3 text-sm">
                <p>
                  Verification {v.status} ·{" "}
                  {new Date(v.created_at).toLocaleDateString()}
                </p>
                {v.review_note && (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    Admin: {v.review_note}
                  </p>
                )}
              </div>
            ))}
            {["rejected", "revoked"].includes(company.verification_status) && (
              <form className="mt-4 space-y-3" onSubmit={requestReview}>
                <fieldset disabled={busy} className="space-y-3">
                  <label className="block text-sm">
                    Updated business evidence
                    <input
                      name="evidence_url"
                      className={field}
                      type="url"
                      maxLength={2048}
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    Explain the changes
                    <textarea
                      name="details"
                      className={field}
                      minLength={20}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <Button variant="outline" type="submit">
                    Request another review
                  </Button>
                </fieldset>
              </form>
            )}
          </section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["published", "draft", "paused", "closed"].map((status) => (
              <div key={status} className={panel}>
                <p className="text-xs capitalize text-muted-foreground">
                  {status} jobs
                </p>
                <p className="mt-2 text-2xl font-bold">{counts(status)}</p>
              </div>
            ))}
          </div>
          <div id="hiring-branding"><EmployerBranding
            companyId={company.id}
            verified={company.verification_status === "verified"}
          />
          </div><div id="hiring-talent"><RecruiterTalent
            verified={company.verification_status === "verified"}
          />
          </div><div id="hiring-applicants"><RecruiterApplicants
            verified={company.verification_status === "verified"}
            jobs={workspace!.jobs}
          />
          </div><section id="hiring-postings" className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Job postings & recent activity
              </h2>
              <Button
                disabled={busy || editorOpen}
                onClick={() => {
                  setEditing(null);
                  setDraft(blank);
                  setEditorOpen(true);
                }}
              >
                Create job draft
              </Button>
            </div>
            {workspace!.jobs.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                No postings yet. Create your first draft.
              </p>
            )}
            <div className="mt-4 space-y-3">
              {workspace!.jobs.map((job) => (
                <article key={job.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{job.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.location} · {job.posting_status} · Updated{" "}
                        {new Date(job.updated_at).toLocaleString()}
                      </p>
                    </div>
                    {job.posting_status === "published" && (
                      <Link
                        className="text-sm text-primary underline"
                        href={`/jobs/${job.id}`}
                      >
                        View listing
                      </Link>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy || job.posting_status === "closed"}
                      onClick={() => edit(job)}
                    >
                      Edit
                    </Button>
                    {job.posting_status !== "published" &&
                      job.posting_status !== "closed" && (
                        <Button
                          variant="outline"
                          disabled={
                            busy ||
                            editorOpen ||
                            company.verification_status !== "verified"
                          }
                          onClick={() => void savePosting("published", job)}
                        >
                          Publish
                        </Button>
                      )}
                    {job.posting_status === "published" && (
                      <Button
                        variant="outline"
                        disabled={busy || editorOpen}
                        onClick={() => void savePosting("paused", job)}
                      >
                        Pause
                      </Button>
                    )}
                    {job.posting_status !== "closed" && (
                      <Button
                        variant="outline"
                        disabled={busy || editorOpen}
                        onClick={() => void savePosting("closed", job)}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                disabled={busy || editorOpen || offset === 0}
                onClick={() => {
                  setWorkspace(null);
                  setOffset(Math.max(0, offset - 50));
                }}
              >
                Previous postings
              </Button>
              <Button
                variant="outline"
                disabled={busy || editorOpen || !workspace!.has_more}
                onClick={() => {
                  setWorkspace(null);
                  setOffset(offset + 50);
                }}
              >
                Next postings
              </Button>
            </div>
          </section>
          {editorOpen && (
            <section className={panel}>
              <h2 className="text-lg font-semibold">
                {editing ? "Edit job posting" : "New job draft"}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Salary is annual; disclose equity ownership percentages only
                when known. Descriptions use plain text. Drafts are saved before
                publishing.
              </p>
              <form
                className="mt-5 grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void savePosting(editing?.posting_status || "draft");
                }}
              >
                <fieldset disabled={busy} className="contents">
                  {(
                    [
                      "title",
                      "location",
                      "country",
                      "seniority",
                      "application_url",
                      "skills",
                    ] as const
                  ).map((key) => (
                    <label key={key} className="text-sm">
                      {
                        {
                          title: "Job title",
                          location: "Location / remote or hybrid",
                          country: "Country",
                          seniority: "Experience level",
                          application_url: "External application URL",
                          skills: "Skills (comma separated)",
                        }[key]
                      }
                      <input
                        className={field}
                        type={key === "application_url" ? "url" : "text"}
                        required
                        maxLength={
                          key === "application_url"
                            ? 2048
                            : key === "skills"
                              ? 2400
                              : key === "location"
                                ? 300
                                : key === "title"
                                  ? 200
                                  : 100
                        }
                        value={draft[key]}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label className="text-sm">
                    Employment type
                    <select
                      className={field}
                      value={draft.employment_type}
                      onChange={(e) =>
                        setDraft({ ...draft, employment_type: e.target.value })
                      }
                    >
                      {["full-time", "part-time", "contract", "internship"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="text-sm">
                    Salary currency
                    <select
                      className={field}
                      value={draft.salary_currency}
                      onChange={(e) =>
                        setDraft({ ...draft, salary_currency: e.target.value })
                      }
                    >
                      {["INR", "USD", "EUR", "GBP", "CAD", "AUD"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      "salary_min",
                      "salary_max",
                      "equity_min",
                      "equity_max",
                    ] as const
                  ).map((key) => (
                    <label key={key} className="text-sm">
                      {
                        {
                          salary_min: "Annual salary minimum",
                          salary_max: "Annual salary maximum",
                          equity_min: "Equity minimum (%)",
                          equity_max: "Equity maximum (%)",
                        }[key]
                      }
                      <input
                        className={field}
                        type="number"
                        min={0}
                        max={key.startsWith("equity") ? 100 : 2147483647}
                        step={key.startsWith("equity") ? "0.001" : "1"}
                        value={draft[key]}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label className="text-sm sm:col-span-2">
                    Job description
                    <textarea
                      className={field}
                      minLength={50}
                      maxLength={10000}
                      rows={8}
                      required
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button type="submit">
                      Save {editing?.posting_status || "draft"}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        if (window.confirm("Discard this unsaved job draft?")) {
                          setEditorOpen(false);
                          setEditing(null);
                          setDraft(blank);
                        }
                      }}
                    >
                      Discard draft
                    </Button>
                  </div>
                </fieldset>
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
}

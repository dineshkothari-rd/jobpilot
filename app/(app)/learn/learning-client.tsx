"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ArrowRight, Award, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { learningPaths } from "@/lib/learning/catalog";
import type { Attempt, Credential, Enrollment } from "@/lib/learning/model";

export type LearningData = {
  enrollments: Enrollment[];
  credentials: Credential[];
  attempts: Attempt[];
  storageReady: boolean;
  setupMessage: string;
  targetRole: string;
  personalizationAvailable: boolean;
  recommendations: { pathId: string; score: number; reason: string }[];
  questions: { prompt: string; options: string[] }[];
};
export type MutationResult = { enrollment?: Enrollment; credential?: Credential; attempt?: Attempt; score?: number; passed?: boolean; feedback?: { correct: boolean; explanation: string }[] };

export async function learningMutation(body: Record<string, unknown>): Promise<MutationResult> {
  const response = await fetch("/api/learn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save. Keep your edits and retry.");
  return result;
}

export function useLearningData(pathId?: string) {
  const [data, setData] = useState<LearningData | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learn${pathId ? "?path=" + encodeURIComponent(pathId) : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load learning.");
        if (![result.enrollments, result.credentials, result.attempts, result.questions, result.recommendations].every(Array.isArray)) throw new Error("Learning response was incomplete. Retry.");
        if (!controller.signal.aborted) { setData(result); setError(""); }
      }).catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load learning."); });
    return () => controller.abort();
  }, [pathId, reload]);
  return { data, setData, error, setError, retry: () => setReload((value) => value + 1) };
}

export function useUnsavedLearning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link?.getAttribute("href")?.startsWith("/") && !link.hasAttribute("target") && !link.hasAttribute("download") && !window.confirm("Leave and discard unsaved learning edits?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
}

export function CredentialList({ credentials, storageReady, busy, mutate }: {
  credentials: Credential[]; storageReady: boolean; busy: boolean;
  mutate: (body: Record<string, unknown>) => Promise<MutationResult | null>;
}) {
  if (!credentials.length) return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No credentials yet. Add an actually earned provider credential, or complete a JobPilot path.</p>;
  return <div className="space-y-3">{credentials.map((credential) => <article key={credential.id} className="surface p-4">
    <p className="section-label">{credential.kind === "jobpilot" ? "JobPilot completion record" : "User-added provider credential · not verified"}</p>
    <h3 className="mt-2 font-bold">{credential.title}</h3><p className="mt-1 text-sm text-muted-foreground">{credential.issuer} · Issued {credential.issued_on}{credential.expires_on ? " · Expires " + credential.expires_on : ""}</p>
    {credential.revoked_at ? <p className="mt-2 text-sm text-destructive">Revoked; downloads and public verification are disabled.</p> : null}
    {credential.credential_ref ? <p className="mt-2 break-all text-xs text-muted-foreground">Credential ID: {credential.credential_ref}</p> : null}
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      {credential.kind === "external" && credential.verification_url ? <a href={credential.verification_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-primary underline">Check on issuer site <ExternalLink className="size-3" /></a> : null}
      {credential.kind === "external" ? <Button variant="outline" size="sm" disabled={busy || !storageReady} onClick={() => { if (window.confirm("Delete this user-added credential?")) void mutate({ action: "deleteCredential", id: credential.id }); }}>Delete entry</Button> : null}
      {credential.kind === "jobpilot" && !credential.revoked_at ? <>
        <a href={`/api/learn/certificate?id=${credential.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary underline">Print / save PDF</a>
        <a href={`/api/learn/certificate?id=${credential.id}&download=1`} download className="inline-flex min-h-11 items-center text-primary underline">Download HTML</a>
        <Button size="sm" variant="outline" disabled={busy || !storageReady} onClick={() => {
          const name = credential.is_public ? "" : window.prompt("Public sharing exposes ONLY your chosen display name, path title, issuer, issue date and record ID. Enter the name you want publicly shown; Cancel keeps this private.");
          if (name === null) return;
          void mutate({ action: "share", id: credential.id, enabled: !credential.is_public, publicName: name });
        }}>{credential.is_public ? "Stop sharing" : "Enable public sharing"}</Button>
        {credential.is_public ? <Link href={`/verify/learning/${credential.id}`} target="_blank" className="inline-flex min-h-11 items-center text-primary underline">Public record</Link> : null}
        <Button size="sm" variant="outline" disabled={busy || !storageReady} onClick={() => { if (window.confirm("Permanently revoke this JobPilot completion record? It cannot be reissued for this path.")) void mutate({ action: "revoke", id: credential.id }); }}>Revoke</Button>
      </> : null}
    </div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{credential.kind === "external" ? "A supplied verification link is not automatic provider verification. Check authenticity with the issuer." : "Self-reported exercises/project plus a short knowledge check. Not accredited or identity-verified; not a provider certificate."}</p>
  </article>)}</div>;
}

export function LearningHome({ initialQuery = "" }: { initialQuery?: string }) {
  const { data, setData, error, setError, retry } = useLearningData();
  const [tab, setTab] = useState<"my" | "explore" | "credentials">(initialQuery ? "explore" : "my");
  const [query, setQuery] = useState(initialQuery);
  const [level, setLevel] = useState("");
  const [credentialOnly, setCredentialOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requestId = useRef<string | null>(null);
  const [draft, setDraft] = useState({ title: "", issuer: "", issued_on: "", expires_on: "", verification_url: "", credential_ref: "", confirmed: false });
  const dirty = Object.entries(draft).some(([key, value]) => key !== "confirmed" && Boolean(value));
  useUnsavedLearning(dirty);
  const mutate = async (body: Record<string, unknown>) => {
    if (lock.current || !data?.storageReady) return null;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await learningMutation(body);
      if (result.credential) {
        const saved = result.credential;
        setData((current) => current ? { ...current, credentials: body.action === "deleteCredential" ? current.credentials.filter((item) => item.id !== saved.id) : [saved, ...current.credentials.filter((item) => item.id !== saved.id)] } : current);
      }
      return result;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save credential."); return null; }
    finally { lock.current = false; setBusy(false); }
  };
  const recommendations = (data?.recommendations || []).slice(0, 3);
  const visible = learningPaths.filter((path) => `${path.title} ${path.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()) && (!level || path.level === level) && (!credentialOnly || path.credential));
  const active = data?.enrollments[0];
  const activePath = learningPaths.find((path) => path.id === active?.path_id);
  const nextPath = activePath || learningPaths.find((path) => path.id === recommendations[0]?.pathId) || learningPaths[0];
  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
    <header className="surface ai-surface p-5 sm:p-7"><p className="section-label">SkillPath · Learn → Build → Prove → Apply</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Your next skill. Your next opportunity.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Read original lessons, watch supported videos and practise inside JobPilot. Free learning, practical projects and honest credentials—no payment or credit-card trial required. External provider certificates have separate requirements.</p></header>
    <div role="status" className="mt-4 text-sm">{!data && !error ? "Loading your learning… You can still explore the free catalogue below." : ""}</div>
    {error ? <div role="alert" className="surface mt-3 p-4 text-sm"><p>{error}</p><Button size="sm" variant="outline" className="mt-3" onClick={retry}>Retry loading</Button></div> : null}
    {data && !data.storageReady ? <p role="status" className="surface mt-3 p-4 text-sm leading-6">{data.setupMessage}</p> : null}
    <nav aria-label="Learning sections" className="my-5 flex flex-wrap gap-2">{([ ["my", "My learning", BookOpen], ["explore", "Explore", ArrowRight], ["credentials", "My credentials", Award] ] as const).map(([id, title, Icon]) => <Button key={id} variant={tab === id ? "default" : "outline"} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon className="size-4" />{title}</Button>)}</nav>
    {tab === "my" ? <div className="space-y-6">
      <section className="surface p-5"><p className="section-label">Your next action</p><h2 className="mt-2 text-xl font-bold">{activePath ? "Continue " : "Explore "}{nextPath.title}</h2><p className="mt-2 text-sm text-muted-foreground">{active ? `${active.completed.length} of ${nextPath.lessons.length} exercises marked complete. External viewing is not tracked automatically.` : "Choose a path and learn at your pace. A resume is optional."}</p><Link href={`/learn/${nextPath.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-primary">{activePath ? "Continue learning" : "View path"}<ArrowRight className="size-4" /></Link></section>
      {data?.enrollments.length ? <section><h2 className="mb-3 text-lg font-bold">Your paths</h2><div className="grid gap-3 sm:grid-cols-2">{data.enrollments.map((enrollment) => {
        const path = learningPaths.find((item) => item.id === enrollment.path_id);
        return path ? <Link key={path.id} href={`/learn/${path.id}`} className="surface interactive-card p-4"><h3 className="font-bold">{path.title}</h3><p className="mt-2 text-sm text-muted-foreground">{enrollment.completed.length}/{path.lessons.length} exercises · {enrollment.minutes_per_day} minutes/day</p><progress aria-label={`${path.title} progress`} value={enrollment.completed.length} max={path.lessons.length} className="mt-3 h-2 w-full accent-primary" /></Link> : null;
      })}</div></section> : null}
      <section><h2 className="mb-3 text-lg font-bold">Suggested for you</h2>{data && !data.personalizationAvailable ? <p className="mb-3 text-sm text-muted-foreground">Some career data could not load; these suggestions may be incomplete. Browse freely or retry.</p> : null}<div className="grid gap-3 lg:grid-cols-3">{(recommendations.length ? recommendations : learningPaths.slice(0, 3).map((path) => ({ pathId: path.id, score: 0, reason: "Explore a free path; no profile setup required." }))).map((item) => {
        const path = learningPaths.find((path) => path.id === item.pathId);
        return path ? <article key={path.id} className="surface flex flex-col p-5"><p className="section-label">{path.level} · Free learning</p><h3 className="mt-2 font-bold">{path.title}</h3><p className="mt-3 text-xs leading-6 text-muted-foreground">{item.reason}</p><Link href={`/learn/${path.id}`} className="mt-auto pt-4 font-semibold text-primary">View path →</Link></article> : null;
      })}</div><Link href="/profile" className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline">Change your target role in Profile</Link></section>
    </div> : null}
    {tab === "explore" ? <section>
      <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-3"><label className="text-sm font-semibold">Skill or topic<input value={query} onChange={(event) => setQuery(event.target.value)} type="search" className="mt-2 h-11 w-full rounded-lg border bg-background px-3" placeholder="React, SQL, accessibility…" /></label><label className="text-sm font-semibold">Level<select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3"><option value="">All levels</option><option>Beginner</option><option>Intermediate</option></select></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={credentialOnly} onChange={(event) => setCredentialOnly(event.target.checked)} />Has a free provider credential route</label></div>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">A provider route has separate full-course requirements. Finishing a short JobPilot path does not earn that provider&apos;s credential. All current resources are English; other languages are not yet curated.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((path) => <article key={path.id} className="surface p-5"><p className="section-label">{path.level} · {path.lessons.length} modules</p><h2 className="mt-2 text-lg font-bold">{path.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{path.description}</p><p className="mt-3 text-xs text-muted-foreground">{path.skills.join(" · ")}</p><p className="mt-3 text-xs font-semibold">{path.credential ? "Separate free provider credential route available" : "Free learning · no external credential included"}</p><Link href={`/learn/${path.id}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary">View free path →</Link></article>)}</div>
      {!visible.length ? <p className="surface p-6 text-sm">No matching paths. Clear a filter or try another topic.</p> : null}
    </section> : null}
    {tab === "credentials" ? <section className="space-y-5">
      <h2 className="text-xl font-bold">What you actually earned</h2><CredentialList credentials={data?.credentials || []} storageReady={Boolean(data?.storageReady)} busy={busy} mutate={mutate} />
      <details className="surface p-5" open={dirty || undefined}><summary className="cursor-pointer font-bold">Add an earned provider credential</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">This is a private, user-added record—not automatic verification or a new certificate. Do not add unfinished courses as earned credentials.</p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={async (event) => {
          event.preventDefault(); requestId.current ||= crypto.randomUUID();
          const result = await mutate({ action: "credential", requestId: requestId.current, credential: draft });
          if (result) { setDraft({ title: "", issuer: "", issued_on: "", expires_on: "", verification_url: "", credential_ref: "", confirmed: false }); requestId.current = null; }
        }}>
          {([ ["title", "Credential title", "text", 180], ["issuer", "Issuer", "text", 120], ["issued_on", "Issue date", "date", 10], ["expires_on", "Expiry date (optional)", "date", 10], ["verification_url", "Official verification URL (optional)", "url", 2000], ["credential_ref", "Credential ID (optional)", "text", 180] ] as const).map(([key, label, type, max]) => <label key={key} className="text-sm font-semibold">{label}<input type={type} maxLength={max} required={["title", "issuer", "issued_on"].includes(key)} value={draft[key]} disabled={busy || !data?.storageReady} onChange={(event) => { requestId.current = null; setDraft((current) => ({ ...current, [key]: event.target.value, confirmed: false })); }} className="mt-2 h-11 w-full rounded-lg border bg-background px-3" /></label>)}
          <label className="flex min-h-11 items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={draft.confirmed} disabled={busy || !data?.storageReady} onChange={(event) => setDraft((current) => ({ ...current, confirmed: event.target.checked }))} className="mt-1" />This credential was actually issued to me. Save my private record.</label><Button type="submit" disabled={busy || !draft.confirmed || !data?.storageReady}>{busy ? "Saving…" : "Save credential"}</Button>
        </form>
      </details><p className="text-sm text-muted-foreground">After checking accuracy, add appropriate information in <Link href="/profile" className="text-primary underline">Profile</Link> or <Link href="/resume/studio" className="text-primary underline">Resume Studio</Link>. Nothing is changed silently.</p>
    </section> : null}
  </div>;
}

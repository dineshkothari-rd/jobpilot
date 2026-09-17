"use client";

import { Check, Copy, ExternalLink, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ApplicationAnswer, ApplicationPackage } from "@/lib/applications/package";
import { autofillPayload } from "@/lib/applications/package";
import { openConnectedApplication } from "@/lib/applications/helper";
import { embeddedApplicationUrl } from "@/extensions/autofill/payload.mjs";
import { safeExternalUrl } from "@/lib/utils";
import { mergeApplicationAnswers, type ApplicationFacts } from "@/lib/applications/facts";
import { isCurrentApplicationProgress } from "@/lib/applications/progress";
import { ApplicationFactsEditor } from "./application-facts-editor";

export function ApplicationWorkspace({ applicationId, candidateId, applicationPackage, candidateAnswers, applicationFacts, factsStorageReady, factsDirty, onFactsSaved, onFactsDirty, resumes, resumeId, onResume, updating, onConfirm }: {
  applicationId: string;
  candidateId: string;
  applicationPackage: ApplicationPackage;
  candidateAnswers: ApplicationAnswer[];
  applicationFacts: ApplicationFacts;
  factsStorageReady: boolean;
  factsDirty: boolean;
  onFactsSaved: (facts: ApplicationFacts) => void;
  onFactsDirty: (dirty: boolean) => void;
  resumes: { id: string; file_name: string }[];
  resumeId: string;
  onResume: (id: string) => void;
  updating: boolean;
  onConfirm: () => Promise<void>;
}) {
  const reviewSignature = JSON.stringify({ resumeId, candidateAnswers, applicationFacts, prepared: applicationPackage.application_answers });
  const hasResume = resumes.some((resume) => resume.id === resumeId);
  const [reviewedFor, setReviewedFor] = useState<string | null>(null);
  const reviewed = hasResume && !factsDirty && reviewedFor === reviewSignature;
  const setReviewed = (value: boolean) => setReviewedFor(value ? reviewSignature : null);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [opening, setOpening] = useState(false);
  const [companyUrl, setCompanyUrl] = useState(applicationPackage.application_url || "");
  const [sameJob, setSameJob] = useState(false);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [formOpened, setFormOpened] = useState(false);
  const progressKey = candidateId ? `jobpilot-apply-progress-v1:${candidateId}:${applicationId}` : "";
  const applicationUrl = applicationPackage.application_url || "";
  useEffect(() => {
    if (!progressKey) return;
    const timer = window.setTimeout(() => {
      try {
        const progress = JSON.parse(sessionStorage.getItem(progressKey) || "null");
        if (isCurrentApplicationProgress(progress, applicationUrl)) setFormOpened(true);
        else sessionStorage.removeItem(progressKey);
      } catch { /* Storage unavailable: normal applying still works. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [progressKey, applicationUrl]);
  const rememberOpened = () => {
    setFormOpened(true);
    if (progressKey) {
      try { sessionStorage.setItem(progressKey, JSON.stringify({ version: 1, applicationUrl, openedAt: Date.now() })); }
      catch { setFeedback("Progress cannot be saved in this browser. Keep this tab open while applying."); }
    }
  };
  const invalidateReview = () => { setReviewed(false); setSubmitted(false); };
  const confirm = async () => {
    if (!reviewed || !submitted || updating) return;
    await onConfirm();
  };
  const answers = mergeApplicationAnswers(candidateAnswers, applicationPackage.application_answers
    .filter((answer) => !Object.hasOwn(applicationFacts, answer.question)));
  const url = safeExternalUrl(applicationPackage.application_url);
  const supportedUrl = embeddedApplicationUrl(companyUrl);
  const loadEmbeddedForm = async (autofill: boolean) => {
    if (!reviewed || !sameJob || !supportedUrl || opening) return;
    setEmbeddedUrl(supportedUrl);
    rememberOpened();
    if (!autofill) return;
    setOpening(true);
    try {
      await openConnectedApplication(JSON.parse(autofillPayload(supportedUrl, candidateAnswers)), "FRAME");
      setFeedback("Form loaded below. Click the pinned helper in this JobPilot tab, then approve temporary Lever access to fill the embedded form.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Form view is available; complete it manually.");
    } finally { setOpening(false); }
  };
  const openCompanion = async () => {
    if (!reviewed || !url || opening) return;
    setOpening(true);
    try {
      await openConnectedApplication(JSON.parse(autofillPayload(url, candidateAnswers)));
      rememberOpened();
      setFeedback("Companion opened. On the actual company form, click the pinned JobPilot helper to allow autofill. JobPilot stays open.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Use the company link below.");
    } finally { setOpening(false); }
  };
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(label + " copied.");
    } catch {
      setFeedback("Copy unavailable. Select the text below and copy manually.");
    }
  };

  return (
    <section className="mt-5 space-y-5 rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-labelledby="apply-workspace-title" onClickCapture={(event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (factsDirty && link?.getAttribute("href")?.startsWith("/") && !link.hasAttribute("download") &&
        !window.confirm("Leave this application and discard unsaved answer edits?")) {
        event.preventDefault(); event.stopPropagation();
      }
    }}>
      <div>
        <h3 id="apply-workspace-title" className="font-bold">Review → apply → confirm</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{reviewed ? "Next: complete the company form. Only confirm after the employer reports success." : "Start by checking your resume and the answers below."} No paid services.</p>
        <ol aria-label="Application progress" className="mt-3 grid grid-cols-3 gap-2 text-xs">
          {["Review details", "Company form", "Confirm & track"].map((label, index) => <li key={label} aria-current={index === (!reviewed ? 0 : submitted ? 2 : 1) ? "step" : undefined} className="rounded-lg border bg-background p-2 aria-[current=step]:border-primary aria-[current=step]:text-primary">{index + 1}. {label}</li>)}
        </ol>
        {formOpened ? <p role="status" className="mt-2 text-xs leading-5">You previously opened an application link in this tab. Review facts again after reopening; filling and submission are not verified. No answers or submission confirmation are stored in browser progress.</p> : null}
        <p role="status" className="mt-2 text-xs leading-5 text-primary">{feedback}</p>
      </div>
      <details open={!reviewed} className="rounded-xl border bg-background p-3">
        <summary className="cursor-pointer text-sm font-bold">1. Review details {reviewed ? "— checked" : "— your next step"}</summary>
      <div>
        <h4 className="mt-3 text-xs font-bold">Resume to submit</h4>
        <label className="mt-2 block text-xs">Select your verified resume
          <select value={hasResume ? resumeId : ""} onChange={(event) => { onResume(event.target.value); invalidateReview(); }} className="mt-2 h-10 w-full rounded-lg border bg-background px-3"><option value="">Choose a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.file_name}</option>)}</select>
        </label>
        {hasResume ? (
          <Link href={`/resume/studio?resumeId=${encodeURIComponent(resumeId)}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-2`}>
            <FileText />Review & download resume
          </Link>
        ) : <p className="mt-2 text-xs text-muted-foreground">Select a resume above, or <Link href="/resume" className="font-semibold text-primary underline">upload your resume</Link> first.</p>}
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
        <h4 className="mt-3 text-sm font-bold">Check your application answers</h4>
          <Button size="sm" variant="outline" onClick={() => void copy(answers.map((item) => item.question + ": " + item.answer).join("\n"), "Answers")}><Copy />Copy all</Button>
        </div>
        <dl className="mt-3 space-y-2">
          {answers.map((item, index) => (
            <div key={item.question + index} className="rounded-xl border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs font-semibold">{item.question}</dt>
                <Button variant="ghost" size="icon-sm" aria-label={`Copy ${item.question}`} onClick={() => void copy(item.answer, item.question)}><Copy className="size-3.5" /></Button>
              </div>
              <dd className="select-text break-words whitespace-pre-wrap text-xs leading-5">{item.answer}</dd>
              <p className="mt-1 text-[10px] text-muted-foreground">{item.source}</p>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">CTC, OCI/citizenship, sponsorship and employer-specific questions must use your actual facts. Missing answers are never invented.</p>
        {!candidateAnswers.some((answer) => answer.question === "Full name") || !candidateAnswers.some((answer) => answer.question === "Email") ? <p className="mt-2 text-xs leading-5">Name or email is missing. <Link href="/profile" className="font-semibold text-primary underline">Check Profile</Link> and your account before completing the employer form. You can enter missing information manually there.</p> : null}
        <ApplicationFactsEditor facts={applicationFacts} storageReady={factsStorageReady} onEditing={(dirty) => { invalidateReview(); onFactsDirty(dirty); }} onSave={(facts) => { invalidateReview(); onFactsDirty(false); onFactsSaved(facts); }} />
        {applicationPackage.cover_note ? (
          <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
            <summary className="cursor-pointer font-semibold">Cover note</summary>
            <p className="mt-3 select-text whitespace-pre-wrap leading-5">{applicationPackage.cover_note}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void copy(applicationPackage.cover_note!, "Cover note")}><Copy />Copy cover note</Button>
          </details>
        ) : null}
      </div>
        <label className="mt-3 flex min-h-11 items-start gap-2 text-xs leading-5">
          <input type="checkbox" checked={reviewed} disabled={!hasResume || factsDirty} onChange={(event) => { setReviewed(event.target.checked); setSubmitted(false); }} className="mt-1" />
          I reviewed the resume and verified my answers.
        </label>
        {factsDirty ? <p role="status" className="text-xs leading-5">Save or discard your pending answer edits before continuing.</p> : null}
      </details>
      <details open={reviewed} className="rounded-xl border bg-background p-3">
        <summary className="cursor-pointer text-sm font-bold">2. Complete the company form</summary>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Upload the selected resume and complete required employer questions. Autofill only helps with known contact fields.</p>
        {url && reviewed ? (
          <a href={url} onClick={rememberOpened} target="_blank" rel="noopener noreferrer" className={`${buttonVariants({ size: "sm" })} mt-3 w-full`}><ExternalLink />Open company application</a>
        ) : <Button size="sm" disabled className="w-full">{url ? "Review your facts to continue" : "Application link unavailable"}</Button>}
        <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Optional autofill & in-app form</summary>
          <p className="mt-2 leading-5 text-muted-foreground">You can apply normally without installing anything. Use these tools only if you want help filling contact fields.</p>
          <Button variant="outline" size="sm" className="mt-2" disabled={opening} onClick={() => {
            setOpening(true);
            void openConnectedApplication(null, "CONNECT")
              .then(() => setFeedback("Helper connected. Use the companion or supported embedded form; approve access from the pinned Chrome helper."))
              .catch((error: unknown) => setFeedback(error instanceof Error ? error.message : "Helper unavailable. Use normal applying or copy/paste."))
              .finally(() => setOpening(false));
          }}>Check Chrome helper connection</Button>
        <Button variant="outline" size="sm" className="mt-2 w-full" disabled={!reviewed || !url || opening} onClick={() => void openCompanion()}>
          {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />}Apply in connected companion
        </Button>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">JobPilot remains open. Helper v1.2 receives reviewed contacts directly—no copy/paste. On the company form, clicking its pinned icon grants temporary access to that tab and fills known empty fields, with a field-by-field report.</p>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">An iframe does not give JobPilot access to another site’s form. The companion uses the actual company website, not a copied form or security-header proxy.</p>
        <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Open a supported company form inside JobPilot</summary>
          <p className="mt-3 leading-5 text-muted-foreground">Lever-hosted forms are supported. If your link opens a job listing, copy its actual company Apply URL here. Other providers use the companion fallback.</p>
          <label className="mt-3 block">
            <span className="font-semibold">Actual employer application URL</span>
            <input type="url" value={companyUrl} onChange={(event) => { setCompanyUrl(event.target.value); setSameJob(false); setEmbeddedUrl(null); }} className="mt-2 h-10 w-full rounded-lg border bg-background px-3" placeholder="https://jobs.lever.co/company/posting-id/apply" />
          </label>
          <label className="mt-3 flex min-h-11 items-start gap-2 leading-5"><input type="checkbox" checked={sameJob} onChange={(event) => setSameJob(event.target.checked)} className="mt-1" />I verified this company form is for this same job.</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Button size="sm" variant="outline" disabled={!reviewed || !sameJob || !supportedUrl} onClick={() => void loadEmbeddedForm(false)}>View form here</Button>
            <Button size="sm" disabled={!reviewed || !sameJob || !supportedUrl || opening} onClick={() => void loadEmbeddedForm(true)}>{opening ? <Loader2 className="animate-spin" /> : null}Connect embedded autofill</Button>
          </div>
          {!supportedUrl ? <p className="mt-2 text-muted-foreground">Use a Lever company/posting URL. Unsupported, login and listing URLs cannot be embedded.</p> : null}
        </details>
        {embeddedUrl ? (
          <div className="mt-3 rounded-xl border bg-background">
            <div className="border-b p-3 text-xs"><strong>Live company form: {new URL(embeddedUrl).hostname}</strong><p className="mt-1 leading-5 text-muted-foreground">This is the employer’s website. If it is blank/blocked, needs login, or does not work embedded, <a className="font-bold text-primary underline" href={embeddedUrl} target="_blank" rel="noopener noreferrer">open the real form in a company tab</a>. Final submission remains your action.</p></div>
            <iframe title="Live employer application form" src={embeddedUrl} className="h-[680px] w-full rounded-b-xl" sandbox="allow-forms allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer" />
          </div>
        ) : null}
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Opening the link does not submit or mark this application as Applied. Upload the downloaded resume; complete login/captcha if requested.</p>
        <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Free Chrome autofill — optional</summary>
          <ol className="mt-3 list-inside list-decimal space-y-2 leading-5">
            <li><a href="/jobpilot-autofill.zip" download className="font-semibold text-primary underline">Download helper</a> and unzip it.</li>
            <li>Open Chrome Extensions → enable Developer mode → Load unpacked → choose the unzipped folder. Existing users: replace helper files and click Reload.</li>
            <li>Pin the helper and reload JobPilot. Use Connected companion above, then click the helper icon on the company form. If the listing redirects, explicitly confirm that the form is for the same job.</li>
            <li>Copy/paste below remains available as a fallback.</li>
          </ol>
          <Button size="sm" variant="outline" className="mt-3" disabled={!reviewed || !url} onClick={() => {
            try { if (url) void copy(autofillPayload(url, candidateAnswers), "Autofill data"); }
            catch (error) { setFeedback(error instanceof Error ? error.message : "Autofill data unavailable. Copy answers individually or complete the form manually."); }
          }}><Copy />Copy reviewed autofill data</Button>
          <p className="mt-2 leading-5 text-muted-foreground">Contact fields only. Existing values, legal choices and unknown fields stay untouched. Connected contacts use temporary browser-session memory, expire after 10 minutes and are cleared after filling or closing the companion tab. No server upload or analytics; never clicks Submit.</p>
        </details>
        </details>
      </details>
      <div className="border-t pt-4">
        <h4 className="text-sm font-bold">3. Confirm submission & track</h4>
        <label className="mt-3 flex min-h-11 items-start gap-2 text-xs leading-5">
          <input type="checkbox" checked={submitted} disabled={!reviewed || updating} onChange={(event) => setSubmitted(event.target.checked)} className="mt-1" />
          The company website confirmed my successful submission.
        </label>
        <Button className="w-full" disabled={!reviewed || !submitted || updating} onClick={() => void confirm()}>
          {updating ? <Loader2 className="animate-spin" /> : <Check />}I submitted — next application
        </Button>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Automatically records your application date and schedules a follow-up in 7 days unless you already set one. This is your confirmation, not provider-verified proof.</p>
      </div>
    </section>
  );
}

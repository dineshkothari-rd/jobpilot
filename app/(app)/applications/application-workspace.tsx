"use client";

import { Check, Copy, ExternalLink, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ApplicationAnswer, ApplicationPackage } from "@/lib/applications/package";
import { autofillPayload } from "@/lib/applications/package";
import { openConnectedApplication } from "@/lib/applications/helper";
import { embeddedApplicationUrl } from "@/extensions/autofill/payload.mjs";
import { safeExternalUrl } from "@/lib/utils";

export function ApplicationWorkspace({ applicationPackage, candidateAnswers, updating, onConfirm }: {
  applicationPackage: ApplicationPackage;
  candidateAnswers: ApplicationAnswer[];
  updating: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [opening, setOpening] = useState(false);
  const [companyUrl, setCompanyUrl] = useState(applicationPackage.application_url || "");
  const [sameJob, setSameJob] = useState(false);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const answers = [...candidateAnswers, ...applicationPackage.application_answers];
  const url = safeExternalUrl(applicationPackage.application_url);
  const supportedUrl = embeddedApplicationUrl(companyUrl);
  const loadEmbeddedForm = async (autofill: boolean) => {
    if (!reviewed || !sameJob || !supportedUrl || opening) return;
    setEmbeddedUrl(supportedUrl);
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
    <section className="mt-5 space-y-5 rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-labelledby="apply-workspace-title">
      <div>
        <h3 id="apply-workspace-title" className="font-bold">Review → apply → confirm</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{reviewed ? "Next: complete the company form. Only confirm after the employer reports success." : "Start by checking your resume and the answers below."} No paid services.</p>
      </div>
      <div>
        <h4 className="text-xs font-bold">1. Review your tailored resume</h4>
        {applicationPackage.resume_id ? (
          <Link href={`/resume/studio?resumeId=${encodeURIComponent(applicationPackage.resume_id)}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-2`}>
            <FileText />Review & download resume
          </Link>
        ) : <p className="mt-2 text-xs text-muted-foreground">Select and verify your resume before applying.</p>}
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold">2. Check your application answers</h4>
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
        {applicationPackage.cover_note ? (
          <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
            <summary className="cursor-pointer font-semibold">Cover note</summary>
            <p className="mt-3 select-text whitespace-pre-wrap leading-5">{applicationPackage.cover_note}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void copy(applicationPackage.cover_note!, "Cover note")}><Copy />Copy cover note</Button>
          </details>
        ) : null}
        <p role="status" className="mt-2 text-xs text-primary">{feedback}</p>
      </div>
      <div className="border-t pt-4">
        <h4 className="text-sm font-bold">3. Complete the company form</h4>
        <label className="mt-3 flex min-h-11 items-start gap-2 text-xs leading-5">
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" />
          I reviewed the resume and verified my answers.
        </label>
        {url && reviewed ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className={`${buttonVariants({ size: "sm" })} w-full`}><ExternalLink />Open company application</a>
        ) : <Button size="sm" disabled className="w-full">{url ? "Review your facts to continue" : "Application link unavailable"}</Button>}
        <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Optional autofill & in-app form</summary>
          <p className="mt-2 leading-5 text-muted-foreground">You can apply normally without installing anything. Use these tools only if you want help filling contact fields.</p>
        <Button variant="outline" size="sm" className="mt-2 w-full" disabled={!reviewed || !url || opening} onClick={() => void openCompanion()}>
          {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />}Apply in connected companion
        </Button>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">JobPilot remains open. Helper v1.1 receives reviewed contacts directly—no copy/paste. On the company form, clicking its pinned icon grants temporary access to that tab and fills known empty fields.</p>
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
            if (url) void copy(autofillPayload(url, candidateAnswers), "Autofill data");
          }}><Copy />Copy reviewed autofill data</Button>
          <p className="mt-2 leading-5 text-muted-foreground">Contact fields only. Existing values, legal choices and unknown fields stay untouched. Connected contacts use temporary browser-session memory, expire after 10 minutes and are cleared after filling or closing the companion tab. No server upload or analytics; never clicks Submit.</p>
        </details>
        </details>
      </div>
      <div className="border-t pt-4">
        <h4 className="text-xs font-bold">4. Confirm & move to the next match</h4>
        <label className="mt-3 flex min-h-11 items-start gap-2 text-xs leading-5">
          <input type="checkbox" checked={submitted} disabled={!reviewed || updating} onChange={(event) => setSubmitted(event.target.checked)} className="mt-1" />
          The company website confirmed my successful submission.
        </label>
        <Button className="w-full" disabled={!reviewed || !submitted || updating} onClick={() => void onConfirm()}>
          {updating ? <Loader2 className="animate-spin" /> : <Check />}I submitted — next application
        </Button>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Automatically records your application date and schedules a follow-up in 7 days unless you already set one. This is your confirmation, not provider-verified proof.</p>
      </div>
    </section>
  );
}

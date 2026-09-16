"use client";

import { Check, Copy, ExternalLink, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ApplicationAnswer, ApplicationPackage } from "@/lib/applications/package";
import { autofillPayload } from "@/lib/applications/package";
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
  const answers = [...candidateAnswers, ...applicationPackage.application_answers];
  const url = safeExternalUrl(applicationPackage.application_url);
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
        <h3 id="apply-workspace-title" className="font-bold">Your application workspace</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Prepared for you, submitted by you. No paid AI or services.</p>
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
          <h4 className="text-xs font-bold">2. Copy your application answers</h4>
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
        <h4 className="text-xs font-bold">3. Apply on the company website</h4>
        <label className="mt-3 flex min-h-11 items-start gap-2 text-xs leading-5">
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" />
          I reviewed the resume and verified my answers.
        </label>
        {url && reviewed ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className={`${buttonVariants({ size: "sm" })} w-full`}><ExternalLink />Open company application</a>
        ) : <Button size="sm" disabled className="w-full">{url ? "Review your facts to continue" : "Application link unavailable"}</Button>}
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Opening the link does not submit or mark this application as Applied. Upload the downloaded resume; complete login/captcha if requested.</p>
        <details className="mt-3 rounded-xl border bg-background p-3 text-xs">
          <summary className="cursor-pointer font-semibold">Free Chrome autofill — optional</summary>
          <ol className="mt-3 list-inside list-decimal space-y-2 leading-5">
            <li><a href="/jobpilot-autofill.zip" download className="font-semibold text-primary underline">Download helper</a> and unzip it.</li>
            <li>Open Chrome Extensions → enable Developer mode → Load unpacked → choose the unzipped folder.</li>
            <li>Copy reviewed data below. Open the matching company form, click the helper, paste and fill.</li>
          </ol>
          <Button size="sm" variant="outline" className="mt-3" disabled={!reviewed || !url} onClick={() => {
            if (url) void copy(autofillPayload(url, candidateAnswers), "Autofill data");
          }}><Copy />Copy reviewed autofill data</Button>
          <p className="mt-2 leading-5 text-muted-foreground">Contact fields only. Existing values, legal choices and unknown fields stay untouched. Review clipboard data; clear it after use. The helper stores nothing and never clicks Submit.</p>
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

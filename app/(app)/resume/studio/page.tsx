"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { analyzeResume, applyResumeSuggestion } from "@/lib/resume/ats";
import type { ParsedResume } from "@/lib/resume/parser";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  Printer,
  Save,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type StudioData = {
  targetDescription?: string;
  sourceResumeId?: string;
  sourceSnapshot?: ParsedResume;
  acceptedSuggestionIds?: string[];
  rejectedSuggestionIds?: string[];
  completedPreparationTasks?: string[];
};

type StudioResume = ParsedResume & { studio?: StudioData };

type ResumeRecord = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  raw_text: string;
  parsed_data: StudioResume;
  is_primary: boolean;
  created_at: string;
};

type SavedJob = {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
};

const selectFields = "id,file_name,file_path,file_size,mime_type,raw_text,parsed_data,is_primary,created_at";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] || character);
}

function resumeHtml(resume: ParsedResume) {
  const list = (items: string[]) => items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const skillList = Object.values(resume.skills).flat().filter(Boolean);
  const contact = [resume.personalInfo.email, resume.personalInfo.phone, resume.personalInfo.location]
    .filter(Boolean).map(escapeHtml).join(" · ");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(resume.personalInfo.name || "Resume")}</title><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:10.5pt/1.45 Arial,sans-serif;color:#111;margin:0}h1{font-size:22pt;margin:0;text-align:center}header p{text-align:center;margin:4px 0 12px}h2{font-size:11pt;text-transform:uppercase;border-bottom:1px solid #222;margin:14px 0 6px;padding-bottom:2px}h3{font-size:10.5pt;margin:8px 0 0}.meta{float:right;font-weight:normal}p{margin:4px 0}ul{margin:4px 0 8px;padding-left:18px}li{margin:2px 0}.skills{margin:0}.item{break-inside:avoid}@media print{body{-webkit-print-color-adjust:exact}}
  </style></head><body><header><h1>${escapeHtml(resume.personalInfo.name)}</h1><p>${contact}</p></header>
  ${resume.summary ? `<h2>Professional Summary</h2><p>${escapeHtml(resume.summary)}</p>` : ""}
  ${skillList.length ? `<h2>Skills</h2><p class="skills">${skillList.map(escapeHtml).join(" · ")}</p>` : ""}
  ${resume.experience.length ? `<h2>Experience</h2>${resume.experience.map((item) => `<div class="item"><h3>${escapeHtml(item.role)} — ${escapeHtml(item.company)}<span class="meta">${escapeHtml([item.startDate, item.endDate].filter(Boolean).join(" – "))}</span></h3>${list(item.description)}</div>`).join("")}` : ""}
  ${resume.projects.length ? `<h2>Projects</h2>${resume.projects.map((item) => `<div class="item"><h3>${escapeHtml(item.name)}</h3>${list(item.description)}${item.technologies.length ? `<p>${item.technologies.map(escapeHtml).join(" · ")}</p>` : ""}</div>`).join("")}` : ""}
  ${resume.education.length ? `<h2>Education</h2>${resume.education.map((item) => `<div class="item"><h3>${escapeHtml(item.degree)} — ${escapeHtml(item.institution)}<span class="meta">${escapeHtml([item.startDate, item.endDate].filter(Boolean).join(" – "))}</span></h3>${list(item.details)}</div>`).join("")}` : ""}
  ${resume.achievements.length ? `<h2>Achievements</h2>${list(resume.achievements)}` : ""}
  </body></html>`;
}

function ResumePreview({ resume }: { resume: ParsedResume }) {
  const skills = Object.values(resume.skills).flat().filter(Boolean);
  return (
    <article className="mx-auto min-h-[720px] w-full max-w-[760px] bg-white p-6 text-[12px] leading-relaxed text-slate-950 shadow-sm sm:p-10">
      <header className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">{resume.personalInfo.name || "Your name"}</h2>
        <p className="mt-1 text-[11px]">{[resume.personalInfo.email, resume.personalInfo.phone, resume.personalInfo.location].filter(Boolean).join(" · ")}</p>
      </header>
      {resume.summary && <PreviewSection title="Professional Summary"><p>{resume.summary}</p></PreviewSection>}
      {skills.length > 0 && <PreviewSection title="Skills"><p>{skills.join(" · ")}</p></PreviewSection>}
      {resume.experience.length > 0 && <PreviewSection title="Experience">{resume.experience.map((item, index) => <div key={`${item.company}-${index}`} className="mt-2 break-inside-avoid"><h3 className="font-bold">{item.role} — {item.company}<span className="float-right font-normal">{[item.startDate, item.endDate].filter(Boolean).join(" – ")}</span></h3><PreviewList items={item.description} /></div>)}</PreviewSection>}
      {resume.projects.length > 0 && <PreviewSection title="Projects">{resume.projects.map((item, index) => <div key={`${item.name}-${index}`} className="mt-2 break-inside-avoid"><h3 className="font-bold">{item.name}</h3><PreviewList items={item.description} /><p>{item.technologies.join(" · ")}</p></div>)}</PreviewSection>}
      {resume.education.length > 0 && <PreviewSection title="Education">{resume.education.map((item, index) => <div key={`${item.institution}-${index}`} className="mt-2 break-inside-avoid"><h3 className="font-bold">{item.degree} — {item.institution}<span className="float-right font-normal">{[item.startDate, item.endDate].filter(Boolean).join(" – ")}</span></h3><PreviewList items={item.details} /></div>)}</PreviewSection>}
      {resume.achievements.length > 0 && <PreviewSection title="Achievements"><PreviewList items={resume.achievements} /></PreviewSection>}
    </article>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-4"><h2 className="mb-1 border-b border-slate-800 pb-0.5 text-[12px] font-bold uppercase">{title}</h2>{children}</section>;
}

function PreviewList({ items }: { items: string[] }) {
  return <ul className="my-1 list-disc pl-5">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
}

export default function ResumeStudioPage() {
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [activeId, setActiveId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analyzedDescription, setAnalyzedDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeResume = resumes.find((resume) => resume.id === activeId) || resumes[0] || null;
  const analysis = useMemo(() => activeResume ? analyzeResume(activeResume.parsed_data, analyzedDescription) : null, [activeResume, analyzedDescription]);
  const visibleSuggestions = analysis?.suggestions.filter((suggestion) =>
    !activeResume?.parsed_data.studio?.acceptedSuggestionIds?.includes(suggestion.id) &&
    !activeResume?.parsed_data.studio?.rejectedSuggestionIds?.includes(suggestion.id)
  ) || [];

  const loadResumes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("You must be logged in.");
      const [resumeResult, savedJobResult] = await Promise.all([
        supabase.from("resumes").select(selectFields).eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("saved_jobs").select("jobs(id,title,company_name,description)").eq("user_id", user.id),
      ]);
      if (resumeResult.error) throw resumeResult.error;
      const records = (resumeResult.data || []) as ResumeRecord[];
      const jobs = (savedJobResult.data || []).flatMap((row) => {
        const related = row.jobs;
        return Array.isArray(related) ? related : related ? [related] : [];
      }) as SavedJob[];
      setResumes(records);
      setSavedJobs(jobs);
      const preferred = records.find((resume) => resume.is_primary) || records[0];
      setActiveId((current) => records.some((resume) => resume.id === current) ? current : preferred?.id || "");
      setJobDescription(preferred?.parsed_data.studio?.targetDescription || "");
      setAnalyzedDescription(preferred?.parsed_data.studio?.targetDescription || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load resume versions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadResumes(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadResumes]);

  const persistResume = async (resumeId: string, parsedData: StudioResume) => {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("You must be logged in.");
    const { data, error: updateError } = await supabase.from("resumes").update({ parsed_data: parsedData }).eq("id", resumeId).eq("user_id", user.id).select(selectFields).single();
    if (updateError) throw updateError;
    setResumes((current) => current.map((item) => item.id === resumeId ? data as ResumeRecord : item));
  };

  const analyzeForJob = async () => {
    if (!activeResume) return;
    try {
      setSaving(true);
      setError("");
      const description = jobDescription.trim().slice(0, 30_000);
      const parsedData: StudioResume = { ...activeResume.parsed_data, studio: { ...activeResume.parsed_data.studio, targetDescription: description } };
      await persistResume(activeResume.id, parsedData);
      setAnalyzedDescription(description);
      setMessage(description ? "Job-targeted ATS analysis updated." : "General ATS analysis updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the analysis.");
    } finally {
      setSaving(false);
    }
  };

  const duplicateVersion = async () => {
    if (!activeResume) return;
    try {
      setSaving(true);
      setError("");
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("You must be logged in.");
      const baseName = activeResume.file_name.replace(/\.[^.]+$/, "");
      const { studio: currentStudio, ...currentContent } = activeResume.parsed_data;
      const sourceSnapshot = currentStudio?.sourceSnapshot || currentContent;
      const { data, error: insertError } = await supabase.from("resumes").insert({
        user_id: user.id,
        file_name: `${baseName} — tailored`,
        file_path: activeResume.file_path,
        file_size: activeResume.file_size,
        mime_type: activeResume.mime_type,
        raw_text: activeResume.raw_text,
        parsed_data: {
          ...structuredClone(currentContent),
          studio: {
            targetDescription: currentStudio?.targetDescription || "",
            sourceResumeId: currentStudio?.sourceResumeId || activeResume.id,
            sourceSnapshot: structuredClone(sourceSnapshot),
          },
        },
        is_primary: false,
      }).select(selectFields).single();
      if (insertError) throw insertError;
      setResumes((current) => [data as ResumeRecord, ...current]);
      setActiveId(data.id);
      setMessage("Tailored copy created. Your primary resume remains unchanged.");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Could not create a resume version.");
    } finally {
      setSaving(false);
    }
  };

  const setPrimary = async () => {
    if (!activeResume || activeResume.is_primary) return;
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("You must be logged in.");
      const previousPrimary = resumes.find((resume) => resume.is_primary);
      const { error: clearError } = await supabase.from("resumes").update({ is_primary: false }).eq("user_id", user.id).eq("is_primary", true);
      if (clearError) throw clearError;
      const { error: primaryError } = await supabase.from("resumes").update({ is_primary: true }).eq("user_id", user.id).eq("id", activeResume.id);
      if (primaryError) {
        if (previousPrimary) await supabase.from("resumes").update({ is_primary: true }).eq("user_id", user.id).eq("id", previousPrimary.id);
        throw primaryError;
      }
      setResumes((current) => current.map((resume) => ({ ...resume, is_primary: resume.id === activeResume.id })));
      setMessage("Primary resume updated.");
    } catch (primaryError) {
      setError(primaryError instanceof Error ? primaryError.message : "Could not update the primary resume.");
    } finally {
      setSaving(false);
    }
  };

  const deleteVersion = async () => {
    if (!activeResume || activeResume.is_primary || !window.confirm("Delete this tailored resume version? The original file will remain safe.")) return;
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("You must be logged in.");
      const { error: deleteError } = await supabase.from("resumes").delete().eq("user_id", user.id).eq("id", activeResume.id).eq("is_primary", false);
      if (deleteError) throw deleteError;
      const remaining = resumes.filter((resume) => resume.id !== activeResume.id);
      setResumes(remaining);
      setActiveId((remaining.find((resume) => resume.is_primary) || remaining[0])?.id || "");
      setMessage("Tailored version deleted. Original file was not removed.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the version.");
    } finally {
      setSaving(false);
    }
  };

  const renameVersion = async () => {
    if (!activeResume) return;
    const nextName = window.prompt("Resume version name", activeResume.file_name)?.trim();
    if (!nextName || nextName === activeResume.file_name) return;
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("You must be logged in.");
      const { error: updateError } = await supabase.from("resumes").update({ file_name: nextName.slice(0, 180) }).eq("user_id", user.id).eq("id", activeResume.id);
      if (updateError) throw updateError;
      setResumes((current) => current.map((resume) => resume.id === activeResume.id ? { ...resume, file_name: nextName.slice(0, 180) } : resume));
      setMessage("Resume version renamed.");
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Could not rename the version.");
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = async () => {
    if (!activeResume || activeResume.is_primary || !activeResume.parsed_data.studio?.sourceSnapshot) return;
    if (!window.confirm("Restore this tailored copy to its original snapshot?")) return;
    try {
      setSaving(true);
      const sourceSnapshot = structuredClone(activeResume.parsed_data.studio.sourceSnapshot);
      await persistResume(activeResume.id, {
        ...sourceSnapshot,
        studio: {
          sourceResumeId: activeResume.parsed_data.studio.sourceResumeId,
          sourceSnapshot,
          targetDescription: activeResume.parsed_data.studio.targetDescription,
        },
      });
      setMessage("Tailored copy restored to its original snapshot.");
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Could not restore the version.");
    } finally {
      setSaving(false);
    }
  };

  const acceptSuggestions = async (suggestionId?: string) => {
    if (!activeResume || activeResume.is_primary || !analysis) return;
    const selected = visibleSuggestions.filter((suggestion) => !suggestion.requiresConfirmation && (!suggestionId || suggestion.id === suggestionId));
    if (!selected.length) return;
    try {
      setSaving(true);
      let updated: StudioResume = structuredClone(activeResume.parsed_data);
      selected.forEach((suggestion) => { updated = applyResumeSuggestion(updated, suggestion); });
      updated.studio = { ...updated.studio, acceptedSuggestionIds: [...new Set([...(updated.studio?.acceptedSuggestionIds || []), ...selected.map((item) => item.id)])] };
      await persistResume(activeResume.id, updated);
      setMessage(`${selected.length} grounded suggestion${selected.length === 1 ? "" : "s"} applied.`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Could not apply suggestions.");
    } finally {
      setSaving(false);
    }
  };

  const rejectSuggestion = async (suggestionId: string) => {
    if (!activeResume) return;
    try {
      setSaving(true);
      const studio = activeResume.parsed_data.studio || {};
      await persistResume(activeResume.id, {
        ...activeResume.parsed_data,
        studio: { ...studio, rejectedSuggestionIds: [...new Set([...(studio.rejectedSuggestionIds || []), suggestionId])] },
      });
      setMessage("Suggestion dismissed for this version.");
    } catch {
      setError("Could not dismiss the suggestion.");
    } finally {
      setSaving(false);
    }
  };

  const togglePreparation = async (taskId: string) => {
    if (!activeResume) return;
    const completed = new Set(activeResume.parsed_data.studio?.completedPreparationTasks || []);
    if (completed.has(taskId)) completed.delete(taskId); else completed.add(taskId);
    try {
      await persistResume(activeResume.id, { ...activeResume.parsed_data, studio: { ...activeResume.parsed_data.studio, completedPreparationTasks: [...completed] } });
    } catch {
      setError("Could not save preparation progress.");
    }
  };

  const exportResume = (print: boolean) => {
    if (!activeResume) return;
    const blobUrl = URL.createObjectURL(new Blob([resumeHtml(activeResume.parsed_data)], { type: "text/html" }));
    if (print) {
      const printWindow = window.open(blobUrl, "_blank");
      if (!printWindow) setError("Allow pop-ups to open the print-ready resume.");
      else {
        printWindow.opener = null;
        printWindow.addEventListener("load", () => printWindow.print(), { once: true });
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `${activeResume.file_name.replace(/\.[^.]+$/, "")}-ats.html`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  if (loading) return <main className="grid min-h-screen place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></main>;

  if (!activeResume || !analysis) return <main className="mx-auto max-w-3xl px-4 py-10"><Link href="/resume" className={buttonVariants({ variant: "outline" })}><ArrowLeft />Resume</Link><section className="surface mt-6 p-8 text-center"><FileText className="mx-auto size-10 text-primary" /><h1 className="mt-4 text-2xl font-bold">Upload a resume first</h1><p className="mt-2 text-sm text-muted-foreground">ATS Studio uses your structured JobPilot resume without changing the original file.</p><Link href="/resume" className={cn(buttonVariants(), "mt-5")}>Open Resume</Link></section></main>;

  const completedTasks = new Set(activeResume.parsed_data.studio?.completedPreparationTasks || []);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><Link href="/resume" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Resume editor</Link><p className="section-label mt-4"><Sparkles className="size-3.5" />ATS workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Resume Studio</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Analyze, tailor and prepare without inventing experience. The score is an explainable compatibility estimate, not an ATS guarantee.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportResume(false)}><Download />Download ATS HTML</Button><Button onClick={() => exportResume(true)}><Printer />Print / Save PDF</Button></div>
        </header>

        {(error || message) && <div role={error ? "alert" : "status"} className={cn("mt-5 flex items-start gap-2 rounded-xl border p-3 text-sm", error ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-700")}><CircleAlert className="mt-0.5 size-4 shrink-0" /><span>{error || message}</span></div>}

        <section className="surface mt-6 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label><span className="text-xs font-bold">Resume version</span><select value={activeResume.id} onChange={(event) => { const next = resumes.find((resume) => resume.id === event.target.value); setActiveId(event.target.value); setJobDescription(next?.parsed_data.studio?.targetDescription || ""); setAnalyzedDescription(next?.parsed_data.studio?.targetDescription || ""); }} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm">{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.file_name}{resume.is_primary ? " • Primary" : ""}</option>)}</select></label>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void duplicateVersion()} disabled={saving}><Copy />Create tailored copy</Button><Button variant="outline" onClick={() => void renameVersion()} disabled={saving}><FileText />Rename</Button><Button variant="outline" onClick={() => void restoreVersion()} disabled={saving || activeResume.is_primary || !activeResume.parsed_data.studio?.sourceSnapshot}><Save />Restore</Button><Button variant="outline" onClick={() => void setPrimary()} disabled={saving || activeResume.is_primary}><FileCheck2 />Set primary</Button><Button variant="destructive" onClick={() => void deleteVersion()} disabled={saving || activeResume.is_primary}><Trash2 />Delete copy</Button></div>
          </div>
          {activeResume.is_primary && <p className="mt-3 text-xs text-muted-foreground">Primary resume is protected. Create a tailored copy before applying changes.</p>}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
          <div className="space-y-5">
            <section className="surface p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">ATS compatibility</p><h2 className="mt-1 text-xl font-bold">{analysis.label}</h2></div><div className="text-right"><p className="text-4xl font-bold text-primary">{analysis.score}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">out of 100</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(analysis.categories).map(([label, score]) => <div key={label} className="rounded-xl bg-muted/50 p-3"><p className="text-lg font-bold">{score}</p><p className="text-[10px] capitalize text-muted-foreground">{label}</p></div>)}</div></section>

            <section className="surface p-5"><h2 className="font-bold">Target a job</h2><p className="mt-1 text-xs text-muted-foreground">Choose a saved job or paste a description. Missing terms remain review items and are never added as fake skills.</p>{savedJobs.length > 0 && <label className="mt-3 block"><span className="text-xs font-bold">Saved JobPilot job</span><select defaultValue="" onChange={(event) => { const job = savedJobs.find((item) => item.id === event.target.value); if (job?.description) setJobDescription(`${job.title} at ${job.company_name}\n\n${job.description}`); }} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="">Select a saved job…</option>{savedJobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company_name}</option>)}</select></label>}<textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={7} maxLength={30_000} placeholder="Paste the complete job description…" className="mt-3 w-full resize-y rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" /><Button className="mt-3 w-full" onClick={() => void analyzeForJob()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Target />}Analyze and save target</Button>{(analysis.matchedKeywords.length > 0 || analysis.missingKeywords.length > 0) && <div className="mt-4 grid gap-3 sm:grid-cols-2"><KeywordList title="Matched" values={analysis.matchedKeywords} tone="matched" /><KeywordList title="Review only" values={analysis.missingKeywords} tone="missing" /></div>}</section>

            <section className="surface p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">ATS findings</h2><p className="mt-1 text-xs text-muted-foreground">Clear reasons and corrections, ordered by severity.</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{analysis.issues.length}</span></div><div className="mt-4 space-y-3">{analysis.issues.length ? analysis.issues.map((issue) => <article key={issue.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{issue.title}</p><p className="mt-0.5 text-[10px] font-bold uppercase text-primary">{issue.section} · {issue.severity}</p></div></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{issue.reason}</p><p className="mt-2 text-xs"><strong>Fix:</strong> {issue.correction}</p></article>) : <p className="text-sm text-muted-foreground">No major deterministic issues detected.</p>}</div>{analysis.passed.length > 0 && <div className="mt-4 border-t pt-4"><p className="text-xs font-bold">Passed checks</p><ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">{analysis.passed.map((item) => <li key={item} className="flex gap-2"><Check className="size-3.5 text-emerald-600" />{item}</li>)}</ul></div>}</section>

            <section className="surface p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Grounded improvements</h2><p className="mt-1 text-xs text-muted-foreground">Only factual, low-risk rewrites can be applied automatically.</p></div><Button size="sm" onClick={() => void acceptSuggestions()} disabled={saving || activeResume.is_primary || !visibleSuggestions.length}><Sparkles />Accept safe</Button></div><div className="mt-4 space-y-3">{visibleSuggestions.length ? visibleSuggestions.map((suggestion) => <article key={suggestion.id} className="rounded-xl border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">{suggestion.section}</p><p className="mt-2 text-xs text-muted-foreground line-through">{suggestion.before || "No summary"}</p><p className="mt-2 text-sm font-medium">{suggestion.after}</p><div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={() => void acceptSuggestions(suggestion.id)} disabled={saving || activeResume.is_primary}><Check />Apply</Button><Button variant="ghost" size="sm" onClick={() => void rejectSuggestion(suggestion.id)} disabled={saving}>Dismiss</Button></div></article>) : <p className="text-sm text-muted-foreground">No safe automatic rewrite is needed. Use the editor for factual improvements.</p>}</div></section>

            <section className="surface p-5"><h2 className="font-bold">7-day preparation plan</h2><p className="mt-1 text-xs text-muted-foreground">Grounded in this resume and the pasted job description.</p><div className="mt-4 space-y-4">{analysis.preparationPlan.map((day) => <div key={day.day}><p className="text-sm font-bold">{day.day} · {day.title}</p><div className="mt-2 space-y-2">{day.tasks.map((task, index) => { const taskId = `${day.day}-${index}`; return <label key={taskId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs"><input type="checkbox" checked={completedTasks.has(taskId)} onChange={() => void togglePreparation(taskId)} className="mt-0.5 size-4" /><span className={completedTasks.has(taskId) ? "text-muted-foreground line-through" : ""}>{task}</span></label>; })}</div></div>)}</div></section>
          </div>

          <div className="xl:sticky xl:top-5 xl:self-start"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">ATS-safe preview</h2><p className="text-xs text-muted-foreground">Selectable text · A4 · single column</p></div><Link href="/resume" className={buttonVariants({ variant: "outline", size: "sm" })}><Save />Edit content</Link></div><div className="overflow-auto rounded-2xl border bg-slate-200 p-2 sm:p-5"><ResumePreview resume={activeResume.parsed_data} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Original upload stays unchanged. Complex PDF artwork, columns and exact font placement cannot be round-tripped reliably; this export intentionally uses a clean ATS-safe layout.</p></div>
        </div>
      </div>
    </main>
  );
}

function KeywordList({ title, values, tone }: { title: string; values: string[]; tone: "matched" | "missing" }) {
  return <div><p className="text-xs font-bold">{title}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", tone === "matched" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>{value}</span>)}</div></div>;
}

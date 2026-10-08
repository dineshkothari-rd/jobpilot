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
  Clock,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Trash2,
  X,
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
  updatedAt?: string;
  lastAnalyzedAt?: string;
  tailoringHistory?: {
    at: string;
    target: string;
    scoreBefore: number;
    scoreAfter: number;
  }[];
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
const skillGroups: Array<{ key: keyof ParsedResume["skills"]; label: string }> = [
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "database", label: "Database" },
  { key: "tools", label: "Tools" },
  { key: "other", label: "Other" },
];

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

function parseList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function formatWhen(value?: string) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dirtySnapshot(resume: StudioResume | null) {
  if (!resume) return "";
  const { studio, ...content } = resume;
  return JSON.stringify({
    ...content,
    studio: studio ? {
      targetDescription: studio.targetDescription || "",
      acceptedSuggestionIds: studio.acceptedSuggestionIds || [],
      rejectedSuggestionIds: studio.rejectedSuggestionIds || [],
      completedPreparationTasks: studio.completedPreparationTasks || [],
    } : undefined,
  });
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
  const [draft, setDraft] = useState<StudioResume | null>(null);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeResume = resumes.find((resume) => resume.id === activeId) || resumes[0] || null;
  const analysisResume = draft || activeResume?.parsed_data || null;
  const analysis = useMemo(() => analysisResume ? analyzeResume(analysisResume, analyzedDescription) : null, [analysisResume, analyzedDescription]);
  const dirty = useMemo(() => dirtySnapshot(draft) !== dirtySnapshot(activeResume?.parsed_data || null), [activeResume?.parsed_data, draft]);
  const visibleSuggestions = analysis?.suggestions.filter((suggestion) =>
    !analysisResume?.studio?.acceptedSuggestionIds?.includes(suggestion.id) &&
    !analysisResume?.studio?.rejectedSuggestionIds?.includes(suggestion.id)
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
      const requestedId = new URLSearchParams(window.location.search).get("resumeId");
      const preferred = records.find((resume) => resume.id === requestedId) || records.find((resume) => resume.is_primary) || records[0];
      setActiveId(preferred?.id || "");
      setDraft(preferred ? structuredClone(preferred.parsed_data) : null);
      setLastSavedAt(preferred?.parsed_data.studio?.updatedAt || preferred?.created_at || "");
      setSaveStatus("saved");
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

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const persistResume = useCallback(async (resumeId: string, parsedData: StudioResume) => {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("You must be logged in.");
    const nextData: StudioResume = {
      ...parsedData,
      studio: { ...parsedData.studio, updatedAt: new Date().toISOString() },
    };
    const { data, error: updateError } = await supabase.from("resumes").update({ parsed_data: nextData }).eq("id", resumeId).eq("user_id", user.id).select(selectFields).single();
    if (updateError) throw updateError;
    const saved = data as ResumeRecord;
    setResumes((current) => current.map((item) => item.id === resumeId ? saved : item));
    setLastSavedAt(saved.parsed_data.studio?.updatedAt || "");
    return saved;
  }, []);

  const saveDraft = useCallback(async (showMessage = false) => {
    if (!activeResume || !draft || !dirty) return;
    try {
      setSaveStatus("saving");
      setError("");
      const saved = await persistResume(activeResume.id, draft);
      setDraft(structuredClone(saved.parsed_data));
      setSaveStatus("saved");
      if (showMessage) setMessage("Resume version saved.");
    } catch (saveError) {
      setSaveStatus("failed");
      setError(saveError instanceof Error ? saveError.message : "Could not save this resume version.");
    }
  }, [activeResume, dirty, draft, persistResume]);

  useEffect(() => {
    if (!dirty || !activeResume || !draft) return;
    const timer = window.setTimeout(() => { void saveDraft(false); }, 900);
    return () => window.clearTimeout(timer);
  }, [activeResume, dirty, draft, saveDraft]);

  const selectResumeVersion = (resumeId: string) => {
    if (dirty && !window.confirm("You have unsaved edits. Switch resume versions anyway?")) return;
    const next = resumes.find((resume) => resume.id === resumeId);
    setActiveId(resumeId);
    setDraft(next ? structuredClone(next.parsed_data) : null);
    setLastSavedAt(next?.parsed_data.studio?.updatedAt || next?.created_at || "");
    setSaveStatus("saved");
    setMessage("");
    setError("");
    setJobDescription(next?.parsed_data.studio?.targetDescription || "");
    setAnalyzedDescription(next?.parsed_data.studio?.targetDescription || "");
  };

  const analyzeForJob = async () => {
    if (!activeResume) return;
    try {
      setSaving(true);
      setSaveStatus("saving");
      setError("");
      const description = jobDescription.trim().slice(0, 30_000);
      const source = draft || activeResume.parsed_data;
      const scoreBefore = analyzeResume(source, activeResume.parsed_data.studio?.targetDescription || "").score;
      const scoreAfter = analyzeResume(source, description).score;
      const parsedData: StudioResume = {
        ...source,
        studio: {
          ...source.studio,
          targetDescription: description,
          lastAnalyzedAt: new Date().toISOString(),
          tailoringHistory: [
            ...(source.studio?.tailoringHistory || []).slice(-9),
            { at: new Date().toISOString(), target: description.slice(0, 160), scoreBefore, scoreAfter },
          ],
        },
      };
      const saved = await persistResume(activeResume.id, parsedData);
      setDraft(structuredClone(saved.parsed_data));
      setAnalyzedDescription(description);
      setSaveStatus("saved");
      setMessage(description ? "Job-targeted ATS analysis updated." : "General ATS analysis updated.");
    } catch (saveError) {
      setSaveStatus("failed");
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
      const sourceResume = draft || activeResume.parsed_data;
      const { studio: currentStudio, ...currentContent } = sourceResume;
      const sourceSnapshot = currentStudio?.sourceSnapshot || currentContent;
      const now = new Date().toISOString();
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
            updatedAt: now,
            lastAnalyzedAt: currentStudio?.lastAnalyzedAt,
            tailoringHistory: currentStudio?.tailoringHistory || [],
          },
        },
        is_primary: false,
      }).select(selectFields).single();
      if (insertError) throw insertError;
      const created = data as ResumeRecord;
      setResumes((current) => [created, ...current]);
      setActiveId(data.id);
      setDraft(structuredClone(created.parsed_data));
      setLastSavedAt(created.parsed_data.studio?.updatedAt || created.created_at);
      setSaveStatus("saved");
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
      const next = (remaining.find((resume) => resume.is_primary) || remaining[0]) || null;
      setResumes(remaining);
      setActiveId(next?.id || "");
      setDraft(next ? structuredClone(next.parsed_data) : null);
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
      setSaveStatus("saving");
      const sourceSnapshot = structuredClone(activeResume.parsed_data.studio.sourceSnapshot);
      const saved = await persistResume(activeResume.id, {
        ...sourceSnapshot,
        studio: {
          sourceResumeId: activeResume.parsed_data.studio.sourceResumeId,
          sourceSnapshot,
          targetDescription: activeResume.parsed_data.studio.targetDescription,
          lastAnalyzedAt: activeResume.parsed_data.studio.lastAnalyzedAt,
          tailoringHistory: activeResume.parsed_data.studio.tailoringHistory,
        },
      });
      setDraft(structuredClone(saved.parsed_data));
      setSaveStatus("saved");
      setMessage("Tailored copy restored to its original snapshot.");
    } catch (restoreError) {
      setSaveStatus("failed");
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
      setSaveStatus("saving");
      const scoreBefore = analysis.score;
      let updated: StudioResume = structuredClone(draft || activeResume.parsed_data);
      selected.forEach((suggestion) => { updated = applyResumeSuggestion(updated, suggestion); });
      const scoreAfter = analyzeResume(updated, analyzedDescription).score;
      updated.studio = {
        ...updated.studio,
        acceptedSuggestionIds: [...new Set([...(updated.studio?.acceptedSuggestionIds || []), ...selected.map((item) => item.id)])],
        tailoringHistory: [
          ...(updated.studio?.tailoringHistory || []).slice(-9),
          { at: new Date().toISOString(), target: analyzedDescription.slice(0, 160), scoreBefore, scoreAfter },
        ],
      };
      const saved = await persistResume(activeResume.id, updated);
      setDraft(structuredClone(saved.parsed_data));
      setSaveStatus("saved");
      setMessage(`${selected.length} grounded suggestion${selected.length === 1 ? "" : "s"} applied.`);
    } catch (applyError) {
      setSaveStatus("failed");
      setError(applyError instanceof Error ? applyError.message : "Could not apply suggestions.");
    } finally {
      setSaving(false);
    }
  };

  const rejectSuggestion = async (suggestionId: string) => {
    if (!activeResume) return;
    try {
      setSaving(true);
      setSaveStatus("saving");
      const source = draft || activeResume.parsed_data;
      const studio = source.studio || {};
      const saved = await persistResume(activeResume.id, {
        ...source,
        studio: { ...studio, rejectedSuggestionIds: [...new Set([...(studio.rejectedSuggestionIds || []), suggestionId])] },
      });
      setDraft(structuredClone(saved.parsed_data));
      setSaveStatus("saved");
      setMessage("Suggestion dismissed for this version.");
    } catch {
      setSaveStatus("failed");
      setError("Could not dismiss the suggestion.");
    } finally {
      setSaving(false);
    }
  };

  const togglePreparation = async (taskId: string) => {
    if (!activeResume) return;
    const source = draft || activeResume.parsed_data;
    const completed = new Set(source.studio?.completedPreparationTasks || []);
    if (completed.has(taskId)) completed.delete(taskId); else completed.add(taskId);
    try {
      const saved = await persistResume(activeResume.id, { ...source, studio: { ...source.studio, completedPreparationTasks: [...completed] } });
      setDraft(structuredClone(saved.parsed_data));
    } catch {
      setError("Could not save preparation progress.");
    }
  };

  const updateDraft = (updater: (current: StudioResume) => StudioResume) => {
    setDraft((current) => current ? updater(structuredClone(current)) : current);
  };

  const updateSkillGroup = (key: keyof ParsedResume["skills"], value: string) => {
    updateDraft((current) => ({
      ...current,
      skills: { ...current.skills, [key]: parseList(value) },
    }));
  };

  const updateExperience = (index: number, patch: Partial<StudioResume["experience"][number]>) => {
    updateDraft((current) => ({
      ...current,
      experience: current.experience.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  };

  const updateBullet = (itemIndex: number, bulletIndex: number, value: string) => {
    updateDraft((current) => ({
      ...current,
      experience: current.experience.map((item, index) => index === itemIndex
        ? { ...item, description: item.description.map((bullet, currentBullet) => currentBullet === bulletIndex ? value : bullet) }
        : item),
    }));
  };

  const moveBullet = (itemIndex: number, bulletIndex: number, direction: -1 | 1) => {
    updateDraft((current) => ({
      ...current,
      experience: current.experience.map((item, index) => {
        if (index !== itemIndex) return item;
        const next = [...item.description];
        const target = bulletIndex + direction;
        if (target < 0 || target >= next.length) return item;
        [next[bulletIndex], next[target]] = [next[target], next[bulletIndex]];
        return { ...item, description: next };
      }),
    }));
  };

  const removeBullet = (itemIndex: number, bulletIndex: number) => {
    updateDraft((current) => ({
      ...current,
      experience: current.experience.map((item, index) => index === itemIndex
        ? { ...item, description: item.description.filter((_, currentBullet) => currentBullet !== bulletIndex) }
        : item),
    }));
  };

  const addBullet = (itemIndex: number) => {
    updateDraft((current) => ({
      ...current,
      experience: current.experience.map((item, index) => index === itemIndex
        ? { ...item, description: [...item.description, ""] }
        : item),
    }));
  };

  const addExperience = () => {
    updateDraft((current) => ({
      ...current,
      experience: [
        ...current.experience,
        { company: "", role: "", location: "", startDate: "", endDate: "", description: [""] },
      ],
    }));
  };

  const exportResume = (print: boolean) => {
    if (!activeResume) return;
    const exportData = draft || activeResume.parsed_data;
    const blobUrl = URL.createObjectURL(new Blob([resumeHtml(exportData)], { type: "text/html" }));
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

  if (!activeResume || !analysis) return <main className="mx-auto max-w-3xl px-4 py-10"><Link href="/resume" className={buttonVariants({ variant: "outline" })}><ArrowLeft />Resume</Link><section className="surface mt-6 p-8 text-center"><FileText className="mx-auto size-10 text-primary" /><h1 className="mt-4 text-2xl font-bold">Upload a resume first</h1><p className="mt-2 text-sm text-muted-foreground">ATS Studio uses your structured Parth Careers resume without changing the original file.</p><Link href="/resume" className={cn(buttonVariants(), "mt-5")}>Open Resume</Link></section></main>;

  const currentResume = draft || activeResume.parsed_data;
  const completedTasks = new Set(currentResume.studio?.completedPreparationTasks || []);
  const history = currentResume.studio?.tailoringHistory || [];
  const resumeSkills = Object.values(currentResume.skills).flat().filter(Boolean);
  const prepQuestions = [
    `Walk me through your experience relevant to ${currentResume.experience[0]?.role || "this role"}.`,
    ...analysis.matchedKeywords.slice(0, 3).map((keyword) => `Where have you used ${keyword} in your listed work or projects?`),
    ...analysis.missingKeywords.slice(0, 3).map((keyword) => `If asked about ${keyword}, how will you honestly frame your current exposure or learning plan?`),
    "Which project best demonstrates your problem-solving approach?",
    "What questions will you ask the interviewer about success expectations?",
  ].slice(0, 8);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><Link href="/resume" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Resume editor</Link><p className="section-label mt-4"><Sparkles className="size-3.5" />ATS workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Resume Studio</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Analyze, tailor and prepare without inventing experience. The score is an explainable compatibility estimate, not an ATS guarantee.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold", saveStatus === "failed" ? "border-destructive/30 text-destructive" : "text-muted-foreground")}>
              {saveStatus === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
              {saveStatus === "saving" ? "Saving" : saveStatus === "failed" ? "Save failed" : `Saved · ${formatWhen(lastSavedAt)}`}
            </span>
            {saveStatus === "failed" && <Button variant="outline" onClick={() => void saveDraft(true)}><RefreshCw />Retry</Button>}
            <Button variant="outline" onClick={() => void saveDraft(true)} disabled={!dirty || saveStatus === "saving"}><Save />Save now</Button>
            <details><summary className="cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold">Other export formats</summary><div className="mt-2"><Button variant="outline" onClick={() => exportResume(false)}><Download />Download HTML</Button></div></details>
            <Button onClick={() => exportResume(true)}><Printer />Save as PDF</Button>
          </div>
        </header>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Check the preview, save changes, then choose Save as PDF. In the browser print dialog, select Save as PDF as the destination. The score is guidance, not an ATS guarantee.</p>

        {(error || message) && <div role={error ? "alert" : "status"} className={cn("mt-5 flex items-start justify-between gap-2 rounded-xl border p-3 text-sm", error ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-700")}><div className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" /><span>{error || message}</span></div>{error && <Button variant="outline" size="sm" onClick={() => void saveDraft(true)}><RefreshCw />Retry</Button>}</div>}

        <section className="surface mt-6 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label><span className="text-xs font-bold">Resume version</span><select value={activeResume.id} onChange={(event) => selectResumeVersion(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm">{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.file_name}{resume.is_primary ? " • Primary" : ""}</option>)}</select></label>
            <details><summary className="cursor-pointer text-sm font-semibold">Manage resume versions</summary><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void duplicateVersion()} disabled={saving}><Copy />Create tailored copy</Button><Button variant="outline" onClick={() => void renameVersion()} disabled={saving}><FileText />Rename</Button><Button variant="outline" onClick={() => void restoreVersion()} disabled={saving || activeResume.is_primary || !activeResume.parsed_data.studio?.sourceSnapshot}><Save />Restore</Button><Button variant="outline" onClick={() => void setPrimary()} disabled={saving || activeResume.is_primary}><FileCheck2 />Set primary</Button><Button variant="destructive" onClick={() => void deleteVersion()} disabled={saving || activeResume.is_primary}><Trash2 />Delete copy</Button></div></details>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <p>Created: <span className="font-semibold text-foreground">{formatWhen(activeResume.created_at)}</span></p>
            <p>Modified: <span className="font-semibold text-foreground">{formatWhen(currentResume.studio?.updatedAt || activeResume.created_at)}</span></p>
            <p>Last analyzed: <span className="font-semibold text-foreground">{formatWhen(currentResume.studio?.lastAnalyzedAt)}</span></p>
          </div>
          {activeResume.is_primary && <p className="mt-3 text-xs text-muted-foreground">Primary resume is protected. Create a tailored copy before applying changes.</p>}
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
          <div className="space-y-5">
            <section className={cn("surface p-5", editorMode === "preview" && "hidden xl:block")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-bold">Section editor</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Edit grounded resume content. Autosave runs after changes; original uploaded file is not changed.</p>
                </div>
                <div className="flex gap-2 xl:hidden">
                  <Button variant={editorMode === "edit" ? "default" : "outline"} size="sm" onClick={() => setEditorMode("edit")}><Pencil />Edit</Button>
                  <Button variant={editorMode === "preview" ? "default" : "outline"} size="sm" onClick={() => setEditorMode("preview")}><Eye />Preview</Button>
                </div>
              </div>
              <nav aria-label="Resume sections" className="mt-4 flex gap-2 overflow-x-auto pb-1 text-xs font-bold">
                {["summary", "skills", "experience"].map((section) => <a key={section} href={`#studio-${section}`} className="rounded-full border px-3 py-2 capitalize hover:bg-muted">{section}</a>)}
                <Link href="/resume" className="rounded-full border px-3 py-2 hover:bg-muted">Full editor</Link>
              </nav>

              <div id="studio-summary" className="mt-5">
                <label className="text-xs font-bold">Professional summary</label>
                <textarea
                  value={currentResume.summary}
                  onChange={(event) => updateDraft((current) => ({ ...current, summary: event.target.value }))}
                  rows={5}
                  maxLength={1200}
                  className="mt-1.5 w-full resize-y rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="Add a factual 2–3 line summary."
                />
              </div>

              <div id="studio-skills" className="mt-5 grid gap-3 sm:grid-cols-2">
                {skillGroups.map((group) => (
                  <label key={group.key} className="text-xs font-bold">
                    {group.label} skills
                    <input
                      value={currentResume.skills[group.key].join(", ")}
                      onChange={(event) => updateSkillGroup(group.key, event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-ring/30"
                      placeholder="Comma separated"
                    />
                  </label>
                ))}
              </div>

              <div id="studio-experience" className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">Experience</h3>
                  <Button variant="outline" size="sm" onClick={addExperience}><Plus />Add role</Button>
                </div>
                {currentResume.experience.map((item, itemIndex) => (
                  <article key={`${item.company}-${itemIndex}`} className="rounded-2xl border p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-bold">Role<input value={item.role} onChange={(event) => updateExperience(itemIndex, { role: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
                      <label className="text-xs font-bold">Company<input value={item.company} onChange={(event) => updateExperience(itemIndex, { company: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
                      <label className="text-xs font-bold">Start<input value={item.startDate} onChange={(event) => updateExperience(itemIndex, { startDate: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
                      <label className="text-xs font-bold">End<input value={item.endDate} onChange={(event) => updateExperience(itemIndex, { endDate: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal" /></label>
                    </div>
                    <div className="mt-3 space-y-2">
                      {item.description.map((bullet, bulletIndex) => (
                        <div key={`${itemIndex}-${bulletIndex}`} className="rounded-xl border bg-muted/20 p-2">
                          <textarea
                            aria-label={`Experience bullet ${bulletIndex + 1}`}
                            value={bullet}
                            onChange={(event) => updateBullet(itemIndex, bulletIndex, event.target.value)}
                            rows={2}
                            className="w-full resize-y rounded-lg border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => moveBullet(itemIndex, bulletIndex, -1)} disabled={bulletIndex === 0}>Up</Button>
                            <Button variant="outline" size="sm" onClick={() => moveBullet(itemIndex, bulletIndex, 1)} disabled={bulletIndex === item.description.length - 1}>Down</Button>
                            <Button variant="ghost" size="sm" onClick={() => removeBullet(itemIndex, bulletIndex)}><X />Remove</Button>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addBullet(itemIndex)}><Plus />Add bullet</Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="surface p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">ATS compatibility</p><h2 className="mt-1 text-xl font-bold">{analysis.label}</h2></div><div className="text-right"><p className="text-4xl font-bold text-primary">{analysis.score}</p><p className="text-[10px] font-bold uppercase text-muted-foreground">out of 100</p></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(analysis.categories).map(([label, score]) => <div key={label} className="rounded-xl bg-muted/50 p-3"><p className="text-lg font-bold">{score}</p><p className="text-[10px] capitalize text-muted-foreground">{label}</p></div>)}</div></section>

            <section className="surface p-5"><h2 className="font-bold">Target a job</h2><p className="mt-1 text-xs text-muted-foreground">Choose a saved job or paste a description. Missing terms remain review items and are never added as fake skills.</p>{savedJobs.length > 0 && <label className="mt-3 block"><span className="text-xs font-bold">Saved Parth Careers job</span><select defaultValue="" onChange={(event) => { const job = savedJobs.find((item) => item.id === event.target.value); if (job?.description) setJobDescription(`${job.title} at ${job.company_name}\n\n${job.description}`); }} className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm"><option value="">Select a saved job…</option>{savedJobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company_name}</option>)}</select></label>}<textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={7} maxLength={30_000} placeholder="Paste the complete job description…" className="mt-3 w-full resize-y rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" /><Button className="mt-3 w-full" onClick={() => void analyzeForJob()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Target />}Analyze and save target</Button>{(analysis.matchedKeywords.length > 0 || analysis.missingKeywords.length > 0) && <div className="mt-4 grid gap-3 sm:grid-cols-2"><KeywordList title="Matched" values={analysis.matchedKeywords} tone="matched" /><KeywordList title="Review only" values={analysis.missingKeywords} tone="missing" /></div>}</section>

            <section className="surface p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">ATS findings</h2><p className="mt-1 text-xs text-muted-foreground">Clear reasons and corrections, ordered by severity.</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{analysis.issues.length}</span></div><div className="mt-4 space-y-3">{analysis.issues.length ? analysis.issues.map((issue) => <article key={issue.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{issue.title}</p><p className="mt-0.5 text-[10px] font-bold uppercase text-primary">{issue.affectedSections.join(", ")} · {issue.severity}</p></div></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{issue.reason}</p><p className="mt-2 text-xs"><strong>Fix:</strong> {issue.recommendedCorrection}</p><p className="mt-2 text-[10px] font-semibold text-muted-foreground">{issue.canAutoApply ? "Can auto-apply" : "Review manually"} · {issue.requiresUserConfirmation ? "User confirmation required" : "Safe automatic correction"}</p></article>) : <p className="text-sm text-muted-foreground">No major deterministic issues detected.</p>}</div>{analysis.passed.length > 0 && <div className="mt-4 border-t pt-4"><p className="text-xs font-bold">Passed checks</p><ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">{analysis.passed.map((item) => <li key={item} className="flex gap-2"><Check className="size-3.5 text-emerald-600" />{item}</li>)}</ul></div>}</section>

            <section className="surface p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Grounded improvements</h2><p className="mt-1 text-xs text-muted-foreground">Only factual, low-risk rewrites can be applied automatically.</p></div><Button size="sm" onClick={() => void acceptSuggestions()} disabled={saving || activeResume.is_primary || !visibleSuggestions.some((suggestion) => !suggestion.requiresConfirmation)}><Sparkles />Accept safe</Button></div><div className="mt-4 space-y-3">{visibleSuggestions.length ? visibleSuggestions.map((suggestion) => <article key={suggestion.id} className="rounded-xl border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">{suggestion.section} · {suggestion.requiresConfirmation ? "confirmation needed" : "safe"}</p><p className="mt-2 text-xs text-muted-foreground line-through">{suggestion.before || "No summary"}</p><p className="mt-2 text-sm font-medium">{suggestion.after}</p><div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={() => void acceptSuggestions(suggestion.id)} disabled={saving || activeResume.is_primary || suggestion.requiresConfirmation}><Check />Apply</Button><Button variant="ghost" size="sm" onClick={() => void rejectSuggestion(suggestion.id)} disabled={saving}>Dismiss</Button></div></article>) : <p className="text-sm text-muted-foreground">No safe automatic rewrite is needed. Use the editor for factual improvements.</p>}</div></section>

            <section className="surface p-5"><h2 className="font-bold">Preparation Hub</h2><p className="mt-1 text-xs text-muted-foreground">Grounded in this resume and the pasted job description.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-3"><p className="text-xs font-bold">Resume-supported strengths</p><p className="mt-2 text-xs text-muted-foreground">{analysis.matchedKeywords.length ? analysis.matchedKeywords.slice(0, 6).join(", ") : resumeSkills.slice(0, 6).join(", ") || "Add skills or a job description to derive strengths."}</p></div><div className="rounded-xl border p-3"><p className="text-xs font-bold">Review gaps</p><p className="mt-2 text-xs text-muted-foreground">{analysis.missingKeywords.length ? analysis.missingKeywords.slice(0, 6).join(", ") : "No job-specific gaps detected yet."}</p></div></div><div className="mt-4 rounded-xl border p-3"><p className="text-xs font-bold">Screening questions</p><ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">{prepQuestions.map((question) => <li key={question} className="flex gap-2"><Check className="mt-0.5 size-3.5 text-primary" />{question}</li>)}</ul></div><div className="mt-5 space-y-4">{analysis.preparationPlan.map((day) => <div key={day.day}><p className="text-sm font-bold">{day.day} · {day.title}</p><div className="mt-2 space-y-2">{day.tasks.map((task, index) => { const taskId = `${day.day}-${index}`; return <label key={taskId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs"><input type="checkbox" checked={completedTasks.has(taskId)} onChange={() => void togglePreparation(taskId)} className="mt-0.5 size-4" /><span className={completedTasks.has(taskId) ? "text-muted-foreground line-through" : ""}>{task}</span></label>; })}</div></div>)}</div></section>
          </div>

          <div className={cn("xl:sticky xl:top-5 xl:self-start", editorMode === "edit" && "hidden xl:block")}><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">ATS-safe preview</h2><p className="text-xs text-muted-foreground">Selectable text · A4 · single column</p></div><Link href="/resume" className={buttonVariants({ variant: "outline", size: "sm" })}><Save />Full editor</Link></div><div className="overflow-auto rounded-2xl border bg-slate-200 p-2 sm:p-5"><ResumePreview resume={currentResume} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Original upload stays unchanged. Complex PDF artwork, columns and exact font placement cannot be round-tripped reliably; this export intentionally uses a clean ATS-safe layout.</p>{history.length > 0 && <div className="mt-3 rounded-2xl border bg-background p-3"><p className="text-xs font-bold">Tailoring history</p><ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">{history.slice(-3).reverse().map((entry) => <li key={`${entry.at}-${entry.scoreAfter}`}>{formatWhen(entry.at)} · {entry.scoreBefore} → {entry.scoreAfter}</li>)}</ul></div>}</div>
        </div>
      </div>
    </main>
  );
}

function KeywordList({ title, values, tone }: { title: string; values: string[]; tone: "matched" | "missing" }) {
  return <div><p className="text-xs font-bold">{title}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", tone === "matched" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>{value}</span>)}</div></div>;
}

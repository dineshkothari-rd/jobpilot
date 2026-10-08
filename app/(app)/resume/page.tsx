"use client";

import { CareerScene } from "@/components/career-scene";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Award,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  ExternalLink,
  FileText,
  GraduationCap,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ParsedResume = {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    github: string;
    linkedin: string;
    portfolio: string;
  };
  summary: string;
  skills: {
    frontend: string[];
    backend: string[];
    database: string[];
    tools: string[];
    other: string[];
  };
  experience: {
    company: string;
    role: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    location: string;
    startDate: string;
    endDate: string;
    details: string[];
  }[];
  projects: {
    name: string;
    description: string[];
    technologies: string[];
  }[];
  achievements: string[];
};

type ResumeRecord = {
  id: string;
  file_name: string;
  file_size: number;
  created_at: string;
  parsed_data: ParsedResume;
  is_primary: boolean;
};

const skillGroups: {
  key: keyof ParsedResume["skills"];
  label: string;
}[] = [
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "database", label: "Database" },
  { key: "tools", label: "Tools & Platforms" },
  { key: "other", label: "Other" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeResumeData(
  data: ParsedResume,
): ParsedResume {
  const unique = (items: string[]) =>
    Array.from(
      new Set(
        items
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

  return {
    ...data,
    personalInfo: {
      ...data.personalInfo,
      name: data.personalInfo.name?.trim() || "",
      email: data.personalInfo.email?.trim() || "",
      phone: data.personalInfo.phone?.trim() || "",
      location: data.personalInfo.location?.trim() || "",
      github: data.personalInfo.github?.trim() || "",
      linkedin: data.personalInfo.linkedin?.trim() || "",
      portfolio: data.personalInfo.portfolio?.trim() || "",
    },
    summary: data.summary?.trim() || "",
    skills: {
      frontend: unique(data.skills?.frontend || []),
      backend: unique(data.skills?.backend || []),
      database: unique(data.skills?.database || []),
      tools: unique(data.skills?.tools || []),
      other: unique(data.skills?.other || []),
    },
    experience: (data.experience || []).map((item) => ({
      ...item,
      company: item.company?.trim() || "",
      role: item.role?.trim() || "",
      location: item.location?.trim() || "",
      startDate: item.startDate?.trim() || "",
      endDate: item.endDate?.trim() || "",
      description: unique(item.description || []),
    })),
    education: (data.education || []).map((item) => ({
      ...item,
      degree: item.degree?.trim() || "",
      institution: item.institution?.trim() || "",
      location: item.location?.trim() || "",
      startDate: item.startDate?.trim() || "",
      endDate: item.endDate?.trim() || "",
      details: unique(item.details || []),
    })),
    projects: (data.projects || []).map((item) => ({
      ...item,
      name: item.name?.trim() || "",
      description: unique(item.description || []),
      technologies: unique(item.technologies || []),
    })),
    achievements: unique(data.achievements || []),
  };
}

function validateResumeData(
  data: ParsedResume,
): string | null {
  const invalidExperience = data.experience.find(
    (item) =>
      !item.company.trim() ||
      !item.role.trim(),
  );

  if (invalidExperience) {
    return "Every experience entry needs a company and role.";
  }

  const invalidEducation = data.education.find(
    (item) =>
      !item.degree.trim() ||
      !item.institution.trim(),
  );

  if (invalidEducation) {
    return "Every education entry needs a degree and institution.";
  }

  const invalidProject = data.projects.find(
    (item) => !item.name.trim(),
  );

  if (invalidProject) {
    return "Every project needs a project name.";
  }

  return null;
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  onEdit,
  editing,
  onCancel,
  onSave,
  saving,
  className,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editing?: boolean;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  className?: string;
}) {
  return (
    <section
      id={`resume-${title.toLowerCase().replaceAll(" ", "-")}`}
      className={cn(
        "surface overflow-hidden rounded-2xl",
        className,
      )}
    >
      <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>

          <div className="min-w-0">
            <h2 className="font-bold tracking-tight">
              {title}
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {onEdit && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}

        {editing && (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function BulletList({
  items,
  emptyText = "Nothing added yet.",
}: {
  items: string[];
  emptyText?: string;
}) {
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex gap-2.5 text-sm leading-6 text-muted-foreground"
        >
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SkillGroup({
  title,
  skills,
  editing,
  onChange,
}: {
  title: string;
  skills: string[];
  editing?: boolean;
  onChange?: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState(
    skills.join(", "),
  );

  if (!skills.length && !editing) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>

      {editing ? (
        <input
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);

            onChange?.(
              value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            );
          }}
          placeholder="React, TypeScript, Next.js..."
          className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
        />
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResumePage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [resume, setResume] =
    useState<ResumeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [activeSection, setActiveSection] =
    useState<string | null>(null);

  const [draft, setDraft] =
    useState<ParsedResume | null>(null);

  const [expandedExperience, setExpandedExperience] =
    useState<number | null>(0);

  const [expandedProject, setExpandedProject] =
    useState<number | null>(0);

  const loadResume = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("You must be logged in.");
      }

      const { data, error: resumeError } =
        await supabase
          .from("resumes")
          .select(
            "id, file_name, file_size, created_at, parsed_data, is_primary",
          )
          .eq("user_id", user.id)
          .eq("is_primary", true)
          .maybeSingle();

      if (resumeError) {
        throw new Error(
          `Failed to load resume: ${resumeError.message}`,
        );
      }

      setResume(
        data
          ? ({
              ...data,
              parsed_data: normalizeResumeData(
                data.parsed_data as ParsedResume,
              ),
            } as ResumeRecord)
          : null,
      );
    } catch (loadError) {
      console.error(
        "RESUME LOAD ERROR:",
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load resume.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadResume();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadResume]);

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");
    setError("");

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Resume must be smaller than 5 MB.",
      );
      event.target.value = "";
      return;
    }

    let uploadedFilePath = "";
    let insertedResumeId = "";
    let uploadUserId = "";

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const parseResponse = await fetch(
        "/api/resume/parse",
        {
          method: "POST",
          body: formData,
        },
      );

      const parseResult =
        await parseResponse.json();

      if (!parseResponse.ok) {
        throw new Error(
          parseResult.error ||
            "Failed to parse resume.",
        );
      }

      const parsedData = normalizeResumeData(parseResult.parsedData as ParsedResume);
      const validationError = validateResumeData(parsedData);
      if (validationError) throw new Error(validationError);

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("You must be logged in.");
      }
      uploadUserId = user.id;

      const fileName = `${crypto.randomUUID()}.pdf`;
      const filePath = `${user.id}/${fileName}`;

      uploadedFilePath = filePath;

      const { error: uploadError } =
        await supabase.storage
          .from("resumes")
          .upload(filePath, file, {
            contentType: "application/pdf",
            upsert: false,
          });

      if (uploadError) {
        throw new Error(
          `Storage upload failed: ${uploadError.message}`,
        );
      }

      const {
        data: insertedResume,
        error: databaseError,
      } = await supabase
        .from("resumes")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          raw_text: parseResult.text,
          parsed_data: parsedData,
          is_primary: false,
        })
        .select(
          "id, file_name, file_size, created_at, parsed_data, is_primary",
        )
        .single();

      if (databaseError) {
        throw new Error(
          `Database insert failed: ${databaseError.message}`,
        );
      }

      insertedResumeId = insertedResume.id;

      const { error: primaryError } = await supabase
        .from("resumes")
        .update({ is_primary: false })
        .eq("user_id", user.id)
        .eq("is_primary", true);

      if (primaryError) throw new Error("Failed to replace the primary resume.");

      const { data: activatedResume, error: activationError } = await supabase
        .from("resumes")
        .update({ is_primary: true })
        .eq("id", insertedResume.id)
        .eq("user_id", user.id)
        .select("id, file_name, file_size, created_at, parsed_data, is_primary")
        .single();

      if (activationError) {
        if (resume?.id) {
          await supabase.from("resumes").update({ is_primary: true })
            .eq("id", resume.id).eq("user_id", user.id);
        }
        throw new Error("Failed to activate the new resume.");
      }

      setResume(
        activatedResume as ResumeRecord,
      );

      setMessage(
        `Resume processed successfully — ${parseResult.pages || 1} page${
          parseResult.pages === 1 ? "" : "s"
        } parsed.`,
      );
    } catch (uploadError) {
      console.error(
        "RESUME PROCESSING ERROR:",
        uploadError,
      );

      if (uploadedFilePath) {
        const supabase = createClient();

        if (insertedResumeId) {
          await supabase.from("resumes").delete()
            .eq("id", insertedResumeId).eq("user_id", uploadUserId);
        }

        await supabase.storage
          .from("resumes")
          .remove([uploadedFilePath]);
      }

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Resume processing failed.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const startEdit = (
    section: string,
  ) => {
    if (!resume) return;

    setMessage("");
    setError("");
    setActiveSection(section);
    setDraft(
      structuredClone(resume.parsed_data),
    );
  };

  const cancelEdit = () => {
    setActiveSection(null);
    setDraft(null);
  };

  const saveDraft = async () => {
    if (!resume || !draft) return;

    const normalized =
      normalizeResumeData(draft);

    const validationError =
      validateResumeData(normalized);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const supabase = createClient();

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("You must be logged in.");

      const { data, error: updateError } =
        await supabase
          .from("resumes")
          .update({
            parsed_data: normalized,
          })
          .eq("id", resume.id)
          .eq("user_id", user.id)
          .select(
            "id, file_name, file_size, created_at, parsed_data, is_primary",
          )
          .single();

      if (updateError) {
        throw new Error(
          `Failed to save resume: ${updateError.message}`,
        );
      }

      setResume(
        data as ResumeRecord,
      );
      setActiveSection(null);
      setDraft(null);
      setMessage("Resume changes saved.");
    } catch (saveError) {
      console.error(
        "RESUME SAVE ERROR:",
        saveError,
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save resume.",
      );
    } finally {
      setSaving(false);
    }
  };

  const data = resume?.parsed_data;

  const stats = useMemo(() => {
    if (!data) {
      return {
        skills: 0,
        experience: 0,
        projects: 0,
        education: 0,
        achievements: 0,
      };
    }

    const skills = Object.values(
      data.skills || {},
    ).reduce(
      (total, items) =>
        total + items.length,
      0,
    );

    return {
      skills,
      experience: data.experience.length,
      projects: data.projects.length,
      education: data.education.length,
      achievements:
        data.achievements.length,
    };
  }, [data]);

  const completion = useMemo(() => {
    if (!data) return 0;

    const checks = [
      Boolean(data.personalInfo?.name),
      Boolean(data.personalInfo?.email),
      Boolean(data.personalInfo?.phone),
      Boolean(data.personalInfo?.location),
      Boolean(data.summary),
      stats.skills > 0,
      stats.experience > 0,
      stats.projects > 0,
      stats.education > 0,
      stats.achievements > 0,
    ];

    return Math.round(
      (checks.filter(Boolean).length /
        checks.length) *
        100,
    );
  }, [data, stats]);

  const updateDraft = (
    updater: (current: ParsedResume) => ParsedResume,
  ) => {
    setDraft((current) =>
      current ? updater(current) : current,
    );
  };

  return (
    <main className="resume-page min-h-screen">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="section-label">
              <FileText className="size-3.5" />
              Career profile
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Your resume
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Upload your PDF, check the imported details, and mark your main resume as Primary. Parth Careers uses it to match jobs and prepare applications.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleUpload}
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={() => void loadResume()}
              disabled={loading || uploading}
            >
              <RefreshCw
                className={cn(
                  "size-4",
                  loading && "animate-spin",
                )}
              />
              Refresh
            </Button>

            <Button
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {resume
                ? "Replace resume"
                : "Upload resume"}
            </Button>
            <Link href="/resume/studio" className={buttonVariants({ variant: "outline" })}>
              <Sparkles className="size-4" />
              Review & download
            </Link>
          </div>
        </header>
        {!loading && resume && data ? <nav aria-label="Resume sections" className="section-shortcuts mt-4 flex flex-wrap gap-2">{["Personal information", "Professional summary", "Skills", "Work experience", "Projects", "Education", "Achievements"].map(title => <a key={title} href={`#resume-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</a>)}</nav> : null}

        {!loading && resume && data ? <section className="resume-save-bar mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4" aria-label="Resume editing status">
          <div><p className="text-sm font-semibold" role="status" aria-live="polite">{saving ? "Saving your resume…" : activeSection ? "Editing your resume" : "Your saved resume"}</p><p className="mt-1 text-xs text-muted-foreground">{activeSection ? "Save to apply your edits. Section changes are not saved automatically." : "Choose a section below to review or improve it."}</p></div>
          {activeSection ? <Button onClick={() => void saveDraft()} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save resume</Button> : <Link href="/jobs" className="text-sm font-semibold text-primary hover:underline">Explore your matches →</Link>}
        </section> : null}

        {/* Alerts */}
        {message && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <Check className="size-4" />
            </span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">
                Resume workspace error
              </p>
              <p className="mt-0.5 opacity-80">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss resume error"
              className="rounded-lg p-1 hover:bg-destructive/10"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-6 space-y-4">
            <div className="surface animate-pulse rounded-2xl p-6">
              <div className="h-5 w-48 rounded bg-muted" />
              <div className="mt-3 h-3 w-80 rounded bg-muted" />
              <div className="mt-8 grid gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-20 rounded-xl bg-muted"
                  />
                ))}
              </div>
            </div>

            <div className="surface h-64 animate-pulse rounded-2xl bg-muted/40" />
          </div>
        )}

        {/* Empty */}
        {!loading &&
          (!resume || !data) && (
            <section className="mt-6 overflow-hidden rounded-3xl border bg-background shadow-[var(--shadow-soft)]">
              <div className="relative px-5 py-12 text-center sm:px-10 sm:py-16">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_45%)]" />

                <div className="relative">
                  <div className="mx-auto max-w-xs"><CareerScene /></div>

                  <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                    Build your career profile
                  </p>

                  <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    Turn your resume into structured career data
                  </h2>

                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Upload a PDF and Parth Careers will extract
                    your experience, skills, education, projects
                    and professional identity.
                  </p>

                  <div className="mt-7">
                    <Button
                      size="lg"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      Upload PDF resume
                    </Button>
                  </div>

                  <p className="mt-3 text-[11px] text-muted-foreground">
                    PDF only · Maximum 5 MB
                  </p>
                </div>
              </div>
            </section>
          )}

        {/* Workspace */}
        {!loading &&
          resume &&
          data && (
            <div className="mt-6 space-y-5">
              {/* Resume overview */}
              <section className="overflow-hidden rounded-2xl border bg-background shadow-[var(--shadow-soft)]">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="size-6" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-bold sm:text-lg">
                            {resume.file_name}
                          </h2>

                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            Primary
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatFileSize(
                            resume.file_size,
                          )}{" "}
                          · Uploaded{" "}
                          {formatDate(
                            resume.created_at,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden min-w-40 sm:block">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold">
                            Profile completeness
                          </span>
                          <span className="font-bold text-primary">
                            {completion}%
                          </span>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${completion}%`,
                            }}
                          />
                        </div>
                      </div>

                      <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Check className="size-4" />
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      [
                        "Skills",
                        stats.skills,
                        Wrench,
                      ],
                      [
                        "Experience",
                        stats.experience,
                        BriefcaseBusiness,
                      ],
                      [
                        "Projects",
                        stats.projects,
                        Target,
                      ],
                      [
                        "Education",
                        stats.education,
                        GraduationCap,
                      ],
                      [
                        "Achievements",
                        stats.achievements,
                        Award,
                      ],
                    ].map(
                      ([label, value, Icon]) => {
                        const IconComponent =
                          Icon as typeof FileText;

                        return (
                          <div
                            key={String(label)}
                            className="rounded-xl bg-muted/45 p-3"
                          >
                            <IconComponent className="size-3.5 text-muted-foreground" />
                            <p className="mt-2 text-lg font-bold">
                              {String(value)}
                            </p>
                            <p className="text-[10px] font-medium text-muted-foreground">
                              {String(label)}
                            </p>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </section>

              {/* Personal information */}
              <Section
                icon={UserRound}
                title="Personal information"
                description="Your professional identity and contact details."
                editing={
                  activeSection ===
                  "personal"
                }
                onEdit={() =>
                  startEdit("personal")
                }
                onCancel={cancelEdit}
                onSave={() => void saveDraft()}
                saving={saving}
              >
                {activeSection ===
                  "personal" &&
                draft ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Full name"
                      value={
                        draft.personalInfo
                          .name
                      }
                      onChange={(value) =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            personalInfo: {
                              ...current.personalInfo,
                              name: value,
                            },
                          }),
                        )
                      }
                    />

                    <Field
                      label="Email"
                      value={
                        draft.personalInfo
                          .email
                      }
                      onChange={(value) =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            personalInfo: {
                              ...current.personalInfo,
                              email: value,
                            },
                          }),
                        )
                      }
                    />

                    <Field
                      label="Phone"
                      value={
                        draft.personalInfo
                          .phone
                      }
                      onChange={(value) =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            personalInfo: {
                              ...current.personalInfo,
                              phone: value,
                            },
                          }),
                        )
                      }
                    />

                    <Field
                      label="Location"
                      value={
                        draft.personalInfo
                          .location
                      }
                      onChange={(value) =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            personalInfo: {
                              ...current.personalInfo,
                              location: value,
                            },
                          }),
                        )
                      }
                    />

                    <Field
                      label="GitHub"
                      value={
                        draft.personalInfo
                          .github
                      }
                      placeholder="https://github.com/..."
                      onChange={(value) =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            personalInfo: {
                              ...current.personalInfo,
                              github: value,
                            },
                          }),
                        )
                      }
                    />

                    <Field
                      label="LinkedIn"
                      value={
                        draft.personalInfo
                          .linkedin
                      }
                      placeholder="https://linkedin.com/in/..."
                      onChange={(value) =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            personalInfo: {
                              ...current.personalInfo,
                              linkedin: value,
                            },
                          }),
                        )
                      }
                    />

                    <Field
                      label="Portfolio"
                      value={
                        draft.personalInfo
                          .portfolio
                      }
                      placeholder="https://..."
                      onChange={(value) =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            personalInfo: {
                              ...current.personalInfo,
                              portfolio: value,
                            },
                          }),
                        )
                      }
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoItem
                      icon={UserRound}
                      label="Name"
                      value={
                        data.personalInfo
                          .name
                      }
                    />

                    <InfoItem
                      icon={Mail}
                      label="Email"
                      value={
                        data.personalInfo
                          .email
                      }
                    />

                    <InfoItem
                      icon={Phone}
                      label="Phone"
                      value={
                        data.personalInfo
                          .phone
                      }
                    />

                    <InfoItem
                      icon={MapPin}
                      label="Location"
                      value={
                        data.personalInfo
                          .location
                      }
                    />

                    <LinkInfo
                      label="GitHub"
                      value={
                        data.personalInfo
                          .github
                      }
                    />

                    <LinkInfo
                      label="LinkedIn"
                      value={
                        data.personalInfo
                          .linkedin
                      }
                    />

                    <LinkInfo
                      label="Portfolio"
                      value={
                        data.personalInfo
                          .portfolio
                      }
                    />
                  </div>
                )}
              </Section>

              {/* Summary */}
              <Section
                icon={Sparkles}
                title="Professional summary"
                description="The short positioning statement recruiters see first."
                editing={
                  activeSection ===
                  "summary"
                }
                onEdit={() =>
                  startEdit("summary")
                }
                onCancel={cancelEdit}
                onSave={() => void saveDraft()}
                saving={saving}
              >
                {activeSection ===
                  "summary" &&
                draft ? (
                  <textarea
                    value={draft.summary}
                    onChange={(event) =>
                      updateDraft(
                        (current) => ({
                          ...current,
                          summary:
                            event.target.value,
                        }),
                      )
                    }
                    rows={7}
                    className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-6 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                    placeholder="Write a concise professional summary..."
                  />
                ) : (
                  <div className="rounded-xl bg-muted/35 p-4 sm:p-5">
                    <p className="text-sm leading-7 text-muted-foreground">
                      {data.summary ||
                        "No professional summary was extracted. Add one to improve your profile completeness."}
                    </p>
                  </div>
                )}
              </Section>

              {/* Skills */}
              <Section
                icon={Wrench}
                title="Skills"
                description="Structured skills used by Parth Careers for job matching."
                editing={
                  activeSection ===
                  "skills"
                }
                onEdit={() =>
                  startEdit("skills")
                }
                onCancel={cancelEdit}
                onSave={() => void saveDraft()}
                saving={saving}
              >
                <div className="grid gap-6 md:grid-cols-2">
                  {skillGroups.map(
                    (group) => (
                      <SkillGroup
                        key={`${group.key}-${activeSection === "skills"}`}
                        title={group.label}
                        skills={
                          (activeSection ===
                          "skills" &&
                          draft
                            ? draft.skills
                            : data.skills)[
                            group.key
                          ]
                        }
                        editing={
                          activeSection ===
                          "skills"
                        }
                        onChange={(value) =>
                          updateDraft(
                            (current) => ({
                              ...current,
                              skills: {
                                ...current.skills,
                                [group.key]:
                                  value,
                              },
                            }),
                          )
                        }
                      />
                    ),
                  )}
                </div>
              </Section>

              {/* Experience */}
              <Section
                icon={BriefcaseBusiness}
                title="Work experience"
                description="Your professional history and impact."
                editing={
                  activeSection ===
                  "experience"
                }
                onEdit={() =>
                  startEdit("experience")
                }
                onCancel={cancelEdit}
                onSave={() => void saveDraft()}
                saving={saving}
              >
                {activeSection ===
                  "experience" &&
                draft ? (
                  <div className="space-y-4">
                    {draft.experience.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border bg-muted/20 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                Experience{" "}
                                {index + 1}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(
                                  (current) => ({
                                    ...current,
                                    experience:
                                      current.experience.filter(
                                        (
                                          _,
                                          itemIndex,
                                        ) =>
                                          itemIndex !==
                                          index,
                                      ),
                                  }),
                                )
                              }
                              aria-label="Remove item"
                              className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Role"
                              value={
                                item.role
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    experience:
                                      current.experience.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                role: value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="Company"
                              value={
                                item.company
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    experience:
                                      current.experience.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                company:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="Location"
                              value={
                                item.location
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    experience:
                                      current.experience.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                location:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="Start date"
                              value={
                                item.startDate
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    experience:
                                      current.experience.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                startDate:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="End date"
                              value={
                                item.endDate
                              }
                              placeholder="Present"
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    experience:
                                      current.experience.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                endDate:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />
                          </div>

                          <label className="mt-4 block">
                            <span className="text-xs font-semibold text-muted-foreground">
                              Description — one bullet per line
                            </span>

                            <textarea
                              value={item.description.join(
                                "\n",
                              )}
                              onChange={(event) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    experience:
                                      current.experience.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                description:
                                                  event.target.value
                                                    .split(
                                                      "\n",
                                                    )
                                                    .map(
                                                      (
                                                        value,
                                                      ) =>
                                                        value.trim(),
                                                    )
                                                    .filter(
                                                      Boolean,
                                                    ),
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                              rows={6}
                              className="mt-1.5 w-full resize-y rounded-xl border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                            />
                          </label>
                        </div>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            experience: [
                              ...current.experience,
                              {
                                company: "",
                                role: "",
                                location: "",
                                startDate: "",
                                endDate: "",
                                description: [],
                              },
                            ],
                          }),
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <Plus className="size-4" />
                      Add experience
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.experience.length === 0 ? (
                      <EmptySection text="No work experience found." />
                    ) : (
                      data.experience.map(
                        (item, index) => {
                          const expanded =
                            expandedExperience ===
                            index;

                          return (
                            <div
                              key={`${item.company}-${index}`}
                              className="rounded-2xl border bg-background"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedExperience(
                                    expanded
                                      ? null
                                      : index,
                                  )
                                }
                                className="flex w-full items-start gap-4 p-4 text-left sm:p-5"
                              >
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <BriefcaseBusiness className="size-4" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <h3 className="font-bold">
                                        {
                                          item.role
                                        }
                                      </h3>
                                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                                        {
                                          item.company
                                        }
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <span>
                                        {
                                          item.startDate
                                        }{" "}
                                        –{" "}
                                        {
                                          item.endDate
                                        }
                                      </span>

                                      {expanded ? (
                                        <ChevronUp className="size-4" />
                                      ) : (
                                        <ChevronDown className="size-4" />
                                      )}
                                    </div>
                                  </div>

                                  {item.location && (
                                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <MapPin className="size-3" />
                                      {
                                        item.location
                                      }
                                    </p>
                                  )}
                                </div>
                              </button>

                              {expanded && (
                                <div className="border-t px-4 py-4 sm:px-5">
                                  <BulletList
                                    items={
                                      item.description
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          );
                        },
                      )
                    )}
                  </div>
                )}
              </Section>

              {/* Projects */}
              <Section
                icon={Target}
                title="Projects"
                description="Products and projects that demonstrate your practical skills."
                editing={
                  activeSection ===
                  "projects"
                }
                onEdit={() =>
                  startEdit("projects")
                }
                onCancel={cancelEdit}
                onSave={() => void saveDraft()}
                saving={saving}
              >
                {activeSection ===
                  "projects" &&
                draft ? (
                  <div className="space-y-4">
                    {draft.projects.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border bg-muted/20 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                              Project {index + 1}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(
                                  (current) => ({
                                    ...current,
                                    projects:
                                      current.projects.filter(
                                        (
                                          _,
                                          itemIndex,
                                        ) =>
                                          itemIndex !==
                                          index,
                                      ),
                                  }),
                                )
                              }
                              aria-label="Remove item"
                              className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="mt-4">
                            <Field
                              label="Project name"
                              value={
                                item.name
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    projects:
                                      current.projects.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                name: value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />
                          </div>

                          <label className="mt-4 block">
                            <span className="text-xs font-semibold text-muted-foreground">
                              Description — one bullet per line
                            </span>

                            <textarea
                              value={item.description.join(
                                "\n",
                              )}
                              onChange={(event) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    projects:
                                      current.projects.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                description:
                                                  event.target.value
                                                    .split(
                                                      "\n",
                                                    )
                                                    .map(
                                                      (
                                                        value,
                                                      ) =>
                                                        value.trim(),
                                                    )
                                                    .filter(
                                                      Boolean,
                                                    ),
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                              rows={5}
                              className="mt-1.5 w-full resize-y rounded-xl border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                            />
                          </label>

                          <Field
                            label="Technologies — comma separated"
                            value={item.technologies.join(
                              ", ",
                            )}
                            onChange={(value) =>
                              updateDraft(
                                (current) => ({
                                  ...current,
                                  projects:
                                    current.projects.map(
                                      (
                                        entry,
                                        entryIndex,
                                      ) =>
                                        entryIndex ===
                                        index
                                          ? {
                                              ...entry,
                                              technologies:
                                                value
                                                  .split(
                                                    ",",
                                                  )
                                                  .map(
                                                    (
                                                      item,
                                                    ) =>
                                                      item.trim(),
                                                  )
                                                  .filter(
                                                    Boolean,
                                                  ),
                                            }
                                          : entry,
                                    ),
                                }),
                              )
                            }
                          />
                        </div>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            projects: [
                              ...current.projects,
                              {
                                name: "",
                                description: [],
                                technologies: [],
                              },
                            ],
                          }),
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-xs font-semibold text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <Plus className="size-4" />
                      Add project
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.projects.length === 0 ? (
                      <div className="md:col-span-2">
                        <EmptySection text="No projects found." />
                      </div>
                    ) : (
                      data.projects.map(
                        (project, index) => {
                          const expanded =
                            expandedProject ===
                            index;

                          return (
                            <div
                              key={`${project.name}-${index}`}
                              className="rounded-2xl border bg-background"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProject(
                                    expanded
                                      ? null
                                      : index,
                                  )
                                }
                                className="flex w-full gap-3 p-4 text-left"
                              >
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <Target className="size-4" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <h3 className="truncate text-sm font-bold">
                                      {
                                        project.name
                                      }
                                    </h3>

                                    {expanded ? (
                                      <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                                    )}
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {project.technologies
                                      .slice(0, 4)
                                      .map(
                                        (
                                          technology,
                                        ) => (
                                          <span
                                            key={
                                              technology
                                            }
                                            className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium"
                                          >
                                            {
                                              technology
                                            }
                                          </span>
                                        ),
                                      )}

                                    {project
                                      .technologies
                                      .length >
                                      4 && (
                                      <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                        +
                                        {project
                                          .technologies
                                          .length -
                                          4}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {expanded && (
                                <div className="border-t px-4 py-4">
                                  <BulletList
                                    items={
                                      project.description
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          );
                        },
                      )
                    )}
                  </div>
                )}
              </Section>

              {/* Education */}
              <Section
                icon={GraduationCap}
                title="Education"
                description="Academic background and qualifications."
                editing={
                  activeSection ===
                  "education"
                }
                onEdit={() =>
                  startEdit("education")
                }
                onCancel={cancelEdit}
                onSave={() => void saveDraft()}
                saving={saving}
              >
                {activeSection ===
                  "education" &&
                draft ? (
                  <div className="space-y-4">
                    {draft.education.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border bg-muted/20 p-4"
                        >
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(
                                  (current) => ({
                                    ...current,
                                    education:
                                      current.education.filter(
                                        (
                                          _,
                                          itemIndex,
                                        ) =>
                                          itemIndex !==
                                          index,
                                      ),
                                  }),
                                )
                              }
                              aria-label="Remove item"
                              className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Degree"
                              value={
                                item.degree
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    education:
                                      current.education.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                degree: value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="Institution"
                              value={
                                item.institution
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    education:
                                      current.education.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                institution:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="Location"
                              value={
                                item.location
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    education:
                                      current.education.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                location:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="Start date"
                              value={
                                item.startDate
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    education:
                                      current.education.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                startDate:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />

                            <Field
                              label="End date"
                              value={
                                item.endDate
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    education:
                                      current.education.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                endDate:
                                                  value,
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                            />
                          </div>

                          <label className="mt-4 block">
                            <span className="text-xs font-semibold text-muted-foreground">
                              Details — one item per line
                            </span>

                            <textarea
                              value={item.details.join(
                                "\n",
                              )}
                              onChange={(event) =>
                                updateDraft(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    education:
                                      current.education.map(
                                        (
                                          entry,
                                          entryIndex,
                                        ) =>
                                          entryIndex ===
                                          index
                                            ? {
                                                ...entry,
                                                details:
                                                  event.target.value
                                                    .split(
                                                      "\n",
                                                    )
                                                    .map(
                                                      (
                                                        value,
                                                      ) =>
                                                        value.trim(),
                                                    )
                                                    .filter(
                                                      Boolean,
                                                    ),
                                              }
                                            : entry,
                                      ),
                                  }),
                                )
                              }
                              rows={4}
                              className="mt-1.5 w-full resize-y rounded-xl border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                            />
                          </label>
                        </div>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            education: [
                              ...current.education,
                              {
                                degree: "",
                                institution: "",
                                location: "",
                                startDate: "",
                                endDate: "",
                                details: [],
                              },
                            ],
                          }),
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-xs font-semibold text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <Plus className="size-4" />
                      Add education
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.education.length === 0 ? (
                      <EmptySection text="No education entries found." />
                    ) : (
                      data.education.map(
                        (item, index) => (
                          <div
                            key={`${item.institution}-${index}`}
                            className="rounded-2xl border p-4 sm:p-5"
                          >
                            <div className="flex gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <GraduationCap className="size-4" />
                              </div>

                              <div className="min-w-0">
                                <h3 className="font-bold">
                                  {item.degree}
                                </h3>

                                <p className="mt-1 text-xs font-medium text-muted-foreground">
                                  {
                                    item.institution
                                  }
                                </p>

                                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                  {item.location && (
                                    <span>
                                      {
                                        item.location
                                      }
                                    </span>
                                  )}

                                  <span>
                                    {
                                      item.startDate
                                    }{" "}
                                    –{" "}
                                    {
                                      item.endDate
                                    }
                                  </span>
                                </div>

                                {item.details.length >
                                  0 && (
                                  <div className="mt-4">
                                    <BulletList
                                      items={
                                        item.details
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ),
                      )
                    )}
                  </div>
                )}
              </Section>

              {/* Achievements */}
              <Section
                icon={Award}
                title="Achievements"
                description="Awards, certifications, recognitions and notable accomplishments."
                editing={
                  activeSection ===
                  "achievements"
                }
                onEdit={() =>
                  startEdit("achievements")
                }
                onCancel={cancelEdit}
                onSave={() => void saveDraft()}
                saving={saving}
              >
                {activeSection ===
                  "achievements" &&
                draft ? (
                  <div className="space-y-3">
                    {draft.achievements.map(
                      (achievement, index) => (
                        <div
                          key={index}
                          className="flex gap-2"
                        >
                          <input
                            value={achievement}
                            onChange={(event) =>
                              updateDraft(
                                (current) => ({
                                  ...current,
                                  achievements:
                                    current.achievements.map(
                                      (
                                        item,
                                        itemIndex,
                                      ) =>
                                        itemIndex ===
                                        index
                                          ? event.target
                                              .value
                                          : item,
                                    ),
                                }),
                              )
                            }
                            className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              updateDraft(
                                (current) => ({
                                  ...current,
                                  achievements:
                                    current.achievements.filter(
                                      (
                                        _,
                                        itemIndex,
                                      ) =>
                                        itemIndex !==
                                        index,
                                    ),
                                }),
                              )
                            }
                            aria-label="Remove item"
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl border text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        updateDraft(
                          (current) => ({
                            ...current,
                            achievements: [
                              ...current.achievements,
                              "",
                            ],
                          }),
                        )
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-xs font-semibold text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <Plus className="size-4" />
                      Add achievement
                    </button>
                  </div>
                ) : (
                  <BulletList
                    items={data.achievements}
                    emptyText="No achievements found. Add awards, certifications or measurable accomplishments."
                  />
                )}
              </Section>

              {/* AI note */}
              <section className="ai-surface rounded-2xl border p-5 sm:p-6">
                <div className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                      Make your resume work harder
                    </p>

                    <h2 className="mt-1 text-base font-bold">
                      Your structured resume powers job matching
                    </h2>

                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Skills, experience, projects and
                      professional context from this profile
                      are used to make your job matches and
                      preparation workflows more relevant.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
      </div>
    </main>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/35 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>

      <p className="mt-2 truncate text-xs font-semibold">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function LinkInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value) {
    return (
      <div className="rounded-xl bg-muted/35 p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Link2 className="size-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]">
            {label}
          </span>
        </div>

        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Not provided
        </p>
      </div>
    );
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="group rounded-xl bg-muted/35 p-3 transition-colors hover:bg-primary/5"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Link2 className="size-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em]">
          {label}
        </span>
        <ExternalLink className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <p className="mt-2 truncate text-xs font-semibold text-primary">
        {value}
      </p>
    </a>
  );
}

function EmptySection({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

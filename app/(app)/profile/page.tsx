"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn, safeExternalUrl } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  target_role: string | null;
  current_company: string | null;
  experience_years: number | null;
  location: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
};

type Preferences = {
  id: string;
  user_id: string;
  preferred_roles: string[];
  preferred_locations: string[];
  remote_only: boolean;
  employment_types: string[];
  minimum_match_score: number;
  minimum_salary: number | null;
  preferred_countries: string[];
};

type ProfileDraft = {
  full_name: string;
  target_role: string;
  current_company: string;
  experience_years: string;
  location: string;
  github_url: string;
  linkedin_url: string;
  portfolio_url: string;
};

type PreferencesDraft = {
  preferred_roles: string;
  preferred_locations: string;
  remote_only: boolean;
  employment_types: string;
  minimum_match_score: string;
  minimum_salary: string;
  preferred_countries: string;
};

const splitList = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const joinList = (items: string[] | null | undefined) =>
  (items || []).join(", ");

function initials(name: string | null) {
  return (name || "Y")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

async function createInitialProfile(
  supabase: ReturnType<typeof createClient>,
  user: User,
) {
  const metadata = user.user_metadata || {};
  const fullName = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string"
      ? metadata.name
      : "";
  const avatarUrl = typeof metadata.avatar_url === "string"
    ? metadata.avatar_url
    : typeof metadata.picture === "string"
      ? metadata.picture
      : null;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email || null,
      full_name: fullName,
      avatar_url: avatarUrl,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

function TagList({
  items,
  empty = "Not configured",
}: {
  items: string[];
  empty?: string;
}) {
  if (!items.length) {
    return (
      <span className="text-sm text-muted-foreground">
        {empty}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>

      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange?.(event.target.value)
        }
        placeholder={placeholder}
        className={cn(
          "mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition",
          "focus:border-primary/40 focus:ring-4 focus:ring-primary/10",
          disabled && "cursor-not-allowed bg-muted/40 opacity-70",
        )}
      />
    </label>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/25 p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>

      <p className="mt-2 truncate text-sm font-semibold">
        {value || "Not specified"}
      </p>
    </div>
  );
}

function LinkCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Globe2;
  label: string;
  value: string | null;
}) {
  const url = safeExternalUrl(value);

  if (!url) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/15 p-3.5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          <span className="text-xs font-semibold">
            {label}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Not connected
        </p>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group rounded-xl border bg-background p-3.5 transition hover:border-primary/25 hover:bg-primary/[0.025]"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-3.5" />
        </span>

        <span className="text-xs font-semibold">
          {label}
        </span>

        <ExternalLink className="ml-auto size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>

      <p className="mt-2 truncate text-[11px] text-primary">
        {value}
      </p>
    </a>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  onEdit,
}: {
  icon: typeof UserRound;
  eyebrow: string;
  title: string;
  description: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>

          <h2 className="mt-0.5 text-sm font-bold tracking-tight">
            {title}
          </h2>

          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="self-start sm:self-auto"
        >
          <Pencil className="size-3.5" />
          Edit profile
        </Button>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [preferences, setPreferences] =
    useState<Preferences | null>(null);

  const [profileDraft, setProfileDraft] =
    useState<ProfileDraft | null>(null);

  const [preferencesDraft, setPreferencesDraft] =
    useState<PreferencesDraft | null>(null);

  const [editing, setEditing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const loadData = useCallback(async () => {
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

      const [
        profileResult,
        {
          data: preferencesData,
          error: preferencesError,
        },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("job_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        throw new Error(
          `Failed to load profile: ${profileResult.error.message}`,
        );
      }

      if (preferencesError) {
        throw new Error(
          `Failed to load job preferences: ${preferencesError.message}`,
        );
      }

      const profileData = profileResult.data || await createInitialProfile(supabase, user);

      setProfile({
        ...(profileData as Profile),
        email:
          profileData.email ||
          user.email ||
          null,
        full_name:
          profileData.full_name ||
          user.user_metadata?.full_name ||
          "",
        avatar_url:
          profileData.avatar_url ||
          user.user_metadata?.avatar_url ||
          null,
      });

      setPreferences(
        (preferencesData as Preferences | null) ||
          null,
      );
    } catch (loadError) {
      console.error(
        "PROFILE LOAD ERROR:",
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const startEditing = () => {
    if (!profile) return;

    setProfileDraft({
      full_name: profile.full_name || "",
      target_role: profile.target_role || "",
      current_company:
        profile.current_company || "",
      experience_years:
        profile.experience_years != null
          ? String(profile.experience_years)
          : "",
      location: profile.location || "",
      github_url: profile.github_url || "",
      linkedin_url:
        profile.linkedin_url || "",
      portfolio_url:
        profile.portfolio_url || "",
    });

    setPreferencesDraft({
      preferred_roles: joinList(
        preferences?.preferred_roles,
      ),
      preferred_locations: joinList(
        preferences?.preferred_locations,
      ),
      remote_only:
        preferences?.remote_only ?? true,
      employment_types: joinList(
        preferences?.employment_types?.length
          ? preferences.employment_types
          : ["full-time"],
      ),
      minimum_match_score: String(
        preferences?.minimum_match_score ?? 70,
      ),
      minimum_salary:
        preferences?.minimum_salary != null
          ? String(preferences.minimum_salary)
          : "",
      preferred_countries: joinList(
        preferences?.preferred_countries?.length
          ? preferences.preferred_countries
          : ["India"],
      ),
    });

    setEditing(true);
    setMessage("");
    setError("");
  };

  const cancelEditing = () => {
    setEditing(false);
    setProfileDraft(null);
    setPreferencesDraft(null);
    setMessage("");
    setError("");
  };

  const updateProfileDraft = (
    field: keyof ProfileDraft,
    value: string,
  ) => {
    if (!profileDraft) return;

    setProfileDraft({
      ...profileDraft,
      [field]: value,
    });
  };

  const updatePreferencesDraft = (
    field: keyof PreferencesDraft,
    value: string | boolean,
  ) => {
    if (!preferencesDraft) return;

    setPreferencesDraft({
      ...preferencesDraft,
      [field]: value,
    });
  };

  const saveAll = async () => {
    if (
      !profile ||
      !profileDraft ||
      !preferencesDraft
    ) {
      return;
    }

    const fullName =
      profileDraft.full_name.trim();

    const targetRole =
      profileDraft.target_role.trim();

    const currentCompany =
      profileDraft.current_company.trim();

    const location =
      profileDraft.location.trim();

    if (!fullName) {
      setError("Name is required.");
      return;
    }

    if (!targetRole) {
      setError("Target Role is required.");
      return;
    }

    if (!currentCompany) {
      setError(
        "Current Organization is required.",
      );
      return;
    }

    if (!location) {
      setError("Location is required.");
      return;
    }

    const invalidLink = [
      profileDraft.github_url,
      profileDraft.linkedin_url,
      profileDraft.portfolio_url,
    ].find((value) => value.trim() && !safeExternalUrl(value.trim()));

    if (invalidLink) {
      setError("Professional links must use a valid http:// or https:// URL.");
      return;
    }

    const experience =
      profileDraft.experience_years.trim();

    if (
      experience &&
      (Number.isNaN(Number(experience)) ||
        Number(experience) < 0 ||
        Number(experience) > 50)
    ) {
      setError(
        "Experience must be between 0 and 50 years.",
      );
      return;
    }

    const roles = splitList(
      preferencesDraft.preferred_roles,
    );

    if (roles.length === 0) {
      setError(
        "Add at least one preferred role.",
      );
      return;
    }

    const matchScore = Number(
      preferencesDraft.minimum_match_score,
    );

    if (
      !Number.isInteger(matchScore) ||
      matchScore < 0 ||
      matchScore > 100
    ) {
      setError(
        "Minimum Match Score must be between 0 and 100.",
      );
      return;
    }

    const salaryValue =
      preferencesDraft.minimum_salary.trim();

    if (
      salaryValue &&
      (Number.isNaN(Number(salaryValue)) ||
        Number(salaryValue) < 0)
    ) {
      setError(
        "Minimum Salary must be a valid amount.",
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user || user.id !== profile.id) {
        throw new Error("You must be logged in.");
      }

      const updatedProfile = {
        full_name: fullName,
        target_role: targetRole,
        current_company: currentCompany,
        experience_years: experience
          ? Number(experience)
          : null,
        location,
        github_url:
          profileDraft.github_url.trim() ||
          null,
        linkedin_url:
          profileDraft.linkedin_url.trim() ||
          null,
        portfolio_url:
          profileDraft.portfolio_url.trim() ||
          null,
      };

      const updatedPreferences = {
        user_id: profile.id,
        preferred_roles: roles,
        preferred_locations: splitList(
          preferencesDraft.preferred_locations,
        ),
        remote_only:
          preferencesDraft.remote_only,
        employment_types: splitList(
          preferencesDraft.employment_types,
        ),
        minimum_match_score: Number(
          preferencesDraft.minimum_match_score || 70,
        ),
        minimum_salary: salaryValue
          ? Number(salaryValue)
          : null,
        preferred_countries: splitList(
          preferencesDraft.preferred_countries,
        ),
      };

      const [
        {
          data: savedProfile,
          error: profileError,
        },
        {
          data: savedPreferences,
          error: preferencesError,
        },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .update(updatedProfile)
          .eq("id", profile.id)
          .select("*")
          .single(),

        supabase
          .from("job_preferences")
          .upsert(updatedPreferences, {
            onConflict: "user_id",
          })
          .select("*")
          .single(),
      ]);

      if (profileError) {
        throw new Error(
          `Failed to save profile: ${profileError.message}`,
        );
      }

      if (preferencesError) {
        throw new Error(
          `Failed to save job preferences: ${preferencesError.message}`,
        );
      }

      setProfile(savedProfile as Profile);
      setPreferences(
        savedPreferences as Preferences,
      );
      setEditing(false);
      setProfileDraft(null);
      setPreferencesDraft(null);

      setMessage(
        "Your career profile is up to date.",
      );
    } catch (saveError) {
      console.error(
        "PROFILE SAVE ERROR:",
        saveError,
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const profileCompleteness = useMemo(() => {
    if (!profile) return 0;

    const checks = [
      profile.full_name,
      profile.email,
      profile.target_role,
      profile.current_company,
      profile.experience_years != null,
      profile.location,
      profile.github_url,
      profile.linkedin_url,
      profile.portfolio_url,
      preferences?.preferred_roles?.length,
      preferences?.preferred_countries?.length,
    ];

    return Math.round(
      (checks.filter(Boolean).length /
        checks.length) *
        100,
    );
  }, [profile, preferences]);

  const matchScore =
    preferences?.minimum_match_score ?? 70;

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-5">
            <div className="h-32 rounded-2xl bg-muted" />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-96 rounded-2xl bg-muted" />
              <div className="h-96 rounded-2xl bg-muted" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border bg-background p-6">
            <div className="flex gap-3 text-destructive">
              <CircleAlert className="size-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  Profile unavailable
                </p>
                <p className="mt-1 text-sm opacity-80">
                  {error ||
                    "Your profile could not be loaded."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page min-h-screen">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="section-label">
              <UserRound className="size-3.5" />
              Career profile
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Your profile & job preferences
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Start with your target role, location and experience. Set job preferences, save changes, then find matching jobs. Only enter your actual facts.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading || saving}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>

            {!editing ? (
              <Button onClick={startEditing}>
                <Pencil className="size-4" />
                Edit profile
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X className="size-4" />
                  Cancel
                </Button>

                <Button
                  onClick={() => void saveAll()}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save changes
                </Button>
              </>
            )}
          </div>
        </header>

        {/* Alerts */}
        {message && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <Check className="size-4" />
            </span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />

            <div className="flex-1">
              <p className="font-semibold">
                Something needs attention
              </p>
              <p className="mt-0.5 text-xs opacity-80">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss profile error"
              className="rounded-lg p-1 hover:bg-destructive/10"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {editing &&
          profileDraft &&
          preferencesDraft ? (
          /* =====================================================
             EDIT MODE
             ===================================================== */
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border bg-background shadow-[var(--shadow-soft)]">
              <div className="border-b bg-muted/20 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Pencil className="size-4" />
                  </div>

                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">
                      Edit workspace
                    </p>
                    <h2 className="mt-0.5 text-sm font-bold">
                      Update your career identity
                    </h2>
                  </div>
                </div>
              </div>

              <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-2">
                {/* Identity */}
                <div>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em]">
                      Professional identity
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This information powers your profile and
                      matching context.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Full name"
                      value={profileDraft.full_name}
                      onChange={(value) =>
                        updateProfileDraft(
                          "full_name",
                          value,
                        )
                      }
                    />

                    <Field
                      label="Email"
                      value={profile.email || ""}
                      disabled
                    />

                    <Field
                      label="Target role"
                      value={profileDraft.target_role}
                      placeholder="Frontend Engineer"
                      onChange={(value) =>
                        updateProfileDraft(
                          "target_role",
                          value,
                        )
                      }
                    />

                    <Field
                      label="Experience"
                      value={
                        profileDraft.experience_years
                      }
                      type="number"
                      placeholder="4"
                      onChange={(value) =>
                        updateProfileDraft(
                          "experience_years",
                          value,
                        )
                      }
                    />

                    <Field
                      label="Current organization"
                      value={
                        profileDraft.current_company
                      }
                      placeholder="Current company"
                      onChange={(value) =>
                        updateProfileDraft(
                          "current_company",
                          value,
                        )
                      }
                    />

                    <Field
                      label="Location"
                      value={profileDraft.location}
                      placeholder="Jaipur, Rajasthan, India"
                      onChange={(value) =>
                        updateProfileDraft(
                          "location",
                          value,
                        )
                      }
                    />
                  </div>

                  <div className="mt-6">
                    <p className="mb-4 text-xs font-bold uppercase tracking-[0.12em]">
                      Professional links
                    </p>

                    <div className="space-y-4">
                      <Field
                        label="GitHub URL"
                        type="url"
                        value={
                          profileDraft.github_url
                        }
                        placeholder="https://github.com/username"
                        onChange={(value) =>
                          updateProfileDraft(
                            "github_url",
                            value,
                          )
                        }
                      />

                      <Field
                        label="LinkedIn URL"
                        type="url"
                        value={
                          profileDraft.linkedin_url
                        }
                        placeholder="https://linkedin.com/in/username"
                        onChange={(value) =>
                          updateProfileDraft(
                            "linkedin_url",
                            value,
                          )
                        }
                      />

                      <Field
                        label="Portfolio URL"
                        type="url"
                        value={
                          profileDraft.portfolio_url
                        }
                        placeholder="https://yourportfolio.com"
                        onChange={(value) =>
                          updateProfileDraft(
                            "portfolio_url",
                            value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em]">
                      Job search preferences
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tell JobPilot what a good opportunity
                      looks like for you.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Field
                      label="Preferred roles"
                      value={
                        preferencesDraft.preferred_roles
                      }
                      placeholder="React Developer, Frontend Engineer"
                      onChange={(value) =>
                        updatePreferencesDraft(
                          "preferred_roles",
                          value,
                        )
                      }
                    />

                    <Field
                      label="Preferred locations"
                      value={
                        preferencesDraft.preferred_locations
                      }
                      placeholder="Remote, India, Jaipur"
                      onChange={(value) =>
                        updatePreferencesDraft(
                          "preferred_locations",
                          value,
                        )
                      }
                    />

                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={
                            preferencesDraft.remote_only
                          }
                          onChange={(event) =>
                            updatePreferencesDraft(
                              "remote_only",
                              event.target.checked,
                            )
                          }
                          className="size-4 accent-[var(--primary)]"
                        />

                        <div>
                          <p className="text-sm font-semibold">
                            Remote only
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Prioritize opportunities that support
                            remote work.
                          </p>
                        </div>

                        <span
                          className={cn(
                            "ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold",
                            preferencesDraft.remote_only
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {preferencesDraft.remote_only
                            ? "ON"
                            : "OFF"}
                        </span>
                      </label>
                    </div>

                    <Field
                      label="Employment types"
                      value={
                        preferencesDraft.employment_types
                      }
                      placeholder="full-time, contract"
                      onChange={(value) =>
                        updatePreferencesDraft(
                          "employment_types",
                          value,
                        )
                      }
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Minimum match score"
                        value={
                          preferencesDraft.minimum_match_score
                        }
                        type="number"
                        onChange={(value) =>
                          updatePreferencesDraft(
                            "minimum_match_score",
                            value,
                          )
                        }
                      />

                      <Field
                        label="Minimum salary"
                        value={
                          preferencesDraft.minimum_salary
                        }
                        type="number"
                        placeholder="1000000"
                        onChange={(value) =>
                          updatePreferencesDraft(
                            "minimum_salary",
                            value,
                          )
                        }
                      />
                    </div>

                    <Field
                      label="Preferred countries"
                      value={
                        preferencesDraft.preferred_countries
                      }
                      placeholder="India, United States, United Kingdom"
                      onChange={(value) =>
                        updatePreferencesDraft(
                          "preferred_countries",
                          value,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
              <p className="text-xs text-muted-foreground">Changes are saved only when you choose Save.</p>
              <Button onClick={() => void saveAll()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save changes</Button>
            </div>
            {/* Matching rule */}
            <section className="ai-surface rounded-2xl border p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Target className="size-4" />
                </div>

                <div>
                  <p className="text-xs font-bold">
                    Job matching rule
                  </p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    JobPilot will exclude only your current
                    organization from job matching. Your previous
                    employers remain eligible.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* =====================================================
             VIEW MODE
             ===================================================== */
          <div className="space-y-5">
            {/* Career identity hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-background shadow-[var(--shadow-soft)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent_30rem)]" />

              <div className="relative p-5 sm:p-7">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    {profile.avatar_url ? (
                      <span
                        role="img"
                        aria-label={`${profile.full_name || "User"} profile photo`}
                        className="size-16 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-border"
                        style={{ backgroundImage: `url(${JSON.stringify(profile.avatar_url)})` }}
                      />
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-foreground text-lg font-bold text-background">
                        {initials(
                          profile.full_name,
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                          {profile.full_name ||
                            "Your profile"}
                        </h2>

                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                          PROFILE ACTIVE
                        </span>
                      </div>

                      <p className="mt-1 text-sm font-medium text-primary">
                        {profile.target_role ||
                          "Target role not configured"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        {profile.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-3.5" />
                            {profile.location}
                          </span>
                        )}

                        {profile.experience_years !=
                          null && (
                          <span className="flex items-center gap-1.5">
                            <BriefcaseBusiness className="size-3.5" />
                            {profile.experience_years}+ years
                          </span>
                        )}

                        <span className="flex items-center gap-1.5">
                          <Target className="size-3.5" />
                          {matchScore}% minimum match
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Completeness */}
                  <div className="w-full max-w-xs rounded-2xl border bg-background/75 p-4 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        Profile completeness
                      </span>

                      <span className="text-sm font-bold text-primary">
                        {profileCompleteness}%
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${profileCompleteness}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Keep this complete for better matching.
                    </p>
                  </div>
                </div>

                {/* Identity signals */}
                <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InfoBlock
                    icon={Target}
                    label="Target role"
                    value={
                      profile.target_role ||
                      "Not specified"
                    }
                  />

                  <InfoBlock
                    icon={BriefcaseBusiness}
                    label="Experience"
                    value={
                      profile.experience_years !=
                      null
                        ? `${profile.experience_years}+ years`
                        : "Not specified"
                    }
                  />

                  <InfoBlock
                    icon={MapPin}
                    label="Location"
                    value={
                      profile.location ||
                      "Not specified"
                    }
                  />

                  <InfoBlock
                    icon={Search}
                    label="Search mode"
                    value={
                      preferences?.remote_only
                        ? "Remote only"
                        : "Remote + on-site"
                    }
                  />
                </div>
              </div>
            </section>

            {/* Main content */}
            <div className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
              {/* Professional information */}
              <section className="overflow-hidden rounded-2xl border bg-background shadow-[var(--shadow-soft)]">
                <SectionHeader
                  icon={UserRound}
                  eyebrow="Professional identity"
                  title="About you"
                  description="The information behind your career profile."
                  onEdit={startEditing}
                />

                <div className="p-5 sm:p-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBlock
                      icon={UserRound}
                      label="Name"
                      value={
                        profile.full_name ||
                        "Not specified"
                      }
                    />

                    <InfoBlock
                      icon={Globe2}
                      label="Email"
                      value={
                        profile.email ||
                        "Not available"
                      }
                    />

                    <InfoBlock
                      icon={BriefcaseBusiness}
                      label="Current organization"
                      value={
                        profile.current_company ||
                        "Not specified"
                      }
                    />

                    <InfoBlock
                      icon={MapPin}
                      label="Location"
                      value={
                        profile.location ||
                        "Not specified"
                      }
                    />
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold">
                          Professional links
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Make it easy for recruiters to verify
                          your work.
                        </p>
                      </div>

                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <LinkCard
                        icon={Globe2}
                        label="GitHub"
                        value={profile.github_url}
                      />

                      <LinkCard
                        icon={Globe2}
                        label="LinkedIn"
                        value={profile.linkedin_url}
                      />

                      <LinkCard
                        icon={Globe2}
                        label="Portfolio"
                        value={profile.portfolio_url}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Search preferences */}
              <section className="overflow-hidden rounded-2xl border bg-background shadow-[var(--shadow-soft)]">
                <SectionHeader
                  icon={Search}
                  eyebrow="Job discovery"
                  title="Search preferences"
                  description="What JobPilot should prioritize for you."
                  onEdit={startEditing}
                />

                <div className="space-y-5 p-5 sm:p-6">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Preferred roles
                    </p>
                    <TagList
                      items={
                        preferences?.preferred_roles ||
                        []
                      }
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Locations
                    </p>
                    <TagList
                      items={
                        preferences?.preferred_locations ||
                        []
                      }
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Work style
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Zap className="size-3.5" />
                        </span>
                        <span className="text-sm font-semibold">
                          {preferences?.remote_only
                            ? "Remote only"
                            : "Flexible"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Employment
                      </p>
                      <div className="mt-2">
                        <TagList
                          items={
                            preferences?.employment_types ||
                            []
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Match threshold */}
                  <div className="rounded-2xl border bg-muted/15 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold">
                          Match threshold
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Minimum relevance score for your
                          preferred opportunities.
                        </p>
                      </div>

                      <span className="text-lg font-bold text-primary">
                        {matchScore}
                      </span>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${matchScore}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
                      <span>Any match</span>
                      <span>Strong match</span>
                      <span>Excellent</span>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Minimum salary
                      </p>
                      <p className="mt-2 text-sm font-bold">
                        {preferences?.minimum_salary !=
                        null
                          ? `₹${preferences.minimum_salary.toLocaleString(
                              "en-IN",
                            )}`
                          : "No minimum"}
                      </p>
                    </div>

                    <div className="rounded-xl border p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        Countries
                      </p>
                      <div className="mt-2">
                        <TagList
                          items={
                            preferences?.preferred_countries ||
                            []
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Matching intelligence */}
            <section className="ai-surface overflow-hidden rounded-2xl border">
              <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>

                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary">
                      JobPilot intelligence
                    </p>

                    <h2 className="mt-1 text-sm font-bold">
                      Your profile controls your job feed
                    </h2>

                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                      Your target role, skills, experience,
                      location and preferences influence job
                      matching and preparation recommendations.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                  className="self-start md:self-auto"
                >
                  Tune preferences
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>

              <div className="border-t bg-background/40 px-5 py-3 sm:px-6">
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Matching rule:
                  </span>{" "}
                  only your current organization is excluded.
                  Previous employers remain eligible.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

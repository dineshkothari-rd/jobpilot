import type { LearningPath } from "./learning/catalog.ts";

export type DayAction = { title: string; text: string; href: string; cta: string };
export type DayPreferences = Record<string, string>;

export function dayKeyValid(key: unknown): key is string {
  if (typeof key !== "string" || key.length > 300) return false;
  if (key === "/jobs") return true;
  if (key.startsWith("/learn/")) return /^\/learn\/[a-z0-9][a-z0-9-]{0,63}$/.test(key);
  if (/^\/practice\?session=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return true;
  return /^\/applications\?jobId=[a-zA-Z0-9_-]{1,200}$/.test(key);
}

export function parseDayPreferences(value: unknown): DayPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid daily plan.");
  const entries = Object.entries(value);
  if (entries.length > 50 || entries.some(([key, until]) => !dayKeyValid(key) || typeof until !== "string" || until.length > 40 || !Number.isFinite(Date.parse(until)))) throw new Error("Invalid daily plan.");
  return Object.fromEntries(entries) as DayPreferences;
}

export function updateDayPreference(previous: unknown, key: unknown, until: unknown, now: number): DayPreferences {
  if (!dayKeyValid(key)) throw new Error("Choose a supported suggestion.");
  if (until !== null && (typeof until !== "string" || until.length > 40 || !Number.isFinite(Date.parse(until)) || Date.parse(until) <= now || Date.parse(until) > now + 30 * 86400000)) throw new Error("Choose a future time within 30 days.");
  const preferences = Object.fromEntries(Object.entries(parseDayPreferences(previous)).filter(([, date]) => Date.parse(date) > now));
  if (until === null) delete preferences[key];
  else preferences[key] = new Date(until as string).toISOString();
  return parseDayPreferences(preferences);
}

export function splitDayActions(actions: DayAction[], preferences: DayPreferences, now: number) {
  const active: DayAction[] = [], deferred: DayAction[] = [];
  for (const action of actions) (Date.parse(preferences[action.href] || "") > now ? deferred : active).push(action);
  return { active, deferred };
}

export function homeDayActions(input: {
  needsSetup: boolean; hasResume: boolean | null; hasMatches: boolean; now: number;
  applications: { job_id: string; job_title?: string; status: string; follow_up_at: string | null; application_package?: { status: string } | null }[];
  continuations: DayAction[];
}): DayAction[] {
  if (input.needsSetup || input.hasResume === false) return [homeNextAction(input)];
  const due = input.applications.filter(a => !["saved", "offer", "rejected", "withdrawn"].includes(a.status) && a.follow_up_at && Date.parse(a.follow_up_at) <= input.now)
    .sort((a, b) => Date.parse(a.follow_up_at!) - Date.parse(b.follow_up_at!));
  const ready = input.applications.filter(a => a.status === "saved" && a.application_package?.status === "prepared");
  const actions = [
    ...due.map(a => ({ ...homeNextAction({ ...input, dueJobId: a.job_id }), title: `Follow up: ${a.job_title || "your application"}` })),
    ...ready.map(a => ({ ...homeNextAction({ ...input, readyJobId: a.job_id }), title: `Review & apply: ${a.job_title || "your prepared application"}` })),
    ...input.continuations,
    homeNextAction(input),
  ];
  return [...new Map(actions.map(action => [action.href, action])).values()];
}

export function homeNextAction(input: {
  needsSetup: boolean;
  hasResume: boolean | null;
  dueJobId?: string;
  readyJobId?: string;
  hasMatches: boolean;
}) {
  if (input.needsSetup) return { title: "Set up your job search", text: "Add your target role, location and job preferences. You only need to do this once.", href: "/profile", cta: "Complete profile" };
  if (input.hasResume === false) return { title: "Add your resume", text: "Upload your PDF and check the imported details before preparing applications.", href: "/resume", cta: "Upload resume" };
  if (input.dueJobId) return { title: "A follow-up is due", text: "Review the recorded application and send a follow-up if appropriate.", href: `/applications?jobId=${encodeURIComponent(input.dueJobId)}`, cta: "Review follow-up" };
  if (input.readyJobId) return { title: "Your next application is ready", text: "Check your resume and answers, complete the company form, then confirm your submission.", href: `/applications?jobId=${encodeURIComponent(input.readyJobId)}`, cta: "Review & apply" };
  if (input.hasMatches) return { title: "Explore your strongest matches", text: "Pick a role to review. We can help prepare your application when you’re ready.", href: "/jobs", cta: "Review job matches" };
  return { title: "Find your first job match", text: "Browse jobs matched to your profile. Save roles you like; saving is not an application.", href: "/jobs", cta: "Find jobs" };
}

// Only saved account progress supplies continuation links; visits never imply completion.
export function homeContinuations(learning: unknown, practice: unknown): DayAction[] {
  const actions: DayAction[] = [];
  const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const latest = (rows: unknown) => (Array.isArray(rows) ? rows.map(object) : [])
    .filter(row => typeof row.updated_at === "string" && Number.isFinite(Date.parse(row.updated_at)))
    .sort((a, b) => Date.parse(String(b.updated_at)) - Date.parse(String(a.updated_at)));
  const learn = object(learning);
  if (learn.storageReady === true) {
    for (const enrollment of latest(learn.enrollments)) {
      const path = typeof enrollment.path_id === "string" && Array.isArray(learn.paths) ? (learn.paths as LearningPath[]).find(path => path.id === enrollment.path_id && Array.isArray(path.lessons)) : undefined;
      if (!path || !Array.isArray(enrollment.completed) || enrollment.completed.some(id => typeof id !== "string" || !path.lessons.some(lesson => lesson.id === id))) continue;
      const completed = enrollment.completed;
      if (Array.isArray(learn.credentials) && learn.credentials.some(value => {
        const credential = object(value);
        return credential.kind === "jobpilot" && credential.path_id === path.id && credential.revoked_at === null;
      })) continue;
      if (path.lessons.every(lesson => completed.includes(lesson.id))) {
        actions.push({ title: "Finish your learning path", text: `${path.title} · All ${path.lessons.length} exercises saved. Review your project and knowledge check before requesting a completion record.`, href: `/learn/${path.id}`, cta: "Review learning path" });
        break;
      }
      const lesson = path.lessons.find(lesson => lesson.id === enrollment.selected_lesson);
      if (!lesson) continue;
      actions.push({ title: "Continue your learning", text: `${path.title} · ${lesson.title}. ${new Set(enrollment.completed).size}/${path.lessons.length} exercises saved.`, href: `/learn/${path.id}`, cta: "Continue lesson" });
      break;
    }
  }
  const practiceData = object(practice);
  if (practiceData.storageReady === true) {
    const session = latest(practiceData.sessions).find(row => row.status === "active" && typeof row.role === "string" && row.role.trim() && row.role.length <= 120 && typeof row.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id));
    if (session) actions.push({ title: "Pick up your interview practice", text: `${session.role} · An unfinished saved session is ready. Self-review is not an automatic readiness grade.`, href: `/practice?session=${session.id}`, cta: "Resume practice" });
  }
  return actions;
}

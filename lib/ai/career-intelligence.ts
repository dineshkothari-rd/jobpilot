import {
  calculateMatchScore,
  getResumeSkills,
  type MatchJob,
  type MatchPreferences,
  type MatchProfile,
  type ParsedResumeSkills,
} from "../matching/scorer.ts";

export type CareerProfile = {
  target_role: string | null;
  experience_years: number | null;
  location: string | null;
};

export type CareerPreferences = {
  preferred_roles: string[] | null;
  preferred_locations: string[] | null;
  remote_only: boolean | null;
  employment_types: string[] | null;
  minimum_salary: number | null;
  preferred_countries: string[] | null;
};

export type CareerResume = {
  file_name: string | null;
  parsed_data: CareerParsedResume | null;
};

export type CareerParsedResume = ParsedResumeSkills & {
  summary?: unknown;
  experience?: unknown;
  education?: unknown;
  projects?: unknown;
  achievements?: unknown;
};

export type CareerJob = MatchJob & {
  id: string;
  title: string | null;
  company_name: string | null;
  published_at: string | null;
};

export type CareerApplication = {
  id: string;
  job_id: string;
  status: string | null;
  follow_up_at: string | null;
};

export type CareerIntelligenceInput = {
  profile: CareerProfile | null;
  preferences: CareerPreferences | null;
  resume: CareerResume | null;
  jobs: CareerJob[];
  applications: CareerApplication[];
  savedJobCount: number;
};

export type ScoreDimension = {
  key: string;
  label: string;
  value: number | null;
  detail: string;
};

export type CareerScore = {
  value: number | null;
  label: string;
  explanation: string;
  breakdown: ScoreDimension[];
};

export type SkillInsight = {
  name: string;
  state: "strong" | "developing" | "missing" | "high-priority";
  demand: "High" | "Medium" | "Low";
  count: number;
  detail: string;
};

export type PrioritySkill = {
  name: string;
  priority: "High" | "Medium" | "Low";
  currentState: "Strong" | "Developing" | "Missing";
  why: string;
  suggestedAction: string;
};

export type RoadmapPhase = {
  range: string;
  title: string;
  focus: string;
  actions: string[];
};

export type NextBestAction = {
  title: string;
  why: string;
  href: string;
  cta: string;
};

export type ReadinessState = {
  key: string;
  label: string;
  status: "ready" | "attention" | "unavailable";
  detail: string;
  href?: string;
};

export type ProgressSignal = {
  label: string;
  value: string;
  detail: string;
};

export type MarketInsights = {
  status: "ready" | "insufficient" | "missing-target";
  sampleSize: number;
  methodology: string;
  topSkills: SkillInsight[];
  averageMatchScore: number | null;
};

export type CareerIntelligence = {
  targetRole: string | null;
  careerScore: CareerScore;
  skills: {
    strong: string[];
    developing: string[];
    missing: string[];
    highPriority: string[];
  };
  marketInsights: MarketInsights;
  prioritySkills: PrioritySkill[];
  roadmap: RoadmapPhase[];
  nextBestAction: NextBestAction;
  readiness: ReadinessState[];
  progress: ProgressSignal[];
  usefulLinks: { label: string; href: string; detail: string }[];
};

const MIN_MARKET_JOBS = 5;

const SKILL_TERMS = [
  "accessibility",
  "api",
  "aws",
  "azure",
  "css",
  "docker",
  "express",
  "firebase",
  "graphql",
  "html",
  "java",
  "javascript",
  "jest",
  "kubernetes",
  "mongodb",
  "next.js",
  "node.js",
  "performance",
  "playwright",
  "postgresql",
  "python",
  "react",
  "redux",
  "security",
  "sql",
  "system design",
  "tailwind css",
  "testing",
  "typescript",
] as const;

const aliases: Record<string, string[]> = {
  api: ["api", "apis", "rest", "rest api", "rest apis"],
  css: ["css", "css3"],
  html: ["html", "html5"],
  javascript: ["javascript", "js"],
  "next.js": ["next.js", "nextjs", "next js"],
  "node.js": ["node.js", "nodejs", "node js"],
  postgresql: ["postgresql", "postgres"],
  react: ["react", "react.js", "reactjs"],
  "tailwind css": ["tailwind css", "tailwind", "tailwindcss"],
  testing: ["testing", "test automation", "unit testing"],
  typescript: ["typescript", "ts"],
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];

const countItems = (value: unknown) =>
  Array.isArray(value) ? value.length : 0;

function normalize(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalSkill(skill: string) {
  const normalized = normalize(skill);

  for (const [canonical, options] of Object.entries(aliases)) {
    if (options.some((option) => normalize(option) === normalized)) return canonical;
  }

  return normalized;
}

function includesTerm(haystack: string, needle: string) {
  const source = normalize(haystack);
  const term = normalize(needle);
  if (!source || !term) return false;
  return source.includes(term) || term.split(" ").every((word) => source.includes(word));
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(canonicalSkill).filter(Boolean)));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getTargetRole(profile: CareerProfile | null, preferences: CareerPreferences | null) {
  return text(profile?.target_role) || strings(preferences?.preferred_roles)[0] || null;
}

function resumeText(resume: CareerResume | null, resumeSkills: string[]) {
  const parsed = resume?.parsed_data;
  return [
    parsed?.summary,
    ...resumeSkills,
    ...strings(parsed?.achievements),
  ].map(text).join(" ");
}

function resumeStrength(resume: CareerResume | null, resumeSkills: string[]) {
  if (!resume?.parsed_data) return null;

  const parsed = resume.parsed_data;
  return clamp(
    (text(parsed.summary) ? 20 : 0) +
      Math.min(30, resumeSkills.length * 4) +
      Math.min(25, countItems(parsed.experience) * 9) +
      Math.min(10, countItems(parsed.education) * 10) +
      Math.min(10, countItems(parsed.projects) * 5) +
      Math.min(5, strings(parsed.achievements).length * 2),
  );
}

function profileCompleteness(profile: CareerProfile | null) {
  if (!profile) return 0;
  return clamp(
    (text(profile.target_role) ? 40 : 0) +
      (profile.experience_years != null ? 30 : 0) +
      (text(profile.location) ? 30 : 0),
  );
}

function roleAlignment(targetRole: string | null, resume: CareerResume | null, resumeSkills: string[]) {
  if (!targetRole || !resume?.parsed_data) return null;

  const roleTokens = normalize(targetRole)
    .split(" ")
    .filter((word) => word.length > 2);

  if (!roleTokens.length) return 60;

  const source = resumeText(resume, resumeSkills);
  const matched = roleTokens.filter((word) => includesTerm(source, word)).length;

  return clamp(45 + (matched / roleTokens.length) * 45 + Math.min(10, resumeSkills.length));
}

function relevantJobs(targetRole: string | null, preferences: CareerPreferences | null, jobs: CareerJob[]) {
  if (!targetRole) return [];

  const roles = unique([targetRole, ...strings(preferences?.preferred_roles)]);
  const roleTokens = roles.flatMap((role) =>
    normalize(role).split(" ").filter((token) => token.length > 2 && !["senior", "junior", "lead", "manager", "engineer", "developer", "specialist", "associate"].includes(token)),
  );

  return jobs.filter((job) => {
    const source = `${text(job.title)} ${text(job.description)} ${strings(job.skills).join(" ")}`;
    return roles.some((role) => includesTerm(source, role)) ||
      roleTokens.some((token) => includesTerm(source, token));
  });
}

function marketSkillCounts(jobs: CareerJob[]) {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    const source = `${text(job.title)} ${text(job.description)} ${strings(job.skills).join(" ")}`;
    const found = unique([
      ...strings(job.skills),
      ...SKILL_TERMS.filter((skill) => includesTerm(source, skill)),
    ]);

    for (const skill of found) {
      counts.set(skill, (counts.get(skill) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);
}

function demand(count: number, sampleSize: number): "High" | "Medium" | "Low" {
  if (count >= Math.max(3, Math.ceil(sampleSize * 0.35))) return "High";
  if (count >= 2) return "Medium";
  return "Low";
}

function skillState(skill: string, resumeSkills: string[], count: number, sampleSize: number) {
  const hasSkill = resumeSkills.some((item) => {
    const current = canonicalSkill(item);
    return current === skill || current.includes(skill) || skill.includes(current);
  });
  const demandLevel = demand(count, sampleSize);

  if (hasSkill && demandLevel === "High") return "strong";
  if (hasSkill) return "developing";
  if (demandLevel === "High") return "high-priority";
  return "missing";
}

function buildMarketInsights(
  targetRole: string | null,
  profile: CareerProfile | null,
  preferences: CareerPreferences | null,
  resumeSkills: string[],
  jobs: CareerJob[],
): MarketInsights {
  if (!targetRole) {
    return {
      status: "missing-target",
      sampleSize: 0,
      methodology: "Market intelligence needs a configured target role.",
      topSkills: [],
      averageMatchScore: null,
    };
  }

  const relevant = relevantJobs(targetRole, preferences, jobs);
  const sample = relevant.slice(0, 30);

  if (sample.length < MIN_MARKET_JOBS) {
    return {
      status: "insufficient",
      sampleSize: sample.length,
      methodology:
        "Not enough stored Parth Careers jobs match the target role yet. Discover more jobs to improve this analysis.",
      topSkills: [],
      averageMatchScore: null,
    };
  }

  const matchProfile: MatchProfile = {
    target_role: targetRole,
    experience_years: profile?.experience_years ?? null,
    location: profile?.location ?? null,
    skills: resumeSkills,
  };
  const matchPreferences: MatchPreferences = {
    preferred_roles: strings(preferences?.preferred_roles),
    preferred_locations: strings(preferences?.preferred_locations),
    remote_only: preferences?.remote_only ?? false,
    employment_types: strings(preferences?.employment_types),
    minimum_salary: preferences?.minimum_salary ?? null,
    preferred_countries: strings(preferences?.preferred_countries),
  };
  const scores = sample.map((job) => calculateMatchScore(job, matchProfile, matchPreferences).score);
  const averageMatchScore = clamp(scores.reduce((total, score) => total + score, 0) / scores.length);

  return {
    status: "ready",
    sampleSize: sample.length,
    methodology:
      "Derived from currently stored Parth Careers jobs that match the target role and preference signals.",
    averageMatchScore,
    topSkills: marketSkillCounts(sample).map(([name, count]) => {
      const state = skillState(name, resumeSkills, count, sample.length);
      return {
        name,
        count,
        state,
        demand: demand(count, sample.length),
        detail: `${count} of ${sample.length} relevant stored jobs mention this skill.`,
      };
    }),
  };
}

function buildPrioritySkills(market: MarketInsights) {
  return market.topSkills
    .filter((skill) => skill.state === "high-priority" || skill.state === "missing")
    .slice(0, 5)
    .map((skill): PrioritySkill => ({
      name: skill.name,
      priority: skill.state === "high-priority" ? "High" : skill.demand,
      currentState: skill.state === "high-priority" ? "Missing" : "Missing",
      why: `${skill.detail} Your resume skills do not currently support it.`,
      suggestedAction: `Build one honest project, bullet, or interview story around ${skill.name} only if you have real experience to back it up.`,
    }));
}

function buildRoadmap(prioritySkills: PrioritySkill[], targetRole: string | null) {
  const skills = prioritySkills.map((skill) => skill.name);
  const first = skills[0] || "your strongest target-role gap";
  const second = skills[1] || "role-specific project evidence";
  const third = skills[2] || "interview communication";
  const role = targetRole || "your target role";

  return [
    {
      range: "0-30 days",
      title: "Foundation",
      focus: `Tighten the base for ${role}.`,
      actions: [
        `Review fundamentals for ${first}.`,
        "Update the resume only with skills and outcomes you can defend.",
        "Save or shortlist jobs that clearly match your target role.",
      ],
    },
    {
      range: "31-60 days",
      title: "Application readiness",
      focus: "Turn gaps into application evidence.",
      actions: [
        `Create or refine one resume-backed story involving ${second}.`,
        "Use Job Preparation on high-match roles before applying.",
        "Apply to roles where the strongest resume-supported skills are visible in the posting.",
      ],
    },
    {
      range: "61-90 days",
      title: "Interview readiness",
      focus: "Practice depth, trade-offs, and concise answers.",
      actions: [
        `Practice explaining ${third} with examples, trade-offs, and limits.`,
        "Use Interview Studio for timed answers on saved or applied jobs.",
        "Review application notes and follow-ups weekly.",
      ],
    },
  ];
}

function buildReadiness(
  targetRole: string | null,
  profile: CareerProfile | null,
  resume: CareerResume | null,
  resumeSkills: string[],
  market: MarketInsights,
  applications: CareerApplication[],
): ReadinessState[] {
  return [
    {
      key: "target-role",
      label: "Target role",
      status: targetRole ? "ready" : "attention",
      detail: targetRole ? `Focused on ${targetRole}.` : "Choose a target role to unlock role alignment.",
      href: "/profile",
    },
    {
      key: "profile",
      label: "Profile",
      status: profileCompleteness(profile) >= 70 ? "ready" : "attention",
      detail: `${profileCompleteness(profile)}% of the core profile signals are available.`,
      href: "/profile",
    },
    {
      key: "resume",
      label: "Primary resume",
      status: resume?.parsed_data ? "ready" : "attention",
      detail: resume?.parsed_data ? `${resumeSkills.length} resume skills detected.` : "Upload a primary resume to calculate skill gaps.",
      href: "/resume",
    },
    {
      key: "market",
      label: "Market data",
      status: market.status === "ready" ? "ready" : market.status === "insufficient" ? "attention" : "unavailable",
      detail: market.methodology,
      href: "/jobs",
    },
    {
      key: "applications",
      label: "Applications",
      status: applications.length ? "ready" : "attention",
      detail: applications.length ? `${applications.length} application${applications.length === 1 ? "" : "s"} tracked.` : "No applications are tracked yet.",
      href: "/applications",
    },
    {
      key: "interview-practice",
      label: "Interview practice",
      status: "unavailable",
      detail: "Interview Studio sessions are not persisted yet, so practice history is not counted.",
      href: "/jobs",
    },
  ];
}

function buildNextAction(
  targetRole: string | null,
  resume: CareerResume | null,
  resumeSkills: string[],
  market: MarketInsights,
  prioritySkills: PrioritySkill[],
  applications: CareerApplication[],
) {
  if (!targetRole) {
    return {
      title: "Choose your target role",
      why: "Career Intelligence needs a target role before it can judge alignment or gaps.",
      href: "/profile",
      cta: "Update profile",
    };
  }

  if (!resume?.parsed_data) {
    return {
      title: "Upload a primary resume",
      why: "Skill gaps and readiness must be grounded in your actual resume.",
      href: "/resume",
      cta: "Upload resume",
    };
  }

  if (!resumeSkills.length) {
    return {
      title: "Add resume skills",
      why: "Your primary resume is available, but no usable skill list was detected.",
      href: "/resume",
      cta: "Review resume",
    };
  }

  if (market.status !== "ready") {
    return {
      title: "Discover more target-role jobs",
      why: "Market alignment needs more stored jobs that match your target role.",
      href: "/jobs",
      cta: "Discover jobs",
    };
  }

  if (prioritySkills.length) {
    const skill = prioritySkills[0];
    return {
      title: `Close the ${skill.name} gap`,
      why: skill.why,
      href: "/jobs",
      cta: "Find relevant jobs",
    };
  }

  if (!applications.length) {
    return {
      title: "Apply to high-match jobs",
      why: "Your profile and resume have enough signal. The next unlock is real application momentum.",
      href: "/jobs",
      cta: "Review matches",
    };
  }

  return {
    title: "Practice for active applications",
    why: "You have applications in motion; interview practice is the highest leverage next step.",
    href: "/applications",
    cta: "Open applications",
  };
}

function applicationReadiness(resume: CareerResume | null, targetRole: string | null, applications: CareerApplication[]) {
  if (!resume?.parsed_data || !targetRole) return null;
  if (applications.some((item) => item.status === "offer" || item.status === "interview")) return 90;
  if (applications.length) return 80;
  return 65;
}

function buildScore(
  targetRole: string | null,
  profile: CareerProfile | null,
  resume: CareerResume | null,
  resumeSkills: string[],
  market: MarketInsights,
  applications: CareerApplication[],
): CareerScore {
  const dimensions: ScoreDimension[] = [
    {
      key: "resume",
      label: "Resume",
      value: resumeStrength(resume, resumeSkills),
      detail: "Based on summary, skills, experience, education, projects, and achievements present in the primary resume.",
    },
    {
      key: "role",
      label: "Role alignment",
      value: roleAlignment(targetRole, resume, resumeSkills),
      detail: "Based on target-role terms and resume-supported evidence.",
    },
    {
      key: "skills",
      label: "Skill coverage",
      value: market.status === "ready" && market.topSkills.length
        ? clamp(
            market.topSkills.filter((skill) => skill.state === "strong" || skill.state === "developing").length /
              market.topSkills.length * 100,
          )
        : null,
      detail: "Based on overlap between resume skills and recurring skills in stored relevant jobs.",
    },
    {
      key: "market",
      label: "Market alignment",
      value: market.averageMatchScore,
      detail: "Average match score across the relevant stored job sample.",
    },
    {
      key: "application",
      label: "Application readiness",
      value: applicationReadiness(resume, targetRole, applications),
      detail: "Based on whether a target role, primary resume, and application momentum exist.",
    },
  ];

  if (!targetRole || !resume?.parsed_data) {
    return {
      value: null,
      label: "Setup needed",
      explanation: "Career Score is withheld until a target role and primary resume exist.",
      breakdown: dimensions,
    };
  }

  const weighted = dimensions
    .map((dimension) => ({
      ...dimension,
      weight: dimension.key === "skills" ? 25 : dimension.key === "resume" || dimension.key === "role" || dimension.key === "market" ? 20 : 15,
    }))
    .filter((dimension) => dimension.value != null);

  const weightTotal = weighted.reduce((total, item) => total + item.weight, 0);
  const value = weighted.length
    ? clamp(weighted.reduce((total, item) => total + (item.value as number) * item.weight, 0) / weightTotal)
    : null;

  return {
    value,
    label: value == null ? "Unavailable" : value >= 80 ? "Strong" : value >= 65 ? "Developing" : "Needs focus",
    explanation:
      "Weighted from available resume, role, skill, market, and application signals. Unavailable signals are not treated as zero.",
    breakdown: dimensions,
  };
}

function progressSignals(
  profile: CareerProfile | null,
  resume: CareerResume | null,
  applications: CareerApplication[],
  savedJobCount: number,
) {
  return [
    {
      label: "Profile completeness",
      value: `${profileCompleteness(profile)}%`,
      detail: "Target role, experience, and location.",
    },
    {
      label: "Resume completeness",
      value: resume?.parsed_data ? `${resumeStrength(resume, getResumeSkills(resume.parsed_data)) ?? 0}%` : "Missing",
      detail: resume?.file_name || "No primary resume.",
    },
    {
      label: "Saved jobs",
      value: String(savedJobCount),
      detail: "Shortlisted opportunities.",
    },
    {
      label: "Applications",
      value: String(applications.length),
      detail: "Tracked pipeline entries.",
    },
    {
      label: "Roadmap progress",
      value: "Planned",
      detail: "Roadmap completion is recommended only; no new tracking schema was added.",
    },
  ];
}

export function generateCareerIntelligence(input: CareerIntelligenceInput): CareerIntelligence {
  const targetRole = getTargetRole(input.profile, input.preferences);
  const resumeSkills = unique(getResumeSkills(input.resume?.parsed_data || null));
  const marketInsights = buildMarketInsights(
    targetRole,
    input.profile,
    input.preferences,
    resumeSkills,
    input.jobs,
  );
  const prioritySkills = buildPrioritySkills(marketInsights);
  const roadmap = buildRoadmap(prioritySkills, targetRole);
  const nextBestAction = buildNextAction(
    targetRole,
    input.resume,
    resumeSkills,
    marketInsights,
    prioritySkills,
    input.applications,
  );

  return {
    targetRole,
    careerScore: buildScore(
      targetRole,
      input.profile,
      input.resume,
      resumeSkills,
      marketInsights,
      input.applications,
    ),
    skills: {
      strong: marketInsights.topSkills.filter((skill) => skill.state === "strong").map((skill) => skill.name),
      developing: marketInsights.topSkills.filter((skill) => skill.state === "developing").map((skill) => skill.name),
      missing: marketInsights.topSkills.filter((skill) => skill.state === "missing").map((skill) => skill.name),
      highPriority: marketInsights.topSkills.filter((skill) => skill.state === "high-priority").map((skill) => skill.name),
    },
    marketInsights,
    prioritySkills,
    roadmap,
    nextBestAction,
    readiness: buildReadiness(
      targetRole,
      input.profile,
      input.resume,
      resumeSkills,
      marketInsights,
      input.applications,
    ),
    progress: progressSignals(
      input.profile,
      input.resume,
      input.applications,
      input.savedJobCount,
    ),
    usefulLinks: [
      { label: "Discover jobs", href: "/jobs", detail: "Improve market data and find high-match roles." },
      { label: "Resume", href: "/resume", detail: "Keep the evidence behind your score accurate." },
      { label: "Applications", href: "/applications", detail: "Track follow-ups and active opportunities." },
      { label: "Saved jobs", href: "/saved-jobs", detail: "Prepare against roles you already shortlisted." },
      { label: "Profile", href: "/profile", detail: "Tune target role and preferences." },
    ],
  };
}

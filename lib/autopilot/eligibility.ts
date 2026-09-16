export type AutopilotPreferences = {
  enabled: boolean;
  targetRoles: string[];
  locations: string[];
  workplaceModes: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  workAuthorization: string;
  noticePeriod: string;
  preferredCompanies: string[];
  blockedCompanies: string[];
  industries: string[];
  dailyLimit: number;
  matchThreshold: number;
  autoSubmit: boolean;
};

export type EligibilityInput = {
  company: string;
  matchScore: number;
  applicationUrl: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  alreadySubmitted: boolean;
  profileComplete: boolean;
  requiredAnswersKnown: boolean;
  locationMatches: boolean;
  workplaceMatches: boolean;
  termsAllowAutomation: boolean;
  requiresManualStep: boolean;
  submitIntegration: boolean;
  appliedToday: number;
};

export type EligibilityDecision = {
  state: "eligible_automatic" | "eligible_assisted" | "skipped" | "needs_review";
  reason: string;
};

const normalized = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

function isSafeApplicationUrl(value: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      host !== "localhost" &&
      !host.endsWith(".local") &&
      !privateIpv4.test(host);
  } catch {
    return false;
  }
}

export function evaluateAutoApply(
  job: EligibilityInput,
  preferences: AutopilotPreferences,
): EligibilityDecision {
  if (!preferences.enabled) {
    return { state: "skipped", reason: "Autopilot is paused." };
  }
  if (preferences.blockedCompanies.some(
    (company) => normalized(company) === normalized(job.company),
  )) {
    return { state: "skipped", reason: "Company is on your blocked list." };
  }
  if (job.alreadySubmitted) {
    return { state: "skipped", reason: "An application was already submitted for this job." };
  }
  if (job.matchScore < preferences.matchThreshold) {
    return {
      state: "skipped",
      reason: `Match score ${job.matchScore}% is below your ${preferences.matchThreshold}% threshold.`,
    };
  }
  if (job.appliedToday >= preferences.dailyLimit) {
    return {
      state: "skipped",
      reason: `Daily limit of ${preferences.dailyLimit} applications reached.`,
    };
  }
  if (!job.profileComplete) {
    return {
      state: "needs_review",
      reason: "Critical profile or resume details are missing.",
    };
  }
  if (!job.requiredAnswersKnown) {
    return {
      state: "needs_review",
      reason: "Work authorization or notice period needs confirmation.",
    };
  }
  if (!job.locationMatches) {
    return {
      state: "skipped",
      reason: "The job location conflicts with your Autopilot preferences.",
    };
  }
  if (!job.workplaceMatches) {
    return {
      state: "skipped",
      reason: "The workplace mode conflicts with your Autopilot preferences.",
    };
  }
  if (!isSafeApplicationUrl(job.applicationUrl)) {
    return { state: "skipped", reason: "The application link is missing or unsafe." };
  }
  if (
    preferences.salaryMin !== null &&
    job.salaryMax !== null &&
    job.salaryMax < preferences.salaryMin
  ) {
    return {
      state: "skipped",
      reason: "The listed salary conflicts with your minimum.",
    };
  }
  if (!job.termsAllowAutomation || job.requiresManualStep) {
    return {
      state: "needs_review",
      reason: "The source requires a manual login, captcha, or human submission.",
    };
  }
  if (preferences.autoSubmit && job.submitIntegration) {
    return {
      state: "eligible_automatic",
      reason: "All rules passed and this source supports confirmed submission.",
    };
  }

  return {
    state: "eligible_assisted",
    reason: preferences.autoSubmit
      ? "Application package is ready; this source has no confirmed submit integration."
      : "Application package is ready for your review and submission.",
  };
}

export type MatchJob = {
  title: string | null;
  description: string | null;
  location: string | null;
  country: string | null;
  employment_type: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[] | null;
};

export type MatchProfile = {
  target_role: string | null;
  experience_years: number | null;
  location: string | null;
  skills: string[];
};

export type MatchPreferences = {
  preferred_roles: string[];
  preferred_locations: string[];
  remote_only: boolean;
  employment_types: string[];
  minimum_salary: number | null;
  preferred_countries: string[];
};

export type MatchBreakdown = {
  role: number;
  skills: number;
  location: number;
  seniority: number;
  salary: number;
  country: number;
};

export type MatchResult = {
  score: number;
  breakdown: MatchBreakdown;
};

export type ParsedResumeSkills = {
  skills?: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    tools?: string[];
    other?: string[];
  };
};

export function getResumeSkills(parsedData: ParsedResumeSkills | null) {
  if (!parsedData?.skills || typeof parsedData.skills !== "object") return [];

  return Array.from(new Set(
    Object.values(parsedData.skills)
      .filter(Array.isArray)
      .flat()
      .filter((skill): skill is string => typeof skill === "string" && Boolean(skill.trim())),
  ));
}

const STOP_WORDS = new Set([
  "and",
  "or",
  "the",
  "for",
  "with",
  "of",
  "in",
  "to",
  "a",
  "an",
  "developer",
  "engineer",
  "development",
  "engineering",
]);

function normalize(value: unknown) {
  return (typeof value === "string" ? value : "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function tokenize(value: string | null | undefined) {
  return normalize(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        token.length > 1 &&
        !STOP_WORDS.has(token),
    );
}

function containsTerm(
  text: string,
  term: string,
) {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);

  if (!normalizedTerm) {
    return false;
  }

  return (
    normalizedText === normalizedTerm ||
    normalizedText.includes(
      ` ${normalizedTerm} `,
    ) ||
    normalizedText.startsWith(
      `${normalizedTerm} `,
    ) ||
    normalizedText.endsWith(
      ` ${normalizedTerm}`,
    ) ||
    normalizedText.includes(
      normalizedTerm,
    )
  );
}

function calculateRoleScore(
  job: MatchJob,
  profile: MatchProfile,
  preferences: MatchPreferences,
) {
  const title = normalize(job.title);
  const preferredRoles = stringList(preferences.preferred_roles)
    .map(normalize)
    .filter(Boolean);

  const targetRole = normalize(
    profile.target_role,
  );

  let bestScore = 0;

  for (const role of preferredRoles) {
    if (title === role) {
      bestScore = Math.max(bestScore, 30);
      continue;
    }

    if (title.includes(role)) {
      bestScore = Math.max(bestScore, 27);
      continue;
    }

    const roleTokens = tokenize(role);
    const matchedTokens = roleTokens.filter(
      (token) => containsTerm(title, token),
    );

    if (roleTokens.length > 0) {
      const ratio =
        matchedTokens.length / roleTokens.length;

      bestScore = Math.max(
        bestScore,
        Math.round(ratio * 24),
      );
    }
  }

  if (targetRole) {
    if (title === targetRole) {
      bestScore = Math.max(bestScore, 30);
    } else if (title.includes(targetRole)) {
      bestScore = Math.max(bestScore, 27);
    }
  }

  return Math.min(30, bestScore);
}

function calculateSkillsScore(
  job: MatchJob,
  profile: MatchProfile,
) {
  const jobText = [
    job.title || "",
    job.description || "",
    ...stringList(job.skills),
  ].join(" ");

  const resumeSkills = profile.skills
    .flatMap(tokenize);

  const uniqueSkills = Array.from(
    new Set(resumeSkills),
  );

  if (uniqueSkills.length === 0) {
    return 0;
  }

  const matched = uniqueSkills.filter(
    (skill) => containsTerm(jobText, skill),
  );

  const ratio =
    matched.length / uniqueSkills.length;

  return Math.min(
    30,
    Math.round(ratio * 30),
  );
}

function isRemoteJob(job: MatchJob) {
  const text = normalize(
    [
      job.location || "",
      job.description || "",
      ...stringList(job.skills),
    ].join(" "),
  );

  return (
    text.includes("remote") ||
    text.includes("worldwide") ||
    text.includes("work from home") ||
    text.includes("distributed")
  );
}

function calculateLocationScore(
  job: MatchJob,
  profile: MatchProfile,
  preferences: MatchPreferences,
) {
  const jobLocation = normalize(
    job.location,
  );

  const preferredLocations =
    stringList(preferences.preferred_locations).map(normalize);

  if (
    preferences.remote_only &&
    isRemoteJob(job)
  ) {
    return 15;
  }

  if (
    preferences.remote_only &&
    !isRemoteJob(job)
  ) {
    return 0;
  }

  for (const location of preferredLocations) {
    if (
      location &&
      jobLocation.includes(location)
    ) {
      return 15;
    }
  }

  const profileLocation = normalize(
    profile.location,
  );

  if (
    profileLocation &&
    jobLocation.includes(profileLocation)
  ) {
    return 15;
  }

  if (isRemoteJob(job)) {
    return 12;
  }

  return 5;
}

function calculateSeniorityScore(
  job: MatchJob,
  profile: MatchProfile,
) {
  const seniority = normalize(
    job.seniority,
  );

  if (!seniority) {
    return 5;
  }

  const experience =
    profile.experience_years ?? 0;

  if (
    seniority.includes("senior") ||
    seniority.includes("lead") ||
    seniority.includes("staff")
  ) {
    if (experience >= 4) {
      return 10;
    }

    if (experience >= 3) {
      return 7;
    }

    return 3;
  }

  if (
    seniority.includes("mid") ||
    seniority.includes("intermediate")
  ) {
    if (experience >= 2) {
      return 10;
    }

    return 7;
  }

  if (
    seniority.includes("junior") ||
    seniority.includes("entry")
  ) {
    if (experience <= 2) {
      return 10;
    }

    return 6;
  }

  return 5;
}

function calculateSalaryScore(
  job: MatchJob,
  preferences: MatchPreferences,
) {
  const minimumSalary =
    preferences.minimum_salary;

  if (minimumSalary == null) {
    return 10;
  }

  const jobMaximum =
    job.salary_max ??
    job.salary_min;

  if (jobMaximum == null) {
    return 5;
  }

  if (jobMaximum >= minimumSalary) {
    return 10;
  }

  if (
    jobMaximum >=
    minimumSalary * 0.8
  ) {
    return 6;
  }

  return 0;
}

function calculateCountryScore(
  job: MatchJob,
  preferences: MatchPreferences,
) {
  const jobCountry = normalize(
    job.country,
  );

  const preferredCountries =
    stringList(preferences.preferred_countries).map(
      normalize,
    );

  if (!jobCountry) {
    return 2;
  }

  for (const country of preferredCountries) {
    if (
      country &&
      (
        jobCountry.includes(country) ||
        country.includes(jobCountry)
      )
    ) {
      return 5;
    }
  }

  if (
    preferredCountries.includes("india") &&
    (
      jobCountry === "in" ||
      jobCountry.includes("india")
    )
  ) {
    return 5;
  }

  return 2;
}

export function calculateMatchScore(
  job: MatchJob,
  profile: MatchProfile,
  preferences: MatchPreferences,
): MatchResult {
  const breakdown: MatchBreakdown = {
    role: calculateRoleScore(
      job,
      profile,
      preferences,
    ),
    skills: calculateSkillsScore(
      job,
      profile,
    ),
    location: calculateLocationScore(
      job,
      profile,
      preferences,
    ),
    seniority: calculateSeniorityScore(
      job,
      profile,
    ),
    salary: calculateSalaryScore(
      job,
      preferences,
    ),
    country: calculateCountryScore(
      job,
      preferences,
    ),
  };

  const score =
    breakdown.role +
    breakdown.skills +
    breakdown.location +
    breakdown.seniority +
    breakdown.salary +
    breakdown.country;

  return {
    score: Math.min(100, score),
    breakdown,
  };
}

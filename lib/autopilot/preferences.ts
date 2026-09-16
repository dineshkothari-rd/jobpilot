import type { AutopilotPreferences } from "./eligibility";

type UnknownRow = Record<string, unknown> | null;

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const stringList = (value: unknown, limit = 50) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .map(text)
            .filter(Boolean)
            .map((item) => item.slice(0, 120)),
        ),
      ].slice(0, limit)
    : [];

const optionalNumber = (value: unknown) => {
  if (value === null || value === "" || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
};

const boundedInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.round(number)))
    : fallback;
};

export class InvalidAutopilotPreferencesError extends Error {}

const storedNumber = (value: unknown) => {
  const number = optionalNumber(value);
  return number !== null && Number.isNaN(number) ? null : number;
};

export function preferencesFromRow(
  row: UnknownRow,
  fallback?: UnknownRow,
): AutopilotPreferences {
  const targetRoles = stringList(row?.target_roles, 20);
  const locations = stringList(row?.locations, 20);

  return {
    enabled: row?.enabled === true,
    targetRoles: targetRoles.length
      ? targetRoles
      : stringList(fallback?.preferred_roles, 20),
    locations: locations.length
      ? locations
      : stringList(fallback?.preferred_locations, 20),
    workplaceModes: stringList(row?.workplace_modes, 3),
    salaryMin: storedNumber(row?.salary_min ?? fallback?.minimum_salary),
    salaryMax: storedNumber(row?.salary_max),
    workAuthorization: text(row?.work_authorization),
    noticePeriod: text(row?.notice_period),
    preferredCompanies: stringList(row?.preferred_companies),
    blockedCompanies: stringList(row?.blocked_companies),
    industries: stringList(row?.industries, 30),
    dailyLimit: boundedInteger(row?.daily_limit, 5, 1, 50),
    matchThreshold: boundedInteger(
      row?.match_threshold ?? fallback?.minimum_match_score,
      70,
      0,
      100,
    ),
    autoSubmit: row?.auto_submit === true,
  };
}

export function parsePreferences(input: Record<string, unknown>): AutopilotPreferences {
  const salaryMin = optionalNumber(input.salaryMin);
  const salaryMax = optionalNumber(input.salaryMax);
  const allowedWorkplaceModes = new Set(["remote", "hybrid", "on-site"]);

  if (
    Number.isNaN(salaryMin) ||
    Number.isNaN(salaryMax) ||
    (salaryMin !== null && salaryMin < 0) ||
    (salaryMax !== null && salaryMax < 0) ||
    (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin)
  ) {
    throw new InvalidAutopilotPreferencesError(
      "Salary range must contain valid non-negative values, with maximum salary above minimum salary.",
    );
  }

  return {
    enabled: input.enabled === true,
    targetRoles: stringList(input.targetRoles, 20),
    locations: stringList(input.locations, 20),
    workplaceModes: stringList(input.workplaceModes)
      .filter((mode) => allowedWorkplaceModes.has(mode))
      .slice(0, 3),
    salaryMin,
    salaryMax,
    workAuthorization: text(input.workAuthorization).slice(0, 300),
    noticePeriod: text(input.noticePeriod).slice(0, 100),
    preferredCompanies: stringList(input.preferredCompanies),
    blockedCompanies: stringList(input.blockedCompanies),
    industries: stringList(input.industries, 30),
    dailyLimit: boundedInteger(input.dailyLimit, 5, 1, 50),
    matchThreshold: boundedInteger(input.matchThreshold, 70, 0, 100),
    autoSubmit: input.autoSubmit === true,
  };
}

export function preferencesToRow(
  preferences: AutopilotPreferences,
  userId: string,
) {
  return {
    user_id: userId,
    enabled: preferences.enabled,
    target_roles: preferences.targetRoles,
    locations: preferences.locations,
    workplace_modes: preferences.workplaceModes,
    salary_min: preferences.salaryMin,
    salary_max: preferences.salaryMax,
    work_authorization: preferences.workAuthorization,
    notice_period: preferences.noticePeriod,
    preferred_companies: preferences.preferredCompanies,
    blocked_companies: preferences.blockedCompanies,
    industries: preferences.industries,
    daily_limit: preferences.dailyLimit,
    match_threshold: preferences.matchThreshold,
    auto_submit: preferences.autoSubmit,
    updated_at: new Date().toISOString(),
  };
}

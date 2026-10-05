export type FollowedCompanySummary = {
  companySlug: string;
  companyName: string;
  notifyNewOpenings: boolean;
  followedAt: string;
  totalOpenings: number;
  newOpeningsLast7Days: number;
};

export type CompanyFollowStatus = {
  isFollowing: boolean;
  followerCount: number;
  notifyNewOpenings: boolean;
};

/**
 * Validates and sanitizes a company slug.
 */
export function validateCompanySlug(slug: unknown): string {
  if (typeof slug !== "string") {
    throw new Error("Company slug must be a string.");
  }
  const clean = slug.trim().toLowerCase();
  if (!clean || clean.length > 120) {
    throw new Error("Company slug must be between 1 and 120 characters.");
  }
  if (!/^[a-z0-9-]+$/.test(clean)) {
    throw new Error("Company slug contains invalid characters.");
  }
  return clean;
}

/**
 * Checks if a job posting date is within the new-opening window (default: 7 days).
 */
export function isNewOpening(
  publishedAt: string | null | undefined,
  thresholdDays = 7,
  referenceDate = new Date(),
): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt);
  if (isNaN(published.getTime())) return false;

  const diffMs = referenceDate.getTime() - published.getTime();
  if (diffMs < 0) return true; // Scheduled / fresh today
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= thresholdDays;
}

/**
 * Computes active openings and fresh alerts from a company's job list.
 */
export function computeCompanyAlerts(
  openings: Array<{ published_at?: string | null }>,
  referenceDate = new Date(),
): { totalOpenings: number; newOpeningsLast7Days: number } {
  let newCount = 0;
  for (const job of openings) {
    if (isNewOpening(job.published_at, 7, referenceDate)) {
      newCount += 1;
    }
  }
  return {
    totalOpenings: openings.length,
    newOpeningsLast7Days: newCount,
  };
}

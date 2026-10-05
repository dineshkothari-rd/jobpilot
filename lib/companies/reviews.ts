export type EmploymentStatus = "current" | "former" | "interviewee";

export type CompanyReviewInput = {
  rating: number; // 1 to 5
  workLifeRating?: number; // 1 to 5
  growthRating?: number; // 1 to 5
  cultureRating?: number; // 1 to 5
  title: string;
  pros: string;
  cons: string;
  roleTitle: string;
  employmentStatus: EmploymentStatus;
};

export type CompanyReviewRecord = {
  id: string;
  user_id: string;
  company_slug: string;
  rating: number;
  work_life_rating: number | null;
  growth_rating: number | null;
  culture_rating: number | null;
  title: string;
  pros: string;
  cons: string;
  role_title: string;
  employment_status: EmploymentStatus;
  created_at: string;
  updated_at: string;
};

export type CompanyReviewSummary = {
  averageRating: number;
  totalReviews: number;
  workLifeAvg: number | null;
  growthAvg: number | null;
  cultureAvg: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export function validateRating(val: unknown, label = "Rating"): number {
  if (typeof val !== "number" || !Number.isInteger(val) || val < 1 || val > 5) {
    throw new Error(`${label} must be an integer between 1 and 5 stars.`);
  }
  return val;
}

export function validateReviewInput(raw: unknown): CompanyReviewInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Review data must be an object.");
  }
  const input = raw as Partial<CompanyReviewInput>;

  const rating = validateRating(input.rating, "Overall rating");
  const workLifeRating = input.workLifeRating != null ? validateRating(input.workLifeRating, "Work-life rating") : undefined;
  const growthRating = input.growthRating != null ? validateRating(input.growthRating, "Growth rating") : undefined;
  const cultureRating = input.cultureRating != null ? validateRating(input.cultureRating, "Culture rating") : undefined;

  if (typeof input.title !== "string" || input.title.trim().length < 3 || input.title.trim().length > 120) {
    throw new Error("Review title must be between 3 and 120 characters.");
  }

  if (typeof input.pros !== "string" || input.pros.trim().length < 10 || input.pros.trim().length > 1000) {
    throw new Error("Pros description must be between 10 and 1000 characters.");
  }

  if (typeof input.cons !== "string" || input.cons.trim().length < 10 || input.cons.trim().length > 1000) {
    throw new Error("Cons description must be between 10 and 1000 characters.");
  }

  if (typeof input.roleTitle !== "string" || input.roleTitle.trim().length < 2 || input.roleTitle.trim().length > 100) {
    throw new Error("Role title must be between 2 and 100 characters.");
  }

  const validStatuses: EmploymentStatus[] = ["current", "former", "interviewee"];
  if (!input.employmentStatus || !validStatuses.includes(input.employmentStatus)) {
    throw new Error("Employment status must be 'current', 'former', or 'interviewee'.");
  }

  return {
    rating,
    workLifeRating,
    growthRating,
    cultureRating,
    title: input.title.trim(),
    pros: input.pros.trim(),
    cons: input.cons.trim(),
    roleTitle: input.roleTitle.trim(),
    employmentStatus: input.employmentStatus,
  };
}

export function calculateReviewSummary(
  reviews: Array<{
    rating: number;
    work_life_rating?: number | null;
    growth_rating?: number | null;
    culture_rating?: number | null;
  }>,
): CompanyReviewSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!reviews || reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      workLifeAvg: null,
      growthAvg: null,
      cultureAvg: null,
      ratingDistribution: distribution,
    };
  }

  let totalRating = 0;
  let wlTotal = 0;
  let wlCount = 0;
  let growthTotal = 0;
  let growthCount = 0;
  let cultTotal = 0;
  let cultCount = 0;

  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] = (distribution[star] || 0) + 1;
    totalRating += r.rating;

    if (typeof r.work_life_rating === "number") {
      wlTotal += r.work_life_rating;
      wlCount += 1;
    }
    if (typeof r.growth_rating === "number") {
      growthTotal += r.growth_rating;
      growthCount += 1;
    }
    if (typeof r.culture_rating === "number") {
      cultTotal += r.culture_rating;
      cultCount += 1;
    }
  }

  const round1 = (num: number) => Math.round(num * 10) / 10;

  return {
    averageRating: round1(totalRating / reviews.length),
    totalReviews: reviews.length,
    workLifeAvg: wlCount > 0 ? round1(wlTotal / wlCount) : null,
    growthAvg: growthCount > 0 ? round1(growthTotal / growthCount) : null,
    cultureAvg: cultCount > 0 ? round1(cultTotal / cultCount) : null,
    ratingDistribution: distribution,
  };
}

export const meterNames = {
  autopilot: "Autopilot attempts",
  candidate_search: "Candidate search requests",
  interview_ai: "Interview AI actions",
  active_postings: "Open job postings",
} as const;
export type Meter = keyof typeof meterNames;
export type Allowance = {
  meter: Meter;
  limit: number;
  used: number;
  period: "utc_day" | "active";
};
export const remainingAllowance = (limit: number, used: number) =>
  Math.max(0, limit - used);

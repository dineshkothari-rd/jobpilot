export const applicationStatuses = [
  "saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && applicationStatuses.includes(value as ApplicationStatus);
}

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus) {
  if (from === to) return true;
  if (from === "saved") return to === "applied" || to === "withdrawn";
  return to !== "saved";
}

export function isSubmittedApplication(status: ApplicationStatus) {
  return status !== "saved" && status !== "withdrawn";
}

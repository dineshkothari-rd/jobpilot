export function isCurrentApplicationProgress(value: unknown, applicationUrl: string, now = Date.now()) {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.version === 1 && row.applicationUrl === applicationUrl && typeof row.openedAt === "number" &&
    Number.isFinite(row.openedAt) && row.openedAt <= now && now - row.openedAt < 24 * 60 * 60 * 1000;
}

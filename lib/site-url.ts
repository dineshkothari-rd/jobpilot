type Env = Record<string, string | undefined>;

const withProtocol = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`;

export function normalizeSiteUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;

  try {
    return new URL(withProtocol(value.trim())).origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(origin?: string | null, env: Env = process.env) {
  const explicit = normalizeSiteUrl(env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;

  const productionUrl = normalizeSiteUrl(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (productionUrl) return productionUrl;

  const vercelUrl = normalizeSiteUrl(env.NEXT_PUBLIC_VERCEL_URL || env.VERCEL_URL);
  if (vercelUrl && env.NEXT_PUBLIC_VERCEL_ENV !== "production") return vercelUrl;

  const requestOrigin = normalizeSiteUrl(origin);
  if (requestOrigin && !/localhost|127\.0\.0\.1/.test(new URL(requestOrigin).hostname)) return requestOrigin;

  if (env.NODE_ENV !== "production") return "http://localhost:3000";

  throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
}

export function safeInternalPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;

  try {
    const base = "https://jobpilot.local";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function getAuthCallbackUrl(next?: string | null, origin?: string | null, env?: Env) {
  const url = new URL("/auth/callback", getSiteUrl(origin, env));
  const safeNext = safeInternalPath(next);

  if (safeNext && !safeNext.startsWith("/auth/")) url.searchParams.set("next", safeNext);

  return url.toString();
}

export function getPasswordRecoveryUrl(origin?: string | null, env?: Env) {
  const url = new URL("/auth/callback", getSiteUrl(origin, env));
  url.searchParams.set("next", "/auth/update-password");
  return url.toString();
}

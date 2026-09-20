export const jobId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function canonicalJobUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) throw new Error("Enter a valid HTTPS job link.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a valid HTTPS job link."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || !host.includes(".") || host === "localhost" || host.endsWith(".local") || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":")) throw new Error("Use the public HTTPS link from the employer or job board.");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

export function parseManualJob(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Check the opportunity details.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["request_id", "title", "company", "url", "description", "location", "country", "employment_type", "skills", "expires_on"].includes(key)) || !jobId(body.request_id)) throw new Error("Invalid opportunity request.");
  const text = (key: string, max: number, required = false) => {
    if (typeof body[key] !== "string" || body[key].length > max || (required && !body[key].trim())) throw new Error(`Check the ${key.replaceAll("_", " ")}.`);
    return body[key].trim();
  };
  const skills = text("skills", 2000).split(",").map(skill => skill.trim()).filter(Boolean);
  if (skills.length > 30 || skills.some(skill => skill.length > 100) || new Set(skills.map(skill => skill.toLowerCase())).size !== skills.length) throw new Error("Use up to 30 unique comma-separated skills.");
  const expiresOn = text("expires_on", 10);
  const expiresDate = new Date(`${expiresOn}T00:00:00Z`);
  if (expiresOn && (!/^20\d{2}-\d{2}-\d{2}$/.test(expiresOn) || Number.isNaN(expiresDate.getTime()) || expiresDate.toISOString().slice(0, 10) !== expiresOn)) throw new Error("Choose a valid closing date.");
  return { requestId: body.request_id, title: text("title", 200, true), company_name: text("company", 200, true), application_url: canonicalJobUrl(body.url), description: text("description", 10000), location: text("location", 300), country: text("country", 100), employment_type: text("employment_type", 100), skills, expires_at: expiresOn ? `${expiresOn}T23:59:59.999Z` : null };
}

export function opportunityFreshness(job: { expires_at?: string | null; published_at?: string | null }, now = Date.now()) {
  if (job.expires_at && Date.parse(job.expires_at) <= now) return "expired" as const;
  if (job.published_at && Date.parse(job.published_at) < now - 45 * 86400000) return "stale" as const;
  return "current" as const;
}

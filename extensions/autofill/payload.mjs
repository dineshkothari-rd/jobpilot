export const autofillQuestions = ["Full name", "Email", "Phone", "Current location", "LinkedIn URL", "GitHub URL", "Portfolio URL", "Current company"];

export function validatePayload(payload) {
  const allowed = autofillQuestions;
  if (!payload || payload.version !== 1 || typeof payload.applicationUrl !== "string" ||
    payload.applicationUrl.length > 2000 || !Array.isArray(payload.fields) || payload.fields.length > allowed.length ||
    !payload.fields.every((item) => item && allowed.includes(item.question) &&
      typeof item.answer === "string" && item.answer.length <= 2000 && item.answer.trim())) {
    throw new Error("Use reviewed contact data from JobPilot.");
  }
  const url = new URL(payload.applicationUrl);
  if (url.protocol !== "https:" || url.username || url.password ||
    !url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || url.hostname.endsWith(".local")) {
    throw new Error("A public HTTPS application URL is required.");
  }
  if (new Set(payload.fields.map((item) => item.question)).size !== payload.fields.length) {
    throw new Error("Duplicate contact fields are not supported.");
  }
  return payload;
}

export function trustedWorkspace(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === "https://parth-careers.vercel.app" && parsed.pathname === "/applications";
  } catch { return false; }
}

export function embeddedApplicationUrl(value) {
  try {
    const url = new URL(value);
    if (!["https://jobs.lever.co", "https://jobs.eu.lever.co"].includes(url.origin) ||
      url.username || url.password ||
      !/^\/[a-z0-9_-]+\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\/apply)?\/?$/i.test(url.pathname)) return null;
    url.pathname = url.pathname.replace(/\/$/, "").replace(/\/apply$/, "") + "/apply";
    url.hash = "";
    return url.href;
  } catch { return null; }
}

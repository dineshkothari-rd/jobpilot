// Self-contained because Chrome serializes this function into the active tab.
export function fillReviewedFields(payload) {
  const expected = new URL(payload.applicationUrl);
  if (location.origin !== expected.origin ||
    ![expected.pathname, expected.pathname.replace(/\/$/, "") + "/apply"].includes(location.pathname)) {
    throw new Error("Open the matching JobPilot application link first. Redirected/other forms require manual entry.");
  }
  const aliases = {
    "Full name": ["name", "full name", "fullname"],
    Email: ["email", "email address"],
    Phone: ["phone", "phone number", "mobile", "mobile number"],
    "Current location": ["location", "current location"],
    "LinkedIn URL": ["linkedin", "linkedin url", "urls[linkedin]"],
    "GitHub URL": ["github", "github url", "urls[github]"],
  };
  const normalize = (value) => value.toLowerCase().replace(/[*:]/g, "").replace(/\s+/g, " ").trim();
  const inputs = [...document.querySelectorAll("input, textarea")].filter((element) =>
    !element.disabled && !element.readOnly && element.getClientRects().length > 0 &&
    (element instanceof HTMLTextAreaElement || ["text", "email", "tel", "url"].includes(element.type)));
  let filled = 0;
  let skipped = 0;
  for (const field of payload.fields) {
    const names = aliases[field.question];
    if (!Array.isArray(names) || typeof field.answer !== "string" || !field.answer.trim() || field.answer.length > 2000) {
      skipped += 1;
      continue;
    }
    const matches = inputs.filter((element) => {
      const labels = [...(element.labels || [])].map((label) => label.textContent || "");
      return [element.name, element.id, element.getAttribute("aria-label") || "", ...labels]
        .some((name) => names.includes(normalize(name)));
    });
    // ponytail: exact labels only; unfamiliar or ambiguous ATS fields stay manual.
    if (matches.length !== 1 || matches[0].value.trim()) { skipped += 1; continue; }
    const element = matches[0];
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, field.answer);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    filled += 1;
  }
  return { filled, skipped };
}

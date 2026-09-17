/* global chrome */
import { fillReviewedFields } from "./fill.mjs";
import { embeddedApplicationUrl, validatePayload } from "./payload.mjs";

const textarea = document.getElementById("payload");
const button = document.getElementById("fill");
const feedback = document.getElementById("feedback");
const resultsList = document.getElementById("results");
const target = document.getElementById("target");
const redirect = document.getElementById("redirect");
const redirectLabel = document.getElementById("redirect-label");
let tab;
let embedded = false;
let expiresAt = null;

function matchingPage(payload) {
  const expected = new URL(payload.applicationUrl);
  const current = new URL(tab.url);
  return expected.origin === current.origin &&
    [expected.pathname, expected.pathname.replace(/\/$/, "") + "/apply"].includes(current.pathname);
}

async function fill() {
  button.disabled = true;
  resultsList.replaceChildren();
  let permission = null;
  let granted = false;
  try {
    if (!tab?.id || !tab.url) throw new Error("Open the company form and click the pinned helper icon.");
    if (textarea.value.length > 20000) throw new Error("Application data is too large.");
    let payload = validatePayload(JSON.parse(textarea.value));
    if (expiresAt && expiresAt <= Date.now()) {
      textarea.value = "";
      await chrome.storage.session.remove("jobpilot-apply-" + tab.id);
      throw new Error("Reviewed contacts expired. Reopen from JobPilot.");
    }
    if (embedded) {
      if (!embeddedApplicationUrl(payload.applicationUrl)) throw new Error("Only supported Lever forms can use embedded autofill.");
      permission = new URL(payload.applicationUrl).origin + "/*";
      // Called from the Fill button's user gesture, never automatically on page load.
      granted = await chrome.permissions.request({ origins: [permission] });
      if (!granted) throw new Error("Site access denied. Fill manually or use the companion.");
    }
    if (!embedded && !matchingPage(payload)) {
      redirectLabel.hidden = false;
      if (!redirect.checked) throw new Error("The job link redirected. Verify the current company form and explicitly confirm it is the same job.");
      payload = validatePayload({ ...payload, applicationUrl: tab.url });
    }
    // ponytail: mixed-host/captcha subframes can block Chrome allFrames injection;
    // use the company-tab fallback rather than requesting access to unrelated hosts.
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: embedded }, func: fillReviewedFields, args: [payload, embedded],
    });
    const matchingResults = results.filter((item) => item.result);
    if (!matchingResults.length) throw new Error("Embedded form is unavailable or blocked. Use the company tab.");
    const filled = matchingResults.reduce((sum, item) => sum + item.result.filled, 0);
    const skipped = matchingResults.reduce((sum, item) => sum + item.result.skipped, 0);
    for (const item of matchingResults.flatMap((frame) => frame.result.details || [])) {
      const entry = document.createElement("li");
      entry.textContent = `${item.question}: ${item.status} — ${item.reason}`;
      resultsList.append(entry);
    }
    feedback.textContent = filled + " fields filled; " + skipped + " skipped. " +
      (filled ? "Verify all answers, upload your resume and submit yourself." : "This may be a job listing or unfamiliar form. Open its company Apply link, then click the helper again.");
    if (filled) {
      textarea.value = "";
      await chrome.storage.session.remove("jobpilot-apply-" + tab.id);
    }
  } catch (error) {
    feedback.textContent = error instanceof SyntaxError ? "Paste valid reviewed data from JobPilot." :
      error.message + (embedded ? " If framing or another embedded host blocks access, use the real company tab and copy/paste fallback." : "");
  } finally {
    if (granted) await chrome.permissions.remove({ origins: [permission] }).catch(() => {});
    button.disabled = false;
  }
}

button.addEventListener("click", () => void fill());
// Toolbar invocation grants activeTab access; no permanent employer-site permissions.
(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return;
  target.textContent = "Current company page: " + new URL(tab.url).hostname;
  const key = "jobpilot-apply-" + tab.id;
  const stored = (await chrome.storage.session.get(key))[key];
  if (!stored) return;
  if (stored.expiresAt <= Date.now()) {
    await chrome.storage.session.remove(key);
    feedback.textContent = "Reviewed data expired. Reopen from JobPilot.";
    return;
  }
  const payload = validatePayload(stored.payload);
  embedded = stored.embedded === true;
  expiresAt = stored.expiresAt;
  textarea.value = JSON.stringify(payload);
  if (embedded) {
    target.textContent = "Embedded employer form: " + new URL(payload.applicationUrl).hostname;
    button.textContent = "Allow temporary Lever access & fill";
    feedback.textContent = "Contacts received directly from JobPilot. Click Fill to approve access to the embedded Lever form. Permission is removed after this attempt.";
  } else if (matchingPage(payload)) await fill();
  else {
    redirectLabel.hidden = false;
    feedback.textContent = "Connected data ready. Confirm this redirected form belongs to the same job before filling.";
  }
})().catch(() => { feedback.textContent = "Use the company form and copy/paste fallback."; });

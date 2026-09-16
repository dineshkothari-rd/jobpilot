/* global chrome */
import { fillReviewedFields } from "./fill.mjs";

const textarea = document.getElementById("payload");
const button = document.getElementById("fill");
const feedback = document.getElementById("feedback");
button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const raw = textarea.value;
    if (raw.length > 20000) throw new Error("Application data is too large.");
    const payload = JSON.parse(raw);
    if (!payload || payload.version !== 1 || typeof payload.applicationUrl !== "string" ||
      !Array.isArray(payload.fields) || payload.fields.length > 6 ||
      !payload.fields.every((item) => item && typeof item.question === "string" && typeof item.answer === "string")) {
      throw new Error("Paste reviewed autofill data copied from JobPilot.");
    }
    const url = new URL(payload.applicationUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("A secure application URL is required.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Open the company application in the active tab.");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillReviewedFields,
      args: [payload],
    });
    if (!result?.result) throw new Error("Could not fill this form. Complete it manually.");
    textarea.value = "";
    feedback.textContent = result.result.filled + " fields filled; " + result.result.skipped + " skipped. Verify the form and complete remaining fields.";
  } catch (error) {
    feedback.textContent = error instanceof SyntaxError ? "Paste valid autofill data from JobPilot." : error.message;
  } finally {
    button.disabled = false;
  }
});

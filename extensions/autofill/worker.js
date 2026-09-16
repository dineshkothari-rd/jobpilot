/* global chrome */
import { embeddedApplicationUrl, trustedWorkspace, validatePayload } from "./payload.mjs";

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!trustedWorkspace(sender.url) || sender.frameId !== 0 || !sender.tab?.id) {
    reply({ ok: false, error: "Open the authenticated JobPilot Applications workspace." });
    return;
  }
  if (message?.type === "CONNECT") { reply({ ok: true }); return; }
  if (!["OPEN", "FRAME"].includes(message?.type)) { reply({ ok: false, error: "Unsupported helper request." }); return; }
  (async () => {
    const payload = validatePayload(message.payload);
    if (message.type === "FRAME") {
      if (!embeddedApplicationUrl(payload.applicationUrl)) throw new Error("Only verified Lever-hosted form URLs can use the embedded helper.");
      await chrome.storage.session.set({
        ["jobpilot-apply-" + sender.tab.id]: { payload, embedded: true, expiresAt: Date.now() + 10 * 60000 },
      });
      reply({ ok: true });
      return;
    }
    const stored = await chrome.storage.session.get(null);
    const expired = Object.keys(stored).filter((key) => key.startsWith("jobpilot-apply-") && stored[key].expiresAt <= Date.now());
    await chrome.storage.session.remove(expired);
    const active = Object.keys(stored).filter((key) => key.startsWith("jobpilot-apply-") && !expired.includes(key));
    if (active.length >= 5) throw new Error("Finish current companion applications before opening more.");
    const companion = await chrome.windows.create({
      url: payload.applicationUrl, type: "popup", width: 900, height: 900,
    });
    const tabId = companion.tabs?.[0]?.id;
    if (!tabId) throw new Error("Companion window unavailable. Use the company link.");
    await chrome.storage.session.set({
      ["jobpilot-apply-" + tabId]: { payload, expiresAt: Date.now() + 10 * 60000 },
    });
    reply({ ok: true });
  })().catch((error) => reply({ ok: false, error: error.message }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove("jobpilot-apply-" + tabId);
});

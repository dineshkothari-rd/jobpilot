/* global chrome */
window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin ||
    event.data?.channel !== "jobpilot-apply-request" || typeof event.data.requestId !== "string" ||
    !["CONNECT", "OPEN", "FRAME"].includes(event.data.type)) return;
  chrome.runtime.sendMessage({ type: event.data.type, payload: event.data.payload }, (reply) => {
    const error = chrome.runtime.lastError;
    window.postMessage({
      channel: "jobpilot-apply-response", requestId: event.data.requestId,
      ok: !error && reply?.ok === true,
      error: error ? "Reload JobPilot after updating the helper." : reply?.error,
    }, location.origin);
  });
});

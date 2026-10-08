export function openConnectedApplication(payload: unknown, type: "OPEN" | "FRAME" | "CONNECT" = "OPEN"): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin ||
        event.data?.channel !== "jobpilot-apply-response" || event.data.requestId !== requestId) return;
      cleanup();
      if (event.data.ok === true) resolve();
      else reject(new Error(typeof event.data.error === "string" ? event.data.error : "Could not open the helper."));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Install/reload helper v1.2, pin it in Chrome, then reload Parth Careers. The normal company link still works."));
    }, 5000);
    window.addEventListener("message", receive);
    window.postMessage({ channel: "jobpilot-apply-request", type, requestId, payload }, window.location.origin);
  });
}

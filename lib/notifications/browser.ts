export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration?.pushManager ? await registration.pushManager.getSubscription() : null;
  } catch { return null; }
}
export async function disconnectPushBrowser() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  let disconnected = false;
  try {
    const response = await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }), signal: AbortSignal.timeout(5000) });
    disconnected = response.ok;
  } finally {
    // Stop shared-browser delivery even when the server is temporarily unavailable.
    const unsubscribed = await subscription.unsubscribe();
    if (!disconnected && !unsubscribed) throw Error("Unable to disconnect this browser. Block notifications in browser settings.");
  }
}
export async function connectPushBrowser(publicKey: string) {
  if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw Error("This browser does not support push notifications here.");
  if (await Notification.requestPermission() !== "granted") throw Error("Allow notifications in your browser settings to connect.");
  const registration = await navigator.serviceWorker.register("/reminder-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
  const data = await response.json();
  if (!response.ok) { await subscription.unsubscribe(); throw Error(data.error || "Unable to connect this browser."); }
  return subscription.endpoint;
}

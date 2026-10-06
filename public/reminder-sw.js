self.addEventListener('push', event => {
  // Generic lock-screen text: private notes, companies and interview locations stay in the app.
  let kind = 'reminder';
  try { if (event.data?.json()?.kind === 'jobs') kind = 'jobs'; } catch { /* Ignore invalid payloads. */ }
  event.waitUntil(self.registration.showNotification(kind === 'jobs' ? 'JobPilot job alerts' : 'JobPilot reminder', {
    body: kind === 'jobs' ? 'New jobs match your saved searches. Open JobPilot to review.' : 'Upcoming interviews or follow-ups. Open JobPilot to review.',
    data: { kind },
    tag: kind === 'jobs' ? 'jobpilot-daily-jobs' : 'jobpilot-daily-reminder',
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.kind === 'jobs' ? '/jobs' : '/applications', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })());
});

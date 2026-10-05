self.addEventListener('push', event => {
  // Generic lock-screen text: private notes, companies and interview locations stay in the app.
  event.waitUntil(self.registration.showNotification('JobPilot reminder', {
    body: 'Upcoming interviews or follow-ups. Open JobPilot to review.',
    tag: 'jobpilot-daily-reminder',
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/applications', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })());
});

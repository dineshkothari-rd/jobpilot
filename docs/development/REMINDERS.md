# Daily interview and follow-up reminders

Reminders are opt-in in Profile. Email goes to the confirmed Supabase Auth email, never to an address supplied by a browser. Browser push requires permission and a separate connection on each device. Messages contain a generic heads-up and link to applications; private notes and company details stay in the app.

The worker checks scheduled interviews in the next 26 hours and active applications with follow-ups due today or tomorrow in the selected timezone. Rejected/withdrawn applications and completed/cancelled interviews are excluded. Follow-up timestamps use the saved instant and the selected timezone. No overdue backlog is sent. Reminders can appear on consecutive days for the same upcoming event.

## Activation

1. The deployed migration `supabase/migrations/20261005144754_notification_reminders.sql` is required in every target environment. It creates owner-private preferences, up to ten browser subscriptions per account, delivery history, and a service-role-only atomic claim function. All rows cascade on account deletion.
2. Configure server environment variables in the existing deployment:
   - Existing `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, and canonical HTTPS `NEXT_PUBLIC_SITE_URL`.
   - Email: `EMAIL_DELIVERY_ENABLED=true`, `RESEND_API_KEY` and `REMINDER_FROM_EMAIL` using a sender on a Resend-verified domain. Personal Gmail addresses can receive reminders but cannot be the verified-domain sender.
   - Push: generate a VAPID key pair once with `npx web-push generate-vapid-keys`; configure `VAPID_PUBLIC_KEY` and server-only `VAPID_PRIVATE_KEY`. Keep keys out of logs/chat/git. The public key is returned only when push is configured; rotating keys requires reconnecting browsers.
3. Deploy the app so `vercel.json` registers `/api/cron/reminders` daily at `15 3 * * *` (UTC). The existing Autopilot schedule remains separate. Cron requests require `Authorization: Bearer <CRON_SECRET>`.
4. Confirm the account email, opt in and save Profile preferences. For push, connect the browser and enable the push checkbox. Use a disposable test account to verify real delivery before inviting users. No real reminder messages were sent during implementation validation.

[Vercel's current cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) permit daily scheduling on Hobby, with execution anywhere in the scheduled hour. This feature is a daily heads-up, not an exact-time alarm. Use calendar alarms for precise interview notifications. Google/Outlook two-way calendar sync is a separate backlog feature. On iOS/iPadOS, [browser push requires a Home Screen web app](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); unsupported/denied permissions show an error instead of claiming a connection.

[Resend sender verification](https://resend.com/docs/dashboard/domains/introduction) and [email API/idempotency](https://resend.com/docs/api-reference/emails/send-email) describe sender setup and 24-hour idempotency keys. [Web Push](https://github.com/web-push-libs/web-push) handles encryption/VAPID signing. No email SDK or custom cryptography is used.

## Delivery and operational limits

- At most one successful email and one push per connected browser per UTC day. Atomic leases prevent concurrent sends; failed/expired claims permit at most three attempts that day. Final updates match the claimed attempt so an old worker cannot overwrite a newer attempt. Provider timeouts after acceptance can still be ambiguous; Resend uses a stable daily idempotency key and push messages share a collapse topic and notification tag.
- Email content is deliberately stable across same-day retries. It links to the current application workspace. Delivery history records channel, day, state and attempts, without provider secrets or private message content. Provider errors return aggregate counts, never raw payloads.
- Browser endpoints are restricted to Chrome/Firefox/Edge/Safari push providers and encryption keys are validated again before sending. A direct database insert cannot make the worker call an arbitrary URL. Expired endpoints (404/410) are removed. Signing out attempts server removal and browser unsubscription; global push opt-out stops all registered browsers.
- Account deletion markers block new preferences/subscriptions and new delivery claims before cleanup completes. One provider request already in flight can still complete when a preference/account changes.
- The bounded worker scans opted-in accounts in batches of 100, checks up to 1,000 near-term records per kind/account, and stops after four minutes with `incomplete: true`/503. At that volume, replace the scan with a resumable queue. [Vercel cron does not retry failed invocations](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-error-handling); investigate failed/incomplete runs and rerun the protected endpoint within the same UTC day after fixing the cause. Successful claims are skipped.
- Missing provider configuration keeps the relevant UI channel disabled; saving both channels off remains available. A missing migration shows a setup-pending error. JSON export includes reminder preferences, subscriptions and delivery history; absent rollout tables are explicitly marked in `unavailable_sections`.

## Verification checkpoint

Local migration reconstruction and all fourteen SQL security files pass, including ownership, forged-client claims, timezone validation, device cap, leases/retries, stale completion, sent deduplication and account deletion. Node tests cover timezone/DST boundaries, SSRF/key validation, provider mocks, confirmed-email enforcement, cron authorization, expired-device cleanup, independent channels, service-worker privacy and export rollout behavior. Migration deployed on 2026-10-05 after user approval; remote RLS and service-only claim grants verified. Actual authenticated email/push delivery remains pending provider configuration.

Dependency audit reports eight existing findings in Next.js/lint/DOMPurify dependencies; none are in the added `web-push` tree. They require a separate dependency review. The reported Next.js advisory references `next/og ImageResponse`; the current app does not use that API. Do not treat passing build/security-policy checks as a clean dependency audit.

# Environment configuration

Reconciled 2026-10-08. [.env.example](../../.env.example) is the setup template; [complete source-backed name inventory](../IMPLEMENTATION-REFERENCE.md#environment-inventory) includes platform-injected settings. Never document actual values. `NEXT_PUBLIC_` settings are browser-visible; all keys/secrets/tokens below remain server-only.

| Group / names | When required | Purpose and failure behavior |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Always | RLS-scoped browser and server auth/data clients; missing values prevent normal app use |
| `NEXT_PUBLIC_SITE_URL` | Production | Exact canonical HTTPS origin for callbacks, public links and provider setup; localhost only for development |
| `SUPABASE_SECRET_KEY` | Privileged workflows | Server-only Supabase secret/legacy service-role credential; never use publishable key or expose in client code |
| `CRON_SECRET` | Workers | Strong bearer secret for all three protected daily workers |
| `ALLOW_PAID_PROVIDERS` | Optional, default false | Explicit optional external AI activation; keep false for zero-spend launch |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Optional | External OpenAI-compatible provider; default deterministic fallback, default model `gpt-4o-mini`; no purchased AI required |
| `YOUTUBE_API_KEY` | Optional | Learning resource search; curated first-party/search fallback works without it |
| `EMAIL_DELIVERY_ENABLED` | Email opt-in, default false | Separate explicit email activation after verified sender/free quota review; does not enable paid AI |
| `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` | Email delivery | Free provider allowance only; sender must use a verified domain. Personal Gmail may receive but is not a domain-verified sender |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Browser push | Matching key pair; private key never public. Per-device permission/registration and profile consent still required |
| `CALENDAR_ENCRYPTION_KEY` | Calendar connections | Base64 encoding of 32-byte key; back up securely; rotating without migration makes stored tokens unreadable |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | Google calendar | Dedicated web OAuth client; canonical `/api/calendars/callback` and real calendar consent |
| `OUTLOOK_CALENDAR_CLIENT_ID`, `OUTLOOK_CALENDAR_CLIENT_SECRET` | Outlook calendar | Dedicated confidential web client; exact same callback and delegated calendar/offline scopes |
| `BILLING_MODE` | Billing | `test` or `live`; matching native key namespace required |
| `BILLING_LIVE_ENABLED` | Live billing, default false | Explicit live collection activation; not a substitute for merchant KYC/hosting/provider acceptance |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Billing | Matching provider mode credentials and signature verification secret; missing settings disable checkout |
| `RAZORPAY_PLAN_CANDIDATE_PRO`, `RAZORPAY_PLAN_RECRUITER_STARTER`, `RAZORPAY_PLAN_RECRUITER_GROWTH`, `RAZORPAY_PLAN_RECRUITER_ENTERPRISE` | Monthly subscriptions | Native plan IDs matching exact INR catalog price and monthly period |

Platform-injected `NODE_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `NEXT_PUBLIC_VERCEL_URL`, `NEXT_PUBLIC_VERCEL_ENV` are origin/runtime metadata. An explicit production canonical origin remains necessary. Supabase Google **sign-in** OAuth configuration is separate from JobPilot Google **calendar** OAuth credentials. Connected Codex apps cannot supply backend credentials.

Set secrets through the chosen hosting secret manager, separately for production/preview/local; restart/redeploy after changing runtime settings. Preview must use test billing and isolated callback setup. Do not log values, put secrets in git, or rotate keys merely to fix a wrong variable name. Verify safe readiness through the admin panel and real consented pilot, not by printing configuration.

Current observed production: Supabase/cron and VAPID configured; email, calendar and billing credentials absent. No paid provider purchase was made. Recheck safe readiness before launch; these observations may change after configuration.

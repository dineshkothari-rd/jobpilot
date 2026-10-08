# JobPilot deployment

Last reconciled: 2026-10-08 (source and automated checks; external acceptance is separate)

## Revenue launch without provider-subscription spend

Existing Vercel Hobby is a non-commercial preview; do not collect revenue on it. Use an eligible commercial free host such as Netlify Free, within its published quotas; no paid upgrade has been enabled. Import the existing repository using native Next.js integration, keep secrets server-only and deploy a preview first. This migration is **not deployed or runtime-certified** yet.

Before switching the canonical origin: verify route handlers/middleware, private caching, storage, callbacks, subscription webhook, PDF receipts and security headers. Set the exact canonical origin in Supabase and Google/Outlook/Razorpay callbacks. Replace the three schedules in `vercel.json` on the destination: Autopilot 03:00, reminders 03:15, job alerts 03:30 UTC; requests require the existing cron bearer secret. Confirm destination function runtime limits: current workers allow 300 seconds with a four-minute internal budget, and calendar sync uses bounded leases. Do not assume those limits/schedules transfer automatically. Keep paid upgrade/spend disabled and monitor free credit limits; exhausted free quotas may pause service.

Run read-only `node scripts/launch-check.mjs https://<origin>`, then genuine candidate/recruiter/admin and provider pilot checks. Preserve existing production data; schema synchronization through `20261008004447` is complete. Back up privately and perform isolated restore verification before public revenue operation. Enable gateway live settings and paid recruiter access only after the [revenue acceptance gates](docs/development/REVENUE-FOUNDATION.md) pass.

Official references: [Vercel Hobby policy](https://vercel.com/docs/plans/hobby), [Netlify commercial Free plan](https://www.netlify.com/blog/introducing-netlify-free-plan/), [Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [current credit limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/). No hosting account/token was available for migration.

## Vercel

1. Import this repo into Vercel.
2. Add the required Supabase variables in Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://<production-domain>`
   - `SUPABASE_SECRET_KEY` for privileged server workflows
   - `CRON_SECRET` for the scheduled Autopilot endpoint
3. Optional provider variables:
   - `AI_PROVIDER=openai-compatible` or `AI_PROVIDER=openai`
   - `AI_API_KEY`
   - `AI_BASE_URL` (defaults to `https://api.openai.com/v1`)
   - `AI_MODEL` (defaults to `gpt-4o-mini`)
   - `YOUTUBE_API_KEY`
4. Build command: `npm run build`

If optional provider variables are missing, AI-assisted surfaces use deterministic fallbacks and learning resources use curated links or safe search links.

## Production Authentication Setup

### Vercel Deployment Protection

JobPilot authentication and Vercel Deployment Protection are separate layers.

For a public SaaS production deployment, normal visitors must not see a Vercel login/access-request screen.

Check:

1. Vercel Project → Settings → Security → Deployment Protection
2. Do not protect the production/custom domain with Vercel Authentication or Password Protection.
3. If desired, keep Preview deployments protected.

Production/custom domain should be public. JobPilot private routes are still protected by Supabase auth in the application.

### Vercel environment variables

Set these for the Production environment, not Preview only:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
NEXT_PUBLIC_SITE_URL=https://<production-domain>
SUPABASE_SECRET_KEY=<server-only-secret-key>
CRON_SECRET=<long-random-value>
```

Do not prefix server-only secrets with `NEXT_PUBLIC_`.

### Supabase Authentication

Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://<production-domain>`
- Redirect URLs:
  - `https://<production-domain>/auth/callback`
  - `http://localhost:3000/auth/callback` for local development only

Avoid broad production wildcards. Add preview callback URLs only if preview OAuth login is intentionally supported.

Supabase Dashboard → Authentication → Providers → Google:

- Enable Google provider.
- Use the Google Client ID and Client Secret for the intended production OAuth app.
- Never commit the Google Client Secret.

### Google Auth Platform

For the Web OAuth Client:

Authorized JavaScript origins:

```text
https://<production-domain>
http://localhost:3000
```

The localhost origin is optional and only for local development.

Authorized redirect URI for Supabase Google Auth:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

Do not put `https://<production-domain>/auth/callback` in Google unless you are bypassing Supabase Auth. The normal flow is:

```text
Google → Supabase /auth/v1/callback → JobPilot /auth/callback
```

If the Google OAuth consent screen is in Testing mode, outside users may fail unless added as test users. For public JobPilot, publish/configure the OAuth app for production use.

## Supabase production checklist

- Add the deployed production callback URL to Supabase Auth redirect URLs after the first deployment.
- Configure OAuth provider callback URLs with the real production domain; do not use a placeholder domain.
- Confirm Row Level Security policies still require the signed-in user for profile, resume, application, and saved-job data.
- Compare local and remote migration history. Never apply, rename, or edit an individual historical migration ad hoc; follow [the migration workflow](docs/development/MIGRATIONS.md).
- Resume uploads use the private `resumes` bucket created by the new migration. Confirm the reviewed migration is deployed, then smoke-test owner upload/delete and cross-owner denial; see [the reproducibility design](docs/design/resume-storage-reproducibility.md).
- Re-run database tests and Supabase security/performance advisors after migration changes. The service-only learning answer-key INFO is intentional; leaked-password protection is unavailable on the current Free plan.

## Smoke test after deploy

- Open the production landing page in a private browser without a Vercel account. It must not show a Vercel access request.
- Sign in.
- Sign out.
- Sign in with a different Google account.
- Open `/dashboard`.
- Open a saved job, then `/jobs/[id]/prepare`.
- Confirm the hub loads without `AI_*` and `YOUTUBE_API_KEY`.
- Click `Explain with AI`; without `AI_API_KEY`, it should return deterministic fallback text.
- Add a practice answer and click `Evaluate Answer`.
- Open `Resources`; without `YOUTUBE_API_KEY`, it should show first-party docs and a YouTube search link.
- If provider keys are configured, repeat the AI/resource clicks and confirm status badges show connected or fallback without exposing secrets.

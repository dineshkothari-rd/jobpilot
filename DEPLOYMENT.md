# JobPilot deployment

## Vercel

1. Import this repo into Vercel.
2. Add the required Supabase variables in Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://<production-domain>`
3. Optional provider variables:
   - `AI_PROVIDER=openai-compatible` or `AI_PROVIDER=openai`
   - `AI_API_KEY`
   - `AI_BASE_URL` (defaults to `https://api.openai.com/v1`)
   - `AI_MODEL` (defaults to `gpt-4o-mini`)
   - `YOUTUBE_API_KEY`
4. Build command: `npm run build`

If optional variables are missing, Interview Prep V2 still deploys and uses deterministic coaching, first-party documentation links, and safe YouTube search links.

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
- Apply `supabase/migrations/20260914000000_auth_rls_policies.sql` if these RLS policies are not already deployed.

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

# Environment variables

Last verified: 2026-09-27

Never document or commit actual values. `NEXT_PUBLIC_` variables are browser-visible; all others listed here are server-only.

| Variable | Required | Boundary / sensitivity | Purpose | Local / production |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client-visible project URL | Browser/server Supabase clients | Local Supabase URL locally; production project URL in Vercel |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Client-visible publishable/legacy anon key; not a secret | Browser/server RLS-scoped access | Local key locally; production publishable key in Vercel |
| `NEXT_PUBLIC_SITE_URL` | Production required | Client-visible canonical origin | OAuth callback and public verification URLs | `http://localhost:3000` locally; exact HTTPS production origin in Vercel |
| `SUPABASE_SECRET_KEY` | Feature-dependent | Server-only critical secret/service-role key | Cron/job ingestion and privileged learning/practice operations | Needed locally only for those durable flows; required in production for them |
| `CRON_SECRET` | Background required | Server-only high sensitivity | Bearer authentication for Vercel Autopilot cron | Optional locally; required for production background runs |
| `AI_PROVIDER` | Optional | Server-only configuration | Empty = deterministic; `openai`/`openai-compatible` = external | Same semantics in every environment |
| `AI_API_KEY` | Optional | Server-only secret | External AI authorization | Omit for deterministic fallback |
| `AI_BASE_URL` | Optional | Server-only configuration | OpenAI-compatible base; default OpenAI `/v1` | Set only for alternate provider/base |
| `AI_MODEL` | Optional | Server-only configuration | Model name; current default `gpt-4o-mini` | Provider-specific |
| `YOUTUBE_API_KEY` | Optional | Server-only secret | YouTube learning-resource search | Omit for curated docs/search fallback |

Vercel also injects `VERCEL_URL` and may inject `NEXT_PUBLIC_VERCEL_URL` / `NEXT_PUBLIC_VERCEL_ENV`; `lib/site-url.ts` uses them only for non-production preview fallback. `NODE_ENV` is framework-provided.

Google OAuth client credentials are configured in Supabase/Google dashboards, not read directly by JobPilot code.

Relevant code: `.env.example`, `lib/site-url.ts`, `lib/supabase/`, `lib/learning/server.ts`, `lib/ai/providers/provider-factory.ts`, `lib/resources/resource-provider-factory.ts`, `app/api/cron/autopilot/route.ts`.

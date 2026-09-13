# JobPilot deployment

## Vercel

1. Import this repo into Vercel.
2. Add the required Supabase variables in Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Optional provider variables:
   - `AI_PROVIDER=openai-compatible` or `AI_PROVIDER=openai`
   - `AI_API_KEY`
   - `AI_BASE_URL` (defaults to `https://api.openai.com/v1`)
   - `AI_MODEL` (defaults to `gpt-4o-mini`)
   - `YOUTUBE_API_KEY`
4. Build command: `npm run build`

If optional variables are missing, Interview Prep V2 still deploys and uses deterministic coaching, first-party documentation links, and safe YouTube search links.

## Supabase production checklist

- Add the deployed Vercel URL to Supabase Auth redirect URLs after the first deployment.
- Configure OAuth provider callback URLs with the real production domain; do not use a placeholder domain.
- Confirm Row Level Security policies still require the signed-in user for profile, resume, application, and saved-job data.

## Smoke test after deploy

- Sign in.
- Open `/dashboard`.
- Open a saved job, then `/jobs/[id]/prepare`.
- Confirm the hub loads without `AI_*` and `YOUTUBE_API_KEY`.
- Click `Explain with AI`; without `AI_API_KEY`, it should return deterministic fallback text.
- Add a practice answer and click `Evaluate Answer`.
- Open `Resources`; without `YOUTUBE_API_KEY`, it should show first-party docs and a YouTube search link.
- If provider keys are configured, repeat the AI/resource clicks and confirm status badges show connected or fallback without exposing secrets.

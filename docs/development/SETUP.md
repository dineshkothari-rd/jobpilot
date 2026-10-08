# Local setup

Last reconciled: 2026-10-08 (source and automated checks; external acceptance is separate)

## Prerequisites

- Node.js 20+
- npm
- Docker for local Supabase
- Supabase CLI through `npx`

## Setup

```sh
git clone <repository-url>
cd jobpilot
npm ci
cp .env.example .env.local
npx supabase start
npx supabase db reset --local
npm run dev
```

Fill `.env.local` with local Supabase output and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Add server-only secrets only when testing the features that require them. Never commit `.env.local`.

Open `http://localhost:3000`. Configure Google OAuth/local callback in Supabase when testing the actual sign-in flow.

## Current Storage state

`db reset` reconstructs the private `resumes` Storage bucket and owner-path policies from repository migrations. The bucket remains private, accepts PDFs up to 5 MiB, and permits owner upload/delete without granting browser listing, download, or update access. These migrations are deployed; verify the linked target before setting up another environment.

## Initial verification

```sh
node --test $(git ls-files | grep '.test.mjs')
npm run lint
npm run build
npx supabase test db --local supabase/tests
git diff --check
```

Relevant code: `.env.example`, `package.json`, `supabase/migrations/`, `supabase/seed.sql`.

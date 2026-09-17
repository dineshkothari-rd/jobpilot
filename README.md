This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Free Career Autopilot

### Guided applications and free autofill

Applications ranks prepared opportunities by match. The guided workspace offers resume review/download, sourced copy-ready answers, and explicit successful-submission confirmation. Confirmation records the date, schedules a seven-day follow-up (preserving existing reminders), and opens the next ready application. Closed stages clear automatic reminders. Tracker confirmation is not provider proof.

The workspace guides Review details → Company form → Confirm & track. Optional reusable phone/company/portfolio/compensation answers require factual confirmation; stale tabs cannot overwrite newer answers. Apply `supabase/migrations/20260917074214_application_facts_storage.sql` for saved-answer storage on other installations (already applied to production). Authorization and notice period stay in existing Autopilot settings. Unsaved edits are protected; changing answers or resume requires review again. Refresh restores only a 24-hour link-open marker, never approval or submission.

Optional Chrome helper v1.2 is downloadable in the workspace. Unzip, enable Developer mode in Chrome Extensions, and Load unpacked; existing users replace files and Reload. Pin the helper and reload JobPilot. Connected companion opens the employer website without leaving JobPilot and passes reviewed contacts directly. Click the helper icon on that company tab to grant temporary active-tab access. Redirects require explicit same-job confirmation; copy/paste remains available. The helper reports each filled/skipped field without exposing answer values, never overwrites existing fields, and also supports exact current-company and portfolio labels.

Supported Lever forms can also open inside the workspace: paste the actual employer posting URL, verify it is the same job, and choose View form here or Connect embedded autofill. Embedded autofill requires a separate user-approved Lever-only site permission, which the helper removes after the attempt. Cross-origin iframe display does not itself permit form access. Sites that block framing, require login or use another provider must use the company-tab fallback; no security headers are bypassed and no forms are cloned. Employer API submission requires employer credentials and is not implemented.

Only empty, visible, unambiguous contact inputs are filled. Existing values, legal/consent choices, unknown fields, files and final submission remain manual. Connected contacts are held in browser-session memory, expire after 10 minutes, and are removed after successful filling or closing the linked tab. The helper sends no analytics or server uploads and uses no paid services. Access from JobPilot is restricted to the production Applications workspace.

After changing extension source, regenerate its download and run checks:

```sh
zip -j -q public/jobpilot-autofill.zip extensions/autofill/manifest.json extensions/autofill/popup.html extensions/autofill/popup.js extensions/autofill/fill.mjs extensions/autofill/payload.mjs extensions/autofill/bridge.js extensions/autofill/worker.js
node --test lib/applications/*.test.mjs
```

Existing Supabase security advisories (unchanged by this feature): [mutable search path in set_updated_at](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) / [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) execution of handle_new_user, and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Auth configuration/function hardening requires separate validation; no auth policies were loosened.

Autopilot uses the existing public Himalayas feed and deterministic application
generation. It never calls a paid AI provider or submits an application on your
behalf. Complete work authorization and notice period, save settings, and review
prepared packages in the queue before submitting on the company website.

`Run now` works while signed in. Background preparation runs daily at `03:00 UTC`
(approximately 8:30–9:30 AM IST on Vercel Hobby), even with the app closed.
The daily limit caps newly created application packages. Prepared packages are
not recreated by regular runs, and concurrent runs for a user are blocked.

To activate the background worker:

1. Apply `supabase/migrations/20260916105215_autopilot_background_safety.sql` and `supabase/migrations/20260916110023_autopilot_worker_access.sql`.
2. In Vercel **Production** environment variables, securely set
   `SUPABASE_SECRET_KEY` to the project's secret or legacy service-role key and
   `CRON_SECRET` to a random secret of at least 32 bytes. Never prefix these with
   `NEXT_PUBLIC_`, commit them, or paste them into chat.
3. Deploy with the included `vercel.json`. Preview deployments do not run cron.

The UI shows "Background setup pending" when secrets are absent. One user's
failure does not stop the other users. Timed-out runs can recover after ten
minutes. The worker has a four-minute batch budget; high-volume installations
need resumable batching. Hosting/database free-tier usage limits still apply;
no paid subscription or integration is configured by this feature.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

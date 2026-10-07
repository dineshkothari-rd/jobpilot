# Free-launch operations and pilot

Business/service name: **JobPilot**. Public support: **dineshkothari2021@gmail.com**, authorized by the owner on 2026-10-07. This name does not claim a registered legal entity. Public notices describe current product behavior; jurisdiction/entity/consumer/privacy legal review remains a release decision.

## Cost and capacity

No paid service, subscription, API, new cloud project or hosting upgrade was enabled by this batch. Existing Vercel team was verified read-only as **Hobby**. Vercel limits Hobby to personal/non-commercial use; do not treat this deployment as approved for revenue activity. The owner must choose compliant hosting before commercial operation, within the agreed budget. [Official policy](https://vercel.com/docs/plans/hobby).

Use the existing Vercel/Supabase usage dashboards to review database size, storage, egress, function duration and traffic before inviting a pilot cohort and during the pilot. Hosting totals are not measured/enforced by application-level quotas. This batch does not promise unlimited free usage or add an automatic billing cap.

Existing application limits: 100 nonclosed postings/company; 1000 sourcing records/company; 100 messages/user/rolling day and 20/thread/user/minute; 10 new interview invites/thread/day; 20 applications/user/day; 5 support tickets/user/day. Public browsing returns 24 records/page with a maximum 100 pages and 100-character literal filters; sitemap bounds its direct listing window to 1000. Database calls from public pages timeout after 10 seconds. These are request/data caps, not a distributed anonymous IP-rate limiter.

Daily cron endpoints already require CRON_SECRET. Reminder/alert channels remain off until configured. Do not enable paid provider flags or add paid credentials merely to make a readiness checklist green. Verify any optional provider's current free allowance separately before activation.

## Public data and search engines

Only active, unhidden, supported-source, globally public jobs appear in the server-only `public_discovery_jobs` projection. Private user-created jobs are excluded. Browser roles receive no direct projection/table grants. Brand pages use the existing published/verified safe company projection; no company evidence, candidate data, messages or contact details are exposed.

Himalayas and Remotive prohibit submitting their API listings to Google Jobs/other third-party boards and require attribution/backlinks. Source listings remain readable without email signup; aggregate/detail pages are noindex and aggregated jobs receive no JobPosting markup or sitemap submission. Only direct JobPilot listings enter the sitemap and eligible source-backed JobPosting markup. Ambiguous/missing location/date facts suppress markup; no estimated salary, guaranteed rich result or automatic Indexing API submission is claimed. [Himalayas](https://himalayas.app/api), [Remotive](https://github.com/remotive-com/remote-jobs-api), [Google](https://developers.google.com/search/docs/appearance/structured-data/job-posting).

## Read-only launch smoke check

Run `node scripts/launch-check.mjs https://jobpilot-murex.vercel.app` against a ready deployment. It creates no accounts or hiring records and sends no messages. It checks public pages/assets, robots/sitemap and unsigned protected API denial. Local production runtime verification uses existing server credentials privately; sensitive values exported by Vercel may be redacted and must not be mistaken for usable API keys. Never paste keys into logs, chat or source control.

## Errors and support

Server exception events include only a safe framework digest, route template and error kind. They omit error messages, request paths/query strings, headers, cookies, bodies and user IDs. Unhandled page errors display a support reference and retry/help links. API handlers that catch errors still use their existing generic responses; a separate central log/alert service and automatic uptime alerts are not added. Inspect current hosting logs when a smoke check or user report fails. Redact personal content before sharing logs. Verify the public support inbox manually; listing a mailto link does not test email delivery.

## Manual backup and restoration

Supabase recommends regular off-site exports for free projects. Use the existing CLI and `sh scripts/backup-database.sh PROJECT_REF /absolute/private/new-backup-folder`. The tool writes restricted-permission role/schema/data dumps and SHA256 checksums, refuses reuse/relative/in-repository destinations and does not print credentials. Do not commit, upload to public storage, or attach these dumps to chat: they contain private account and recruiting data.

The runnable tool was tested with a stub CLI contract; **no actual production backup or restore drill is claimed**. Before launch, use a secure owner-controlled destination, run the export, verify checksums, encrypt and store a copy off-device. Storage resume binaries, OAuth encryption keys, Auth/provider settings and host configuration need separate protected backups. A database-only dump is insufficient for complete recovery. Follow [Supabase's current restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) on an isolated target. Never restore into production to test recovery. Verify known row counts, account sign-in, storage paths and owned-record isolation before cutover. Restored snapshots can reintroduce deleted data: apply deletion requests again and document retention.

## Real-user pilot checklist — outstanding

Use consenting real candidate/recruiter/admin accounts; keep their credentials private. Fixtures and database tests do not replace this pilot.

1. Candidate: confirm registration/reset email; upload/select a resume; verify save/export and refresh; opt into recruiter visibility, then anonymous/private modes.
2. Recruiter/admin: submit real company evidence; admin verifies it; publish a real opening; confirm public listing and branding; pause/expire/revoke it and confirm public access disappears.
3. Hiring: candidate reviews/submits; employer reviews/stage updates; two participants message; invite/accept/reschedule/cancel; verify candidate planner/history/realtime. Block/revoke sharing and confirm subsequent recruiter access is denied.
4. Admin/support: submit a report and support ticket; review decisions and notes; confirm another account cannot read them.
5. Disposable consenting account: export, revoke sessions/delete, confirm Auth/Storage and cascades. Verify deleted data is not exposed in public or recruiter pages.
6. Optional providers: configure eligible free email/push and calendar OAuth, then verify actual delivery and provider round trips. These remain Partial until that happens.
7. Accessibility: keyboard-only navigation, zoom, contrast, screen-reader labels, mobile device and voice/microphone permission tests. Automated/lint and 390px layout checks do not certify full accessibility.
8. Recovery/quotas: complete the isolated restore drill, review current provider/hosting usage, confirm support inbox works and choose compliant hosting before charging.

# Onboarding flow

Last verified: 2026-09-27

## Entry condition

A newly authenticated user has an automatically created `profiles` row but lacks one or more of name, target role, current company, location, or preferred roles.

## User steps

1. OAuth callback redirects to `/profile`.
2. User reviews account name/avatar/email and enters career facts and links.
3. User enters preferred roles, locations, countries, employment types, remote preference, salary and match threshold.
4. Browser writes the owner profile and upserts `job_preferences`.
5. User proceeds to Resume, Jobs, or Dashboard.

Routes: `/profile`, `/resume`, `/dashboard`. API calls: direct authenticated Supabase browser client for profile/preferences.

Database effects: update `profiles`; insert/update `job_preferences`. RLS requires the authenticated owner. URL, numeric, required-field and preference validation is currently performed in the client; DB constraints cover ownership and selected numeric rules.

Failure states: missing session, failed profile trigger/read, invalid required fields/URLs/numbers, or Supabase write failure. Profile and preference saves run concurrently, so a partial success is possible and is a future transaction-boundary concern.

Exit condition: the profile/preference baseline is available for matching and recommendations. Completion percentages are product guidance, not external verification.

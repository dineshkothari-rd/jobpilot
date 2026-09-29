# My Day flow

Last verified: 2026-09-27

## Entry condition

An authenticated user opens `/dashboard`. The dashboard loads current setup, matches, saved work, application follow-ups, interviews, learning, practice, and private deferral preferences.

## Steps

1. Domain data is converted into candidate next actions.
2. Deterministic priority rules favor incomplete setup, resume, real upcoming/overdue interviews, due follow-ups, prepared applications, unfinished learning/practice, and discovery.
3. User opens an action, skips it for today, chooses a date, or undoes a deferral.
4. `POST /api/my-day` saves only the action href/date preference with an optimistic version.

Routes/APIs: `/dashboard`, `/api/jobs/match`, `/api/applications`, `/api/interviews`, `/api/learn`, `/api/practice`, `/api/my-day`; Dashboard also reads owner saved-job data.

Database effects: `my_day_preferences` only for planning control. Application, interview, learning, practice and job records are read to calculate recommendations.

Security: authenticated owner queries, exact safe internal action destinations, bounded preference JSON, same-origin writes and stale-write rejection.

Failure states: unavailable domain API, incomplete setup, partially unavailable learning/practice progress, stale planning tab, or disabled storage. Available domains continue to provide suggestions where possible.

Exit condition: the user follows a next action or stores/undoes a deferral. Planning never silently changes application progress or claims work completed.

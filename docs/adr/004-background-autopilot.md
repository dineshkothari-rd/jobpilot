# ADR 004: Run autopilot as bounded background preparation

**Status:** Accepted
**Last verified:** 2026-09-27

## Context

Autopilot matches jobs and prepares application material independently of an open browser session. It needs elevated access to process eligible users, yet it must not bypass product consent or create unbounded, duplicate work.

## Decision

Autopilot runs through authenticated or secret-protected server entry points, performs bounded batches, records automation actions, and prepares rather than submits applications. It uses the service role only inside trusted server code. Database uniqueness and existing-record checks provide idempotency, while retry state remains explicit.

## Alternatives considered

- Run in the browser. Rejected because it depends on an open session and cannot safely hold worker credentials.
- Submit applications automatically. Rejected by the human-in-the-loop decision in ADR 001.
- Introduce a queue now. Deferred because the current bounded worker and action records cover current volume.

## Consequences

- Scheduled execution needs `CRON_SECRET` and a server-only Supabase secret key.
- Prepared packages remain visible for review and confirmation.
- Failures can be retried from recorded actions without claiming a submission.
- Add a durable queue only when measured volume, execution limits or retry contention exceed the bounded worker.

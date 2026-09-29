# ADR 001: Keep application submission human-in-the-loop

**Status:** Accepted
**Last verified:** 2026-09-27

## Context

JobPilot can discover jobs, tailor a resume, draft a cover note and prepare answers. The final employer form is outside JobPilot, can contain facts the product does not know, and may include legal declarations or consent. Treating a prepared package or an opened link as a completed submission would create a false employment record.

## Decision

JobPilot remains an assisted-application product. Automation may create an `application_submissions` row with `status = 'prepared'` and an `applications` row with `status = 'saved'`. Only an explicit user confirmation may advance the tracker to `applied` or a later submitted state. The interface must state that opening an application URL is not submission.

## Alternatives considered

- Fully automate third-party forms. Rejected because form structure, authorization and factual accuracy cannot be guaranteed.
- Mark a record applied when its URL opens. Rejected because navigation is not evidence of submission.
- Track preparation outside the application pipeline. Rejected because the current saved row usefully connects the package, resume and follow-up workflow.

## Consequences

- Users retain control over every external submission.
- Prepared and submitted counts remain semantically distinct.
- Autopilot can safely prepare work in the background but cannot claim completion.
- Future integrations must preserve an auditable user-confirmation boundary unless an employer API supplies authoritative submission evidence.

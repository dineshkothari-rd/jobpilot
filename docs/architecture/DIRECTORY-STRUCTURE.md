# Directory structure

Last verified: 2026-09-27

## Current structure

```text
app/                  App Router pages, layouts, OAuth callback, APIs, and feature UI
components/           Shared button, layout, dashboard planning and stat UI
lib/                  Domain logic, provider adapters, Supabase clients, tests
extensions/autofill/  Manifest V3 reviewed-contact helper
public/               Static assets and packaged extension
supabase/migrations/  Production-sensitive schema history
supabase/tests/       SQL security assertions
docs/                 Product and engineering documentation
```

`lib/` already has useful domain groupings (`applications`, `autopilot`, `jobs`, `learning`, `portfolio`, `practice`, `resume`, `resources`). The main boundary problem is that related feature UI/data logic remains under route folders and some pages query Supabase directly.

## Approved target direction

```text
app/             routing, layouts, framework boundaries, route composition
features/        domain-owned UI, models, services, schemas, and server access
shared/          genuinely reusable UI, types, constants, and utilities
infrastructure/  Supabase/auth/AI/provider/observability adapters
extensions/      browser-extension product boundary
supabase/        migrations, seeds, and SQL security tests
docs/            authoritative product and engineering knowledge
```

We are not introducing `src/` at this stage. Moving the existing root into `src/` would add import churn without creating domain boundaries.

## Eventual `app/` responsibility

- Route and layout files
- Next.js metadata, error/loading/not-found boundaries
- Route-level composition
- Route handlers as HTTP adapters
- Minimal framework-specific data translation

Business rules should progressively move behind feature-owned APIs only when a feature phase is approved. Existing working files must not move solely to match a diagram.

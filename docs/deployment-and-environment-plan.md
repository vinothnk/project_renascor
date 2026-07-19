# Deployment And Environment Plan

Project Renascor is a Next.js App Router application deployed to Vercel with
Supabase providing Postgres, Auth, RLS, and migration management.

## Early Decisions

- Vercel is the canonical application hosting target.
- Supabase is the canonical database and authentication platform.
- Local, Preview, and Production must use separate environment configuration.
- Production data is never used for local development or routine preview
  validation.
- Database schema changes are shipped through committed Supabase migrations,
  not direct dashboard edits.
- Core reference data is seeded through deterministic, idempotent migrations.
- Backups or exports are required before risky production data changes.

## Environments

Use three practical environments from the start:

| Environment | Purpose | Database |
| --- | --- | --- |
| Local | Day-to-day development on a developer machine | Local Supabase when available, otherwise a dedicated development Supabase project |
| Preview | Pull request and branch validation on Vercel | Dedicated preview/staging Supabase project, or Supabase branching when enabled |
| Production | User-facing application | Production Supabase project |

Do not point local or preview deployments at production except for explicit,
read-only operational checks.

## Local Development Setup

Baseline setup:

1. Install Node.js compatible with the project lockfile.
2. Install dependencies with `pnpm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill in the Supabase URL and publishable key for the local/development
   Supabase environment.
5. Apply or verify the committed Supabase migrations against the development
   database.
6. Run `pnpm dev` and open `http://localhost:3000`.

Validation before pushing:

```bash
pnpm lint
pnpm test
pnpm build
```

Run the RLS smoke test when database policies or user-owned data access changes:

```bash
pnpm test:rls
```

The RLS smoke test requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` for
test setup and cleanup only. Application code must not use the service role key.

## Supabase Project Setup

Create separate Supabase projects for production and any long-lived
staging/preview environment. Each project should have:

- Email/password Auth enabled for the current app flows.
- Site URL and redirect URLs configured for the matching Vercel environment.
- The committed SQL migrations in `supabase/migrations/` applied in order.
- RLS enabled on all exposed `public` tables.
- Only publishable Supabase keys exposed to browser code.
- Service role keys limited to trusted local scripts, CI jobs, or operational
  workflows.

Remote database changes should be migration-driven. Do not use the Supabase
Dashboard SQL editor or table editor for shared schema changes unless the same
change is captured immediately in a committed migration.

For local Supabase CLI workflows, discover the installed CLI commands with
`supabase --help` and `supabase db --help` before relying on flags. Link the
remote project with:

```bash
supabase login
supabase link
```

Apply committed migrations to a linked remote project with:

```bash
supabase db push
```

When multiple people are working on migrations, coordinate so only one person or
CI job pushes to a shared remote database at a time.

## Environment Variables

Required application variables:

| Variable | Scope | Used By | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | App runtime | Supabase project URL for the current environment |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | App runtime | Publishable key only; safe for client bundle by design |

Operational and test-only variables:

| Variable | Scope | Used By | Notes |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only local/CI | `pnpm test:rls` | Never prefix with `NEXT_PUBLIC_`; never use in browser code |
| `RLS_TEST_USER_A_EMAIL` | Local/CI test | `pnpm test:rls` | Dedicated disposable test user |
| `RLS_TEST_USER_B_EMAIL` | Local/CI test | `pnpm test:rls` | Dedicated disposable test user |
| `RLS_TEST_USER_PASSWORD` | Local/CI test | `pnpm test:rls` | Dedicated disposable test password |

Variable handling rules:

- Keep `.env.local` uncommitted.
- Keep `.env.example` committed with non-secret placeholders or safe example
  values.
- Configure Vercel variables in Project Settings for Production, Preview, and
  Development scopes.
- Use branch-specific Preview variables when a preview branch needs a dedicated
  Supabase project or Supabase branch.
- Redeploy Vercel after changing environment variables.
- Pull Vercel development variables locally only when that workflow is useful:

```bash
vercel env pull .env.local
```

## Vercel Deployment

Use Vercel as the production hosting target.

Recommended flow:

1. Connect the repository to a Vercel project.
2. Set the production branch, typically `main`.
3. Configure the required Supabase environment variables in Vercel Project
   Settings.
4. Use Vercel Preview Deployments for pull requests and non-production
   branches.
5. Deploy production only after migrations, tests, and preview validation pass.

Build command:

```bash
pnpm build
```

Vercel should install dependencies from `pnpm-lock.yaml`. Keep the lockfile
committed so builds are reproducible.

## Observability And Health Checks

Use the V1 baseline in [Analytics and observability plan](observability-plan.md):

- Write structured server-side logs for unexpected server action and route
  handler failures.
- Use Vercel runtime logs as the first place to inspect deployed application
  errors.
- Use Supabase Auth and Postgres logs to inspect failed authentication,
  database, and RLS operations.
- Treat a deployment as healthy only after the app loads, authenticated
  dashboard access works, core workout flows pass, and no new runtime errors
  appear during the post-deploy smoke check.

Defer external error tracking, log drains, and synthetic uptime checks until
production usage needs alerting or longer log retention.

## Database Migrations

The source of truth for schema changes is `supabase/migrations/`.

Current migration set:

- `202607180001_foundational_training_model.sql`
- `202607180002_profiles_rls.sql`
- `202607180003_profiles_display_name.sql`
- `202607180004_workout_session_state.sql`

Migration workflow:

1. Create migrations through the Supabase CLI rather than hand-inventing file
   names.
2. Reset or replay the local database to verify new migrations before review.
3. Keep migrations append-only after they have been applied to shared
   environments.
4. Apply migrations to preview/staging before production.
5. Run `pnpm test:rls` after RLS, grants, auth, or user-data access changes.
6. Record any manual production intervention in a release note or operations
   log.

Production deployment order:

1. Back up or export production data when the migration has meaningful data
   risk.
2. Apply Supabase migrations.
3. Run smoke checks against Supabase Auth and RLS.
4. Deploy the Vercel application.
5. Verify signup/login, dashboard access, and workout creation/completion.

## Seed Data

The StrongLifts 5x5 system program, exercises, exercise rules, templates, and
template exercises are currently seeded inside
`202607180001_foundational_training_model.sql` using idempotent inserts.

Keep this approach while the seed data is core application reference data.
Split optional demo data into `supabase/seed.sql` only when the app needs
sample users, sample sessions, or local-only walkthrough data.

Seed data rules:

- Production seed data must be deterministic and idempotent.
- Never seed real user data into preview or local environments.
- Demo users and throwaway workout history belong outside production
  migrations.

## Backup And Export Expectations

Production data should be treated as user-owned training history.

Minimum expectations:

- Confirm Supabase automated backups are enabled for the production project and
  match the project's recovery needs.
- Take an explicit backup or export before risky migrations, bulk data updates,
  destructive deletes, or auth/user-table changes.
- Test restoration or import periodically in a non-production project.
- Keep ad hoc exports encrypted and out of the repository.
- Document who requested the export, when it was created, where it is stored,
  and when it should be deleted.

User-facing export expectations:

- Plan for per-user workout history export before broad production usage.
- Export formats should include a machine-readable format such as CSV or JSON.
- Exports must stay scoped to the authenticated user unless performed by a
  trusted admin workflow with an audit trail.

## Release Checklist

Before production release:

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Supabase migrations applied to preview/staging.
- RLS smoke test passed against the target database when policies changed.
- Vercel Preview Deployment reviewed.
- Production environment variables confirmed.
- Backup/export completed if the release changes existing data.
- Production smoke test completed after deployment.
- Vercel runtime logs checked for new production errors after smoke testing.

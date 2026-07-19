# Analytics And Observability Plan

Project Renascor starts with a small V1 observability baseline: structured
runtime logs, Vercel deployment health checks, Supabase inspection workflows,
and privacy-conscious usage signals. The goal is to make failures diagnosable
without adding a heavy monitoring stack before the product needs one.

## V1 Decisions

| Area | V1 Choice |
| --- | --- |
| Error logging | Structured `console.error` logs from server actions and route handlers |
| Debug logging | Structured `console.info` logs for important workflow boundaries only |
| Usage analytics | Vercel Web Analytics when production traffic begins |
| Performance health | Vercel Speed Insights when production traffic begins |
| Database/API inspection | Vercel runtime logs plus Supabase dashboard logs and table/query checks |
| Health endpoint | `GET /api/health` for config and Supabase reachability checks |
| External error tracker | Defer until real production usage or recurring unknown failures |

Do not log passwords, tokens, full email addresses, Supabase service role keys,
session cookies, or raw request bodies.

## Structured Log Shape

Server-side logs should be single-line JSON so Vercel logs can be filtered and
copied into investigations.

Recommended fields:

| Field | Example | Notes |
| --- | --- | --- |
| `level` | `"info"` or `"error"` | Match the console method |
| `event` | `"workout.create.failed"` | Stable event name |
| `route` | `"/dashboard"` | Page, route handler, or server action area |
| `operation` | `"createWorkout"` | Function or operation name |
| `userId` | Supabase Auth user id | Include only after authentication succeeds |
| `workoutId` | Workout UUID | Include relevant entity IDs |
| `durationMs` | `42` | Useful around database-heavy operations |
| `error` | `"duplicate key value..."` | Message only |
| `code` | Supabase/Postgres error code | Include when the client exposes it |

Example:

```ts
console.error(
  JSON.stringify({
    level: "error",
    event: "workout.create.failed",
    route: "/dashboard",
    operation: "createWorkout",
    userId,
    durationMs: Date.now() - startedAt,
    error: error instanceof Error ? error.message : String(error),
  }),
);
```

For expected user errors, return a friendly `ActionResult` or redirect message.
For unexpected operational errors, log the structured context and then return a
safe user-facing message.

## Error Logging Baseline

Log unexpected failures in:

- Auth server actions: signup, login, logout.
- Auth callback route: code exchange failures.
- Workout server actions: create, start, pause, discard, set updates, rest
  timers, completion, progression, history, chart data, and settings.
- Any future API route handlers, webhooks, import jobs, or export jobs.

Each log should answer:

- What operation failed?
- Which authenticated user or entity was involved?
- Was this a Supabase Auth, Postgres, RLS, validation, or application error?
- How long did the operation run before failing?

Avoid high-volume logs inside per-set loops unless investigating a specific
incident. Log the enclosing operation with counts instead.

## Basic Usage And Debug Logs

V1 usage logs should be sparse and operational:

- Account signup requested and completed.
- Login failed or completed.
- Workout created, completed, discarded, or progression applied.
- Settings updated.
- Export/import jobs started or completed when those features exist.

These are not product analytics yet. They are operational breadcrumbs for
debugging support reports and release validation.

When product analytics becomes useful, add Vercel Web Analytics and track only
coarse events such as:

- `signup_completed`
- `workout_created`
- `workout_completed`
- `progression_applied`
- `manual_deload_applied`

Do not send personal notes, exercise notes, emails, or raw workout details to
analytics events.

## Inspecting Failed API Or Database Operations

Use this order when debugging production or preview failures:

1. Identify the deployment and approximate timestamp from the user report,
   Vercel deployment page, or release notes.
2. Open the Vercel deployment logs and filter for `level:error`, the stable
   event name, user id, or entity id.
3. Check whether the failure came from Supabase Auth, Postgres, RLS, network
   timeout, or application validation.
4. In Supabase, inspect Auth logs for signup/login/callback failures.
5. In Supabase, inspect Postgres logs and the relevant table rows using the
   authenticated user's id or affected entity id.
6. If RLS is suspected, reproduce against a preview/staging project and run
   `pnpm test:rls` after any policy change.
7. Record the cause and fix in the release note or issue that tracks the
   incident.

Useful local checks:

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:rls
```

Useful Vercel checks:

```bash
vercel logs <deployment-url> --level error --since 1h
vercel logs <deployment-url> --follow
```

## Deployment Health

`GET /api/health` returns a small JSON health payload for deployment smoke
checks and uptime monitors. It verifies required Supabase environment variables
and performs a lightweight read against Supabase reference data using the
publishable key only.

Healthy response:

```json
{
  "status": "ok",
  "service": "project-renascor",
  "timestamp": "2026-07-19T00:00:00.000Z",
  "checks": {
    "env": { "status": "ok" },
    "supabase": { "status": "ok", "durationMs": 42 }
  }
}
```

If any check fails, the route returns HTTP `503` with `status: "degraded"` and
logs a structured `health.supabase.failed` event for Supabase query failures.
The response must never include secrets, tokens, cookies, or user data.

A deployed app is considered healthy when:

- Vercel deployment status is ready.
- `GET /api/health` returns HTTP `200` with `status: "ok"`.
- The latest production deployment has no new runtime errors after initial
  smoke testing.
- Signup/login works against the target Supabase project.
- Protected dashboard access works for an authenticated user.
- Creating, updating, completing, and viewing a workout works.
- Supabase migrations are applied to the target database.
- RLS smoke tests pass when policies or user-owned data access changed.

Post-deploy smoke check:

1. Open the production URL.
2. Open `/api/health` and confirm HTTP `200` with `status: "ok"`.
3. Sign up or log in with a test account for that environment.
4. Confirm `/dashboard` loads.
5. Create or resume a workout.
6. Update a set and complete or discard the workout.
7. Check Vercel runtime logs for new errors.
8. Check Supabase Auth/Postgres logs if anything failed.

## Upgrade Path

Add these only when the app has enough production usage to justify them:

- Vercel Web Analytics for page views and coarse product events.
- Vercel Speed Insights for Core Web Vitals by route.
- Sentry or another error tracker for alerting, stack traces, releases, and
  source maps.
- Vercel Log Drains or an observability vendor when logs need retention,
  alerting, dashboards, or cross-service correlation.
- Synthetic uptime checks once the production URL is stable and meaningful to
  external users.

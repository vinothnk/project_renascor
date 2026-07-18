# Tech Stack Decisions

This document records the default technical choices for Project Renascor. The
goal is to keep the stack small, production-ready, and aligned with the current
codebase.

## Summary

| Area | Decision |
| --- | --- |
| Frontend framework | Next.js App Router with React and TypeScript |
| Backend/API approach | Next.js Server Components, Server Actions, and Route Handlers |
| Database | Supabase Postgres |
| Auth | Supabase Auth with SSR cookie handling |
| Data access | Supabase client first; no ORM for now |
| Charting | Recharts when dashboard charts are needed |
| UI component library | Tailwind CSS first; add shadcn/ui selectively |
| Deployment target | Vercel |
| Testing tools | ESLint, TypeScript, Supabase RLS smoke tests; add Vitest and Playwright as flows grow |

## Decisions

### Frontend Framework

Use Next.js App Router with React and TypeScript.

Rationale:

- The project already uses Next.js, React, TypeScript, and the `src/app`
  directory structure.
- App Router gives the app a clean path for protected pages, server-rendered
  data loading, server actions, and route handlers without introducing a
  separate frontend/backend split.
- TypeScript is important for domain rules such as workouts, set statuses,
  progression decisions, and load units.

### Backend/API Approach

Use Next.js as the application backend.

Default to:

- Server Components for authenticated data reads that render pages.
- Server Actions for form-based mutations such as login, logout, signup, and
  workout updates.
- Route Handlers for API-shaped integration points, callbacks, webhooks, or
  client-side fetch endpoints.

Avoid adding a separate API service until there is a clear operational need,
such as background processing, mobile clients with separate versioning, or
heavy computation outside the request lifecycle.

### Database

Use Supabase Postgres.

Rationale:

- The domain model needs relational consistency: programs, templates,
  exercises, workout sessions, sets, failures, deloads, and progression
  decisions.
- Supabase gives the project managed Postgres, Auth, migrations, and row-level
  security in one platform.
- The existing migrations and RLS smoke test already assume Supabase.

Security baseline:

- Enable RLS on every exposed table.
- Keep athlete-owned rows scoped by `user_id`.
- Never expose the service role key to browser code.
- Keep authorization data out of user-editable metadata.

### ORM Or Direct Supabase Client

Use the Supabase JavaScript client directly for now.

Rationale:

- Supabase Auth and RLS are central to the app, and the direct client keeps
  those mechanics visible.
- The current schema is relational but not yet large enough to justify ORM
  complexity.
- Generated database types can provide strong TypeScript coverage without
  adding a query abstraction too early.

Revisit this if query composition becomes repetitive, cross-table writes become
hard to reason about, or the app needs a richer server-side repository layer.

### Charting Library

Use Recharts when charts are introduced.

Rationale:

- The app will need clear training progress charts: load over time, volume,
  completion rates, failures, and deload events.
- Recharts fits React dashboards well and keeps common chart types simple.
- It is lighter to adopt incrementally than a lower-level visualization stack.

Do not install it until the first real chart is being built.

### UI Component Library

Use Tailwind CSS as the base styling system and add shadcn/ui selectively.

Rationale:

- Tailwind is already installed.
- The app is an operational training dashboard, so it benefits from restrained,
  consistent, scannable UI rather than a heavy visual framework.
- shadcn/ui is useful for accessible primitives such as dialogs, dropdowns,
  tabs, forms, toasts, and tables, but should be added component-by-component
  when those controls are needed.

### Deployment Target

Deploy to Vercel.

Rationale:

- The project is a Next.js app and Vercel is the lowest-friction production
  target.
- Vercel works naturally with App Router, Server Actions, Route Handlers,
  environment variables, and preview deployments.
- Supabase remains the managed data and auth layer.

Production environments must include:

- Supabase project URL.
- Supabase publishable key.
- Any server-only keys needed by smoke tests or operational scripts, kept out
  of public client bundles.

### Testing Tools

Keep the current baseline:

- TypeScript compilation for type safety.
- ESLint for static checks.
- Supabase RLS smoke tests for user-data isolation.

Add next:

- Vitest for domain logic such as progression, deload, and workout-state rules.
- React Testing Library for focused component behavior where useful.
- Playwright for critical flows: signup, login, protected dashboard access,
  start workout, complete workout, and chart visibility.

Testing should grow around risky behavior first: progression math, RLS,
authentication, and workout completion flows.

## Deferred Choices

These are intentionally not chosen yet:

- Background jobs: defer until progression reminders, scheduled summaries, or
  async imports require them.
- Analytics platform: defer until production usage needs product analytics.
- Mobile app framework: defer until the web workout flow proves the core UX.
- State management library: defer; prefer server data plus local React state
  until shared client state becomes painful.

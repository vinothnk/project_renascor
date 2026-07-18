This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Product Design

- [Tech stack decisions](docs/tech-stack-decisions.md) records the explicit
  framework, database, API, UI, charting, deployment, and testing choices.
- [Domain and data model](docs/domain-and-data-model.md) separates the app's training concepts from the Supabase/Postgres storage model.
- [Domain ER diagram](docs/domain-er-diagram.md) shows the conceptual relationships between training entities and events.
- [Database ER diagram](docs/database-er-diagram.md) shows the proposed Supabase/Postgres table relationships.

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

## Security Smoke Tests

The RLS smoke test creates two confirmed Supabase Auth users, signs in as each
user through the publishable key, and verifies that private training rows cannot
cross user boundaries.

Add the following to `.env.local` before running it:

```bash
SUPABASE_SERVICE_ROLE_KEY=
RLS_TEST_USER_A_EMAIL=rls-athlete-a@example.com
RLS_TEST_USER_B_EMAIL=rls-athlete-b@example.com
RLS_TEST_USER_PASSWORD=Renascor-rls-test-2026!
```

Then run:

```bash
pnpm test:rls
```

The service-role key is used only for test setup and cleanup. Application code
must continue using the publishable key.

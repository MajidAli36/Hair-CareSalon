# Salon — Salon Management SaaS

Multi-tenant salon management platform built with Next.js and Supabase.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** (Auth, PostgreSQL, RLS, Storage)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 3. Set up Supabase

**Recommended** — uses `DATABASE_URL` from `.env.local` (no CLI login required):

```bash
npm run db:push
```

This applies all files in `supabase/migrations/` in order.

**Alternative** — Supabase CLI (requires login + link):

```bash
npx supabase login
npm run db:link
npx supabase db push
```

Your project ref is in `NEXT_PUBLIC_SUPABASE_URL` (e.g. `demxgsbuppklniszfqvw`).

Or run locally:

```bash
supabase start
supabase db reset
```

### 4. Create your first user and organization

1. Create a user via Supabase Auth (Dashboard → Authentication → Users)
2. Seed your organization using `supabase/seed.sql`

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Security

- Tenant isolation enforced via Supabase RLS
- `organization_id` resolved server-side from membership — never trusted from the browser
- Service role key is server-only
# Hair-CareSalon

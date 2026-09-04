<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Overview

Full-stack web app for trail running group management, workout planning, and runner metrics (El Parque Team App).

The product has two main experiences:

- **Coach dashboard:** athletes, groups, training goals, periodized plans, sessions, and monthly/weekly calendars.
- **Athlete mobile view:** current week, group-prescribed sessions, instructions, volume, and location through Home and `/plan`.

The current implementation is an authenticated-product prototype: user/team context still uses fixed development IDs until authentication and tenant resolution are introduced.

## Technology Baseline

- Next.js 16 App Router, React 19, TypeScript 6, and pnpm 11.
- Tailwind CSS 4 and Shadcn UI (`base-nova`).
- `next-intl` with Spanish as the default locale and English as the secondary locale.
- Drizzle ORM with SQLite for the current local application runtime.
- A parallel PostgreSQL schema and migrations prepared for Supabase.
- Node's test runner through `tsx` for domain and parsing tests.

## Commands

- `pnpm dev` — Start development server with Turbopack
- `pnpm build` — Build for production (also generates `.next/types` required for strict TS validation)
- `pnpm lint` — Run ESLint
- `pnpm test` — Run automated tests
- `pnpm exec tsc --noEmit` — Run TypeScript type-checking
- `pnpm db:push` — Apply the SQLite schema in local development
- `pnpm db:seed` — Populate relative-date local demo data
- `pnpm db:generate:supabase` — Generate a PostgreSQL migration for Supabase
- `pnpm db:check:supabase` — Validate the Supabase migration journal
- `pnpm db:migrate:supabase` — Apply pending migrations to Supabase
- `pnpm db:verify:supabase` — Verify remote tables and RLS status

## Architecture & Directory Structure

- `app/[locale]/` — Localized App Router pages (`es` default, `en` secondary via `next-intl`, prefix: `as-needed`)
  - `app/[locale]/(mobile)/` — Mobile shell layout & core views (Home, Plan, Stats, Profile)
- `features/` — Feature-driven modules (`workouts/`, `profile/`, etc.) containing components and feature hooks
- `app/actions/` — Server actions for athletes, groups, goals, plans, and sessions
- `db/schema.ts` — SQLite schema used by the application runtime
- `db/supabase/` — PostgreSQL schema, connection, and remote verification
- `drizzle/supabase/` — Reviewed SQL migrations and Drizzle migration metadata
- `lib/` — Core domain logic (physiology, periodization, session prescriptions, weather, GPX parsers)
- `types/` — Shared TypeScript definitions
- `utils/` — Pure helper functions and date/formatting utilities
- `tests/` — Automated tests for critical domain flows

## Domain Model Decisions

- Planning is **group-first**, not athlete-first. `AthleteGroup` is the operational planning unit.
- Every `AthleteProfile` belongs to a team (`teamId` required) and may have a current group (`groupId` nullable FK to `athleteGroups`).
- `TrainingGoal` belongs to an individual athlete. A race is optional goal context; a race catalogue and athlete registration flow are future work.
- `memberships` reference `athleteProfiles`; group changes are recorded in `groupHistoryRecords` using group IDs.
- Athlete category and level are derived from the assigned group. They are TypeScript value objects/constants, not configurable database tables.
- The planning hierarchy is `GroupTrainingPlan -> Macrocycle -> Mesocycle -> Microcycle`.
- `Session` is the shared training event. `GroupSessionPrescription` specifies what each assigned group performs in that session and links it to the relevant microcycle.
- Never change a group's base plan to accommodate one athlete. Individual adjustments and dampened group-transition overrides are future domain features.
- The coach retains manual control: generated planning may propose values, but must not silently overwrite deliberate edits.

## Current Functional State

- Athlete management supports create/edit, group assignment/change, and group-history recording.
- Group management supports create/edit, duplicate, deactivate, and member listing.
- Training goals support optional race data and feed macrocycle generation.
- Planning generation creates and persists macrocycles, mesocycles, microcycles, target volumes, and taper phases when applicable.
- Persisted microcycles support volume, date, type, and notes edits.
- Session create/edit requires at least one group prescription and preserves form data after validation errors.
- Coach calendars provide monthly and weekly views, group filters, session cards, and session details.
- Athlete Home and `/plan` resolve sessions from the athlete's current group prescriptions.
- Session deletion is not implemented yet.

## Database Environments

- SQLite remains the active runtime database during local development.
- Supabase/PostgreSQL is provisioned as a parallel target, but the application runtime has **not** been switched to PostgreSQL yet.
- `SUPABASE_DIRECT_URL` is for migrations (direct connection or session pooler on port 5432).
- `SUPABASE_DATABASE_URL` is for the Vercel/serverless runtime (transaction pooler on port 6543, prepared statements disabled).
- Both variables are server-only secrets. Never prefix them with `NEXT_PUBLIC_`, commit `.env.local`, or print their values.
- The initial Supabase migration creates 19 tables with RLS enabled. Policies and production authentication/authorization still need to be designed before exposing data through the Data API.
- SQLite server actions currently use synchronous query APIs. Moving runtime access to PostgreSQL requires an intentional asynchronous repository/data-access migration; do not swap the driver mechanically.

## Known Transitional Constraints

- Development context still contains fixed IDs such as `team_1` and `profile_user_1`; do not spread additional hardcoded identity assumptions.
- Seed dates are generated relative to the current date so Home and `/plan` remain testable over time.
- Microcycles are consecutive, but session forms currently ask the coach to select one manually. Automatic microcycle inference belongs to the next planning-automation epic.
- Intensity method defaults and propagation across groups are also future automation work; preserve the current manual override capability.
- Keep individual session overrides out of the group plan until their dedicated domain design is implemented.

## Key Conventions & Gotchas

- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) combined with Shadcn UI primitives (`base-nova` style).
- **Internationalization:** Uses `next-intl`. Ensure new strings or localized messages are added to `messages/es.json` and `messages/en.json`.
- **Type Checking:** Run `pnpm exec tsc --noEmit` after modifying types or routes. `.next/types/` validates route parameters.
- **Next.js documentation:** Preserve the generated rules block at the top of this file and consult the installed Next.js documentation before relying on remembered APIs.
- **Date handling:** Store domain dates as ISO date strings where the schema expects them and avoid accidental UTC shifts in calendar views.
- **Scope:** Do not implement work assigned to a future epic as an incidental refactor. Record it under known constraints instead.

## Delivery Workflow

- Work in a story branch and keep commits aligned with the current task.
- Before each task commit, provide focused manual checks for the affected UI flow.
- Run `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` in proportion to the change; build is mandatory before release-oriented merges.
- Existing lint warnings should not be multiplied. New code must introduce no lint errors.
- Push the story branch, validate the Vercel deployment, and only then merge it into `dashboard`.
- Keep documentation-only changes in a separate commit when possible.

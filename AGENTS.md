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

## Context-efficient workflow

- Start with `docs/README.md` and the single current file under `docs/handoffs/`. Do not reconstruct completed stories from old chats or deleted handoffs when architecture/history/Jira already contain the durable context.
- H10 (`KAN-204`) is in final validation on `h-19-competitive-adjustment`; `KAN-223` is the remaining task. Start from `docs/handoffs/epic-2-h10.md` and `docs/architecture/competitive-adjustment.md`.
- Superseded handoffs are intentionally deleted once durable information is consolidated into `docs/history/` and `docs/architecture/`. Do not recreate H6-H9 handoffs merely for historical reference.
- Use `rg` to locate symbols and read bounded sections of relevant files. Avoid rereading whole directories after a localized change.
- Use `C:\Users\lahoz\.local\bin\rtk.exe` explicitly for noisy read-only commands such as `git status`, `git diff`, and focused test output when it preserves the information needed for review. Do not require RTK for contributors or CI.
- Keep Codebase Memory optional. Never make builds, tests, or repository behavior depend on a local index or MCP server.
- H10 was delivered remote-first through GitHub/Jira; the complete local story gate is mandatory before `KAN-223` / H10 can close or merge.
- Update durable architecture docs only when a domain decision changes. Keep the current handoff operational and concise; do not store full conversation transcripts.

## Architecture & Directory Structure

- `app/[locale]/` — Localized App Router pages (`es` default, `en` secondary via `next-intl`, prefix: `as-needed`)
  - `app/[locale]/(mobile)/` — Mobile shell layout & core views (Home, Plan, Stats, Profile)
- `features/` — Feature-driven modules (`workouts/`, `profile/`, etc.) containing components and feature hooks
- `app/actions/` — Server actions for athletes, groups, goals, plans, sessions, and competition-calendar operations
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
- `TrainingGoal` belongs to an individual athlete. Its race fields are legacy/individual context and are not the live competitive source for group periodization; a public race catalogue and athlete registration flow remain future work.
- Live competitive planning context is owned by plan-scoped `CompetitionEntry` records. A/B/C priorities and explicit lifecycle state determine which events are relevant to planning.
- `Macrocycle.targetRace*` is a historical snapshot of the primary competition used for an accepted generation/revision, not the live race entity. Live calendar edits must not silently rewrite that snapshot.
- `CompetitionContext` is the pure competitive boundary consumed by periodization; new competitive behavior must not depend directly on Drizzle or `goalType === 'race'`.
- H10 treats taper/recovery as local competitive adjustments. Competition priority controls planning treatment; physiological event demand remains a separate concern.
- Taper duration is modeled in days in H10 policy. Do not extend the legacy closed `0 | 2 | 3` week model with new competitive rules.
- Course demand, pre-competition training load, taper decision and post-competition recovery are distinct concepts. Do not collapse them into one generic score.
- Future GPX/FIT course analysis belongs upstream of competitive-adjustment policy. Taper/recovery policies consume assessed course demand, not track-file formats.
- Competitive adjustment is proposal-first: pure policy -> local proposal -> protected-state reconciliation -> coach review -> local reconciliation/audit write set.
- Generated values may be regenerated; explicit coach/manual values, protected microcycles, objectives and sessions must never be silently overwritten.
- Race-week prescribed training is structurally separate from competition exposure. Derived total exposure is reporting data, not a training target.
- `memberships` reference `athleteProfiles`; group changes are recorded in `groupHistoryRecords` using group IDs.
- Athlete category and level are derived from the assigned group. They are TypeScript value objects/constants, not configurable database tables.
- The planning hierarchy is `GroupTrainingPlan -> Macrocycle -> Mesocycle -> Microcycle`.
- `Session` is the shared training event. `GroupSessionPrescription` specifies what each assigned group performs in that session and links it to the relevant microcycle.
- Never change a group's base plan to accommodate one athlete. Individual adjustments and dampened group-transition overrides are future domain features.
- The coach retains manual control: generated planning may propose values, but must not silently overwrite deliberate edits.

## Current Functional State

- Athlete management supports create/edit, group assignment/change, and group-history recording.
- Group management supports create/edit, duplicate, deactivate, and member listing.
- Training goals retain optional race data for individual and legacy compatibility, while new competitive planning uses `CompetitionEntry`/`CompetitionContext`.
- Planning generation creates and persists macrocycles, mesocycles, microcycles and target loads. Legacy taper generation still exists as compatibility, while H10 competitive-adjustment policies provide the new pure/local domain path.
- H10 supports course-demand assessment, reached pre-competition load context, taper duration in days, progressive volume/D+ reduction, intensity preservation, A/B/C proposals, race-week load separation, post-race recovery, overlap resolution, protected planning, coach review and local reconciliation/audit artifacts.
- Persisted microcycles support volume, date, type, and notes edits.
- Session create/edit requires at least one group prescription and preserves form data after validation errors.
- Coach calendars provide monthly and weekly views, group filters, session cards, and session details.
- Athlete Home and `/plan` resolve sessions from the athlete's current group prescriptions.
- Planning cohorts subdivide one sporting group temporarily without changing athlete category or level. Coach flows support cohort management and dated memberships, while athlete planning resolution uses the applicable cohort variant first and the group base plan as fallback.
- Competition calendars support plan-scoped entries, A/B/C priorities, explicit lifecycle transitions, rescheduling/cancellation without history loss, and derived category-distance advisories.
- `CompetitionContext` is the pure boundary consumed by periodization. `Macrocycle.targetRace*`, including `targetRaceDate`, remains an immutable-by-default historical snapshot updated only by explicit planning persistence.
- Session deletion is not implemented yet.

## Database Environments

- SQLite remains the active runtime database during local development.
- Supabase/PostgreSQL is provisioned as a parallel target, but the application runtime has **not** been switched to PostgreSQL yet.
- `SUPABASE_DIRECT_URL` is for migrations (direct connection or session pooler on port 5432).
- `SUPABASE_DATABASE_URL` is for the Vercel/serverless runtime (transaction pooler on port 6543, prepared statements disabled).
- Both variables are server-only secrets. Never prefix them with `NEXT_PUBLIC_`, commit `.env.local`, or print their values.
- The current Supabase schema/migration chain contains 26 tables as of H9. Production policies and authentication/authorization still need to be designed before exposing data through the Data API.
- SQLite server actions currently use synchronous query APIs. Moving runtime access to PostgreSQL requires an intentional asynchronous repository/data-access migration; do not swap the driver mechanically.

## Known Transitional Constraints

- Development context still contains fixed IDs such as `team_1` and `profile_user_1`; do not spread additional hardcoded identity assumptions.
- Seed dates are generated relative to the current date so Home and `/plan` remain testable over time.
- Microcycles are consecutive, but session forms currently ask the coach to select one manually. Automatic microcycle inference belongs to the next planning-automation epic.
- Intensity method defaults and propagation across groups are also future automation work; preserve the current manual override capability.
- Keep individual session overrides out of the group plan until their dedicated domain design is implemented.
- Cohort session prescriptions, race registration, and automatic cohort proposals remain future work; do not infer them from the H7/H9 foundations.
- Legacy plans may still carry `goalType = race` and `Macrocycle.targetRace*` without `CompetitionEntry` rows. Compatibility is isolated in `lib/periodization/legacy-competition-context.ts`; do not expand that fallback into new domain authority or reintroduce legacy goal type as the primary competitive trigger.
- Distance and elevation units must be explicit in newly modified domain contracts. Prefer names such as `distanceKm`, `elevationGainM`, `elevationLossM`, `durationMinutes`, and `achievedPeakElevationGainM`.
- Do not reuse trail course-effort mathematics as a generic training-load formula. Volume and elevation remain separate training-load dimensions unless a future evidence-backed load model is introduced.
- A competition reschedule, reprioritization or cancellation must produce a fresh local competitive proposal; it must not trigger whole-macrocycle regeneration by default.
- Cancellation before race realization must not invent post-race recovery. Already-realized planning effects must not be silently erased.

## Key Conventions & Gotchas

- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) combined with Shadcn UI primitives (`base-nova` style).
- **Internationalization:** Uses `next-intl`. All new user-visible product copy must be added to both `messages/es.json` and `messages/en.json` in the same change. When substantially modifying an existing user-facing flow, migrate the directly affected hard-coded legacy copy progressively; do not broaden the task into unrelated translation cleanup. Treat missing `es`/`en` messages as incomplete implementation. See `docs/architecture/internationalization-policy.md`.
- **Type Checking:** Run `pnpm exec tsc --noEmit` after modifying types or routes. `.next/types/` validates route parameters.
- **Next.js documentation:** Preserve the generated rules block at the top of this file and consult the installed Next.js documentation before relying on remembered APIs.
- **Date handling:** Store domain dates as ISO date strings where the schema expects them and avoid accidental UTC shifts in calendar views.
- **Scope:** Do not implement work assigned to a future epic as an incidental refactor. Record it under known constraints instead.

## Documentation Standard

- Apply JSDoc incrementally to new code and to existing code that receives a substantial modification. Do not pause feature work to document unrelated legacy code.
- Document exported domain functions, important domain interfaces and types, and operations with persistence or other side effects when their contract is not fully evident from the signature.
- State units and ranges for training values such as kilometers, elevation meters, minutes, and percentages.
- Record relevant invariants, expected errors, and preservation rules, especially for load limits, deloads, manual coach changes, regeneration, and protected planning blocks.
- Explain domain intent and non-obvious decisions. Do not add comments that merely restate the implementation, document trivial accessors, or duplicate information already expressed clearly by names and types.
- Keep documentation synchronized in the same task when a documented contract changes.
- TypeDoc and Storybook adoption, along with retrospective documentation of existing code, belongs to the dedicated documentation story in Epic 7.

## Delivery Workflow

- Work in a story branch and keep commits aligned with the current task.
- During implementation, prefer focused tests plus type checking and linting of the affected area where execution is available.
- Run `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` before every story merge regardless of earlier task validation.
- For H10 final validation also run `pnpm db:check:supabase`; generate/apply a migration only if a real schema delta exists.
- Existing lint warnings should not be multiplied. New code must introduce no lint errors or new warnings.
- Push the story branch, validate the Vercel deployment when quota permits, and only then merge it into `dashboard`.
- Keep documentation-only changes in separate commits when practical.

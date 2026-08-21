<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Overview

Full-stack web app for trail running group management, workout planning, and runner metrics (El Parque Team App).

## Commands

- `pnpm dev` — Start development server with Turbopack
- `pnpm build` — Build for production (also generates `.next/types` required for strict TS validation)
- `pnpm lint` — Run ESLint
- `pnpm exec tsc --noEmit` — Run TypeScript type-checking

## Architecture & Directory Structure

- `app/[locale]/` — Localized App Router pages (`es` default, `en` secondary via `next-intl`, prefix: `as-needed`)
  - `app/[locale]/(mobile)/` — Mobile shell layout & core views (Home, Plan, Stats, Profile)
- `features/` — Feature-driven modules (`workouts/`, `profile/`, etc.) containing components and feature hooks
- `lib/` — Core domain logic (physiology, periodization, weather, GPX parsers)
- `types/` — Shared TypeScript definitions
- `utils/` — Pure helper functions and date/formatting utilities

## Key Conventions & Gotchas

- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`) combined with Shadcn UI primitives (`base-nova` style).
- **Internationalization:** Uses `next-intl`. Ensure new strings or localized messages are added to `messages/es.json` and `messages/en.json`.
- **Type Checking:** Run `pnpm exec tsc --noEmit` after modifying types or routes. `.next/types/` validates route parameters.

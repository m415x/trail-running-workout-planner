# Epic 2 — Planning Automation handoff

## Status

Epic 2 (H1–H12) is at closure. H12 is `KAN-242` on branch `h-21-readiness-assessment`.

Durable domain context lives in `docs/architecture/`; historical evolution is consolidated in `docs/history/epic-2.md`. This handoff intentionally contains only operational closure context.

## Durable outcome

Epic 2 established a coach-controlled automation pipeline:

```text
planning intent / group baseline
→ generated periodization and sessions
→ protected coach ownership/provenance
→ planning cohorts and athlete temporal resolution
→ competition calendar/context
→ competitive taper/recovery adjustment
→ integral review + scoped/idempotent persistence
→ individual realized-training readiness assessment
```

H12 keeps category compatibility (H8), competitive treatment (H10) and individual readiness mismatches separate. `unknown != 0`; planned training is not realized training; no-record is not missed training; zero alerts is not certification of readiness.

## H12 persistence

Supabase migration `0012_clammy_firedrake.sql` adds:

- `workout_log_evidence`;
- `readiness_evaluations`;
- `readiness_reviews`.

Remote verification after migration: **28/28 application tables and 28/28 with RLS**.

Supabase Data API is intentionally disabled in the current project. Repeated Postgres log entries for `pg_pgrst_no_exposed_schemas` are therefore infrastructure noise from disabled PostgREST exposure, not an H12 schema failure.

## Validation policy

Workflow is remote-first. Focused checks are used during implementation; local execution is required early only when it blocks progress (for example migration generation/application). Story closure requires the project gate plus functional/manual walkthrough.

Known lint baseline entering H12: **0 errors / 11 warnings**. New warnings are not accepted silently.

## Remaining closure work

Before transitioning `KAN-242` and Epic 2 to Finalizada:

1. finish KAN-255 integration/regression evidence;
2. finish KAN-256 documentation consolidation;
3. run final local H12 gate: `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build`;
4. run the H12 functional/manual walkthrough;
5. record evidence in Jira;
6. merge the story branch into `dashboard` after the agreed branch/CI review.

Do not declare the epic closed before those final evidence steps are real.

## Next

After closure, review the originally proposed Epic 3 against the current H6–H12 architecture before creating/starting new implementation work. Replace this handoff with the Epic 3 operational handoff once that scope is approved.

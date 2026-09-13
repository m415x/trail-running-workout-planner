# Epic 2 — Planning Automation handoff

## Status

Epic 2 (H1–H12) is complete. H12 is `KAN-242` on branch `h-21-readiness-assessment` and all H12 subtasks are Finalizada.

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

## Final validation evidence

H12 closure evidence:

- `pn test`: **557/557 pass**, 104 suites, 0 fail;
- `pn lint`: **0 errors / 11 warnings**, matching the approved baseline;
- `pn exec tsc --noEmit`: **OK**;
- `pn build`: **OK**;
- Supabase verifier: **28/28 application tables and 28/28 with RLS**;
- functional/manual H12 walkthrough: **confirmed satisfactory by the user**.

Workflow remains remote-first for future work: focused checks during implementation, local/environment-specific execution when required to unblock work, and a complete gate plus walkthrough at story closure.

## Next

Review the originally proposed Epic 3 against the current H6–H12 architecture before creating or starting implementation work. Replace this handoff with the Epic 3 operational handoff once that scope is approved.

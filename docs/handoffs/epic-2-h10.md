# Handoff — Epic 2 / H10: Competitive adjustment

## Status

- Story: `KAN-204` — H10: Refinar taper y reajustar ventanas competitivas.
- Branch: `h-19-competitive-adjustment`.
- Base: `dashboard` after H9.
- Tasks `KAN-205` through `KAN-222`: completed.
- Current task: `KAN-223` — final competitive regression and story validation.
- Delivery mode: remote-first. The branch is now prepared for the mandatory local story gate.

## What H10 established

H10 replaces the authority of the legacy `0 | 2 | 3`-week taper heuristic with a pure local competitive-adjustment domain. Durable details live in `docs/architecture/competitive-adjustment.md`; historical rationale is consolidated in `docs/history/epic-2-h10.md`.

Key boundaries:

- `CompetitionEntry` remains the live plan-scoped calendar source from H9.
- `CompetitionContext` remains the pure competitive input to planning.
- priority A/B/C controls planning treatment, not physiological event cost;
- taper duration is modeled in days;
- course demand, pre-competition load, taper and recovery remain distinct concepts;
- volume and D+ remain separate training-load dimensions;
- race-week training is separate from competition exposure;
- recovery is explicit and survives lower-priority planning overlaps;
- protected/manual coach state is never silently overwritten;
- coach review records accepted/generated versus explicitly adjusted/coach provenance;
- reconciliation emits only patches inside the accepted competitive window plus audit records for actual changes;
- date/priority/lifecycle changes create a fresh local proposal rather than whole-macrocycle regeneration.

Future GPX/FIT course analysis may enrich `CourseProfile` with D−, gradients, altitude, climbs/descents, technicality and expected duration. Competitive-adjustment policy must remain independent of track-file parsing.

## Regression coverage before local gate

Focused tests now cover the H10 minimum scenarios across the periodization suite, including:

- no active A competition;
- short A and ultra-scale A taper behavior;
- high-D+ specificity;
- B in development and recovery contexts;
- C as a specific/quality stimulus;
- overlapping competitions and protected recovery;
- training/race load separation;
- cancelled competitions excluded from active context without deleting history;
- protected/manual planning;
- coach review/provenance;
- local reconciliation/audit scope;
- rescheduling shifting the impact window;
- B -> A promotion rebuilding a larger priority-specific impact window.

KAN-223 added explicit impact-window recalculation coverage in `tests/periodization/competition-impact-window.test.ts`.

## Required local gate

Pull `h-19-competitive-adjustment` and run:

```bash
pn test
pn lint
pn exec tsc --noEmit
pn build
pn db:check:supabase
```

If schema/migration files changed after the last validated H9 migration, also run the relevant generation/migration verification commands before merge. Do not create an unnecessary migration when Drizzle reports no schema delta.

Report the complete output of any failing command. Existing lint warnings may remain if they are the known baseline, but H10 must introduce no lint errors/new warnings.

## After a green gate

1. fix any regressions revealed locally and rerun the affected/full gate;
2. update Jira `KAN-223` with final evidence and transition it to Finalizada;
3. close `KAN-204` only after the full story gate is green;
4. validate final Vercel deployment when the deployment rate limit permits it;
5. merge/fast-forward `h-19-competitive-adjustment` into `dashboard` following the normal delivery workflow.

## Context rule

This is the only handoff intentionally retained. H6-H9 handoffs were superseded and removed after their durable knowledge was consolidated in history and architecture documents. Start future work from `docs/README.md`, this handoff, Jira, and the referenced architecture files instead of reconstructing old chats.

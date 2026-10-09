# KAN-607 / KAN-704 — H5A closure handoff (pending)

## State and frozen scope

KAN-697 through KAN-703 delivered H5A SELF: authenticated EPT User, active Team/TeamMembership, non-delegable SELF capability, unique own AthleteProfile; effective plan/session, own realized-training read, manual free/linked capture and correction, Athlete UX. KAN-704/T8 remains open; **no PR or merge is authorized by this document**. See `docs/architecture/h5a-athlete-self-access.md` and `docs/architecture/athlete-page-state-pattern.md`.

## Evidence classification (do not merge categories)

| Class | Evidence | Status / SHA |
| --- | --- | --- |
| Executed / verified independently | GitHub comparison and branch HEAD read; branch was ahead of dev, no migration/schema changes in the reviewed diff | GitHub comparison at review time; not a CI gate |
| User-reported execution | `pn verify --db` PASS 6/6 (Tests, TypeScript, ESLint, Build, i18n, SQLite) | **Historical checkpoint only:** `6c706b3105f7fd3b152e055ec56275411fb3dcef` |
| User-reported execution | KAN-703 ALLOW → DENY → ALLOW, independent Athlete A/B, UI ES/EN and responsive checks; T8.1/T8.2 RED→GREEN focused cycles | Reported by user; source commits and outcomes documented in Jira KAN-704 |
| User-reported execution | Eight focused authorization/planning/capture/correction/SQLite isolation suites GREEN | Reported on `f3ef7c2cc6392cfa41429a2b922fe5e5f3690044` |
| Still pending | `pn verify --db` **PASS 6/6 on the exact post-documentation candidate SHA** | Required for T8; cannot borrow the historical gate |
| Still pending | Review post-documentation diff, PR toward dev, GitHub Actions, interactive zoom 200%, closure approval | Complete before merge |
| Still pending | Merge to dev, verify merge SHA, reconcile Jira and architecture/handoff against merge | Do not mark KAN-607 complete prematurely |

No gate result is transferred to a later SHA. If any functional change lands, evaluate impact and verify the new candidate; T8 specifically requires an integral 6/6 on the exact closure candidate.

## Recent micro-sprints and recoverable commits

- KAN-703 page-state CustomCard pattern documented in `docs/architecture/athlete-page-state-pattern.md`; dynamic direct access DENY and second athlete restoration visually accepted.
- T8.1 Home week navigation fail-closed: RED `0eccf9697e2bc42f77e7682a8e781a5a752adcf2`; implementation GREEN user-reported at `406d982846b1bce2cf3fddf6da5d75f7c3b9ca8b`.
- T8.2 Plan status/localization: RED `53ef1cb9c080c35a016bae81b61b9dd9ba6a6b66`; GREEN user-reported at `f3ef7c2cc6392cfa41429a2b922fe5e5f3690044`.
- Reviewed incremental diffs involved Athlete Home, week hook, Plan page, planning-week action, localized strings, and tests; no schema/Coach changes were introduced by T8.1/T8.2.

## Acceptance fixture and deferred debt

`scripts/provision-kan607-second-athlete.ts` is **local, explicit, idempotent, regenerable acceptance provisioning** for disposable seeded `sqlite.db` only. Its fixed subject, email, IDs, Team and group are fixture identifiers, not product contracts or authorization sources. See `docs/architecture/h5a-local-acceptance-fixture.md`. Never run in CI/production, on an important DB, or infer authority from fixture IDs.

Deleting realized-training records is **independent debt outside H5A**, not a missing AC for this story. Do not implement deletion in KAN-704.

## Next operator / fresh-chat checklist

Read `AGENTS.md`, `docs/agent-harness.md`, this handoff and KAN-704 Jira evidence. Confirm exact HEAD after documentation commit; review `git diff` against `f3ef7c2...` to exclude functional edits. Run `pn verify --db` and bind all 6 results to that **new exact SHA**. Only then prepare PR, inspect Actions, complete zoom 200% interactive acceptance, obtain explicit closure/merge approval, merge and reconcile against merge SHA. Use Git Bash locally.

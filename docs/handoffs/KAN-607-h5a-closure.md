# KAN-607 / KAN-704 — H5A closure handoff (merged)

## State and frozen scope

KAN-697 through KAN-703 delivered H5A SELF: authenticated EPT User, active Team/TeamMembership, non-delegable SELF capability, unique own AthleteProfile; effective plan/session, own realized-training read, manual free/linked capture and correction, Athlete UX. KAN-704/T8 and KAN-607 are **Finalizada** in Jira. PR #46 was merged into `dev` after explicit closure and Vercel-exception approval. Merge commit: `c40a9ce728860725c0179f0a4b1af7ac6745b403`. See `docs/architecture/h5a-athlete-self-access.md` and `docs/architecture/athlete-page-state-pattern.md`.

## Evidence classification (do not merge categories)

| Class | Evidence | Status / SHA |
| --- | --- | --- |
| Executed / verified independently | GitHub comparison and branch HEAD read; branch was ahead of dev, no migration/schema changes in the reviewed diff | GitHub comparison at review time; not a CI gate |
| User-reported execution | `pn verify --db` PASS 6/6 (Tests, TypeScript, ESLint, Build, i18n, SQLite) | **Historical checkpoint only:** `6c706b3105f7fd3b152e055ec56275411fb3dcef` |
| User-reported execution | KAN-703 ALLOW → DENY → ALLOW, independent Athlete A/B, UI ES/EN and responsive checks; T8.1/T8.2 RED→GREEN focused cycles | Reported by user; source commits and outcomes documented in Jira KAN-704 |
| User-reported execution | Eight focused authorization/planning/capture/correction/SQLite isolation suites GREEN | Reported on `f3ef7c2cc6392cfa41429a2b922fe5e5f3690044` |
| User-reported execution | `pn verify --db` **PASS 6/6 on the exact documented pre-merge candidate** | `245b374ae08176136705bca41379c0a4095553f6`; not asserted for merge commit |
| Verified GitHub / user-reported interactive | PR #46 merged, dev merge SHA verified; zoom 200% walkthrough GREEN informed | Merge `c40a9ce728860725c0179f0a4b1af7ac6745b403` |
| Approved exception | Vercel deployment status failed due to provider rate limit; user explicitly approved proceeding without retry | **Not** a successful CI/deployment check |

No gate result is transferred to a later SHA. The gate was executed on the exact pre-merge candidate; the merge commit is a distinct Git identity and was not itself retested. Any post-merge documentation commit likewise has a distinct SHA and must not inherit the gate.

## Recent micro-sprints and recoverable commits

- KAN-703 page-state CustomCard pattern documented in `docs/architecture/athlete-page-state-pattern.md`; dynamic direct access DENY and second athlete restoration visually accepted.
- T8.1 Home week navigation fail-closed: RED `0eccf9697e2bc42f77e7682a8e781a5a752adcf2`; implementation GREEN user-reported at `406d982846b1bce2cf3fddf6da5d75f7c3b9ca8b`.
- T8.2 Plan status/localization: RED `53ef1cb9c080c35a016bae81b61b9dd9ba6a6b66`; GREEN user-reported at `f3ef7c2cc6392cfa41429a2b922fe5e5f3690044`.
- Reviewed incremental diffs involved Athlete Home, week hook, Plan page, planning-week action, localized strings, and tests; no schema/Coach changes were introduced by T8.1/T8.2.

## Acceptance fixture and deferred debt

`scripts/provision-kan607-second-athlete.ts` is **local, explicit, idempotent, regenerable acceptance provisioning** for disposable seeded `sqlite.db` only. Its fixed subject, email, IDs, Team and group are fixture identifiers, not product contracts or authorization sources. See `docs/architecture/h5a-local-acceptance-fixture.md`. Never run in CI/production, on an important DB, or infer authority from fixture IDs.

Deleting realized-training records is **independent debt outside H5A**, not a missing AC for this story. Do not implement deletion in KAN-704.

## Final integration and next fresh-chat baseline

- GitHub PR: https://github.com/m415x/trail-running-workout-planner/pull/46 (merged).
- Pre-merge source candidate and user-reported PASS 6/6: `245b374ae08176136705bca41379c0a4095553f6`.
- Merge commit verified in `dev`: `c40a9ce728860725c0179f0a4b1af7ac6745b403`.
- Jira KAN-704 and KAN-607: Finalizada; merge evidence recorded in both.
- Zoom 200% interactive walkthrough: GREEN informed by user.
- Vercel: deployment rate-limited; approved explicit exception, **no remote deployment PASS**.
- Local fixture and realized-training delete exclusions remain unchanged.

Fresh chats: read `AGENTS.md`, `docs/agent-harness.md`, this handoff and relevant architecture before opening new scope. Verify the current `dev` HEAD; do not assume this handoff's own documentation update SHA equals the merge SHA or is covered by the pre-merge gate.

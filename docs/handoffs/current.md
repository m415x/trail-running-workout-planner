# Current operational handoff — KAN-608/H5B integration

## Authority and execution state

This is the current **PR/integration checkpoint**, not a claim that H5B is integrated into `dev`. Read `AGENTS.md`, `docs/agent-harness.md`, `docs/README.md`, the current remote `dev` and Jira before selecting subsequent work.

- Story: KAN-608/H5B (Jira: Finalizada; KAN-705–KAN-713 Finalizada). PR [#47](https://github.com/m415x/trail-running-workout-planner/pull/47) targets `dev` and remains **Draft** pending review/approval.
- Pre-reconciliation integration base: `dev` `5cf26a96c7a439bea0b53ee610a098a212b4859e`.
- Last functional gate SHA: `7ed63d4123ec3723a3b6255f90b16c20a55bf1c2`. Operator-reported local `pn verify --db`: Tests, TypeScript, ESLint, Build, i18n and SQLite **PASS 6/6**, 188967 ms. This is evidence **for that SHA only**.
- H5B architecture publication was documentation-only at `5f86f0573fa67593ade77473aebbba3732397670`; subsequent index/handoff reconciliation is documentation-only as well. **Neither later HEAD is asserted to have executed the 6/6 gate.**
- Accepted interactive evidence: Stats ES/EN, Profile ES/EN showing two distinct athlete identities, and correct unknown RunningReference without 1000 m evidence. Visual presentation of an available RunningReference and all DENY/error variants was not manually established; focused regressions cover those contracts.
- GitHub Actions: no pull-request workflow runs were found for the pre-reconciliation H5B HEAD. Vercel status was reported **success** by the operator after an earlier build-rate-limit failure; re-check PR checks before approval, do not promote historical failures to current defects.

## Contract and closure guard

Durable contract: [`../architecture/h5b-athlete-stats-physiology-self.md`](../architecture/h5b-athlete-stats-physiology-self.md). H2 identity + active Team + active TeamMembership + dedicated H3 SELF read capability + owned AthleteProfile are all necessary. Client IDs cannot choose another athlete. H5B reads do not authorize Coach/athlete writes, and unavailable evidence is never turned into fabricated metrics or zeros.

This documentation-only reconciliation does not alter runtime, migrations, tests or localization catalogs. Per `AGENTS.md` and `docs/agent-harness.md` SHA/evidence rules, a subsequent documentation-only commit may reuse the unchanged functional-tree gate **with its original SHA explicitly identified**, provided the final diff confirms no functional changes. Focused documentation/diff review, links and PR checks are required for the new HEAD; a fresh `pn verify --db` on that HEAD is **not automatically mandatory** solely because documentation changed. Any functional/test/configuration change or changed integration tree invalidating relevant evidence requires reevaluation and affected re-verification.

Before removing Draft: inspect the final diff and HEAD, reconcile reviewer findings and effective PR checks, obtain explicit candidate approval; then merge to `dev` only when authorized. Verify the exact merge SHA and relevant post-merge gate/acceptance, update Jira and this index/handoff to the merged reality. KAN-609 is not authorized for task/branch creation until fresh-chat bootstrap on merged `dev`. KAN-606 remains deferred while H7A/KAN-610 lacks a closed contract.

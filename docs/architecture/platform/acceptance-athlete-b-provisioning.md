# KAN-778 — Acceptance Athlete B local provisioning

## Scope and authority

Acceptance Athlete B is a **second independent Athlete** for local KAN-645/KAN-766 acceptance. Its already-existing Supabase Auth account is external authority for provider `supabase` and the verified subject; the EPT database does not create or authenticate the Supabase account. Provisioning creates only a stable EPT User, ExternalIdentityLink, active ATHLETE TeamMembership in `team_1`, and one AthleteProfile in `team_1` with `group_id = NULL`.

This is a local acceptance actor, not a domain seed or planning fixture. Do not run `pn db:seed:acceptance` merely to add B; that command also seeds other business data. Do not alter KAN-758's multiteam fixture, the original four H4B acceptance actors, team_2, cohort membership, plan variants or sessions.

## Operational contract

Run `scripts/provision-acceptance-athlete-b.ts` only in local development, on an existing canonical SQLite database and **after independently verifying** B's Supabase Auth User UID. Required arguments: `--database <local-file>` and `--subject <verified-uuid>`. By default it performs a read-only preflight; `--apply` enables the transactional write. Missing schema/team, partial identity, mismatched provider/subject, identifier collisions and invalid arguments fail closed; repeat on a complete identity produces `complete; no writes`.

The subject is *not* a credential, but remains user-specific identity information: never publish it in Git, Jira comments, tests, screenshots or handoffs. Do not infer identity by email, DNI, name or username. The script's placeholder contact email is administrative metadata, not an authentication binding.

Before a local `--apply`: stop processes writing to SQLite; make and verify a SQLite backup; dry-run against the target; confirm provenance of the real subject. Verify the rerun, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, the provider link, membership and profile using read-only queries. The original acceptance-actor COUNT=4 is only a **presence** check, not a complete before/after equality proof.

The initial AthleteProfile has no sporting group. Assign groups, cohorts and plans through the Coach workflow, not by expanding provisioning or injecting business fixtures. Supabase login and Athlete `/plan` are a separate manual acceptance gate; successful access does not prove multieweek planning consumption.

## Evidence and limits (2026-10-13)

- Branch `feat/KAN-778-acceptance-athlete-b`; verified candidate SHA `b0546f717d0c9221f28d603c93b7a687d13cefce`.
- KAN-779/T1 through KAN-783/T5: focused operator-reported RED/GREEN evidence recorded in Jira.
- `pn verify --db`: Tests, TypeScript, ESLint, Build, i18n, SQLite **PASS 6/6**, operator-reported on candidate SHA.
- Disposable real-schema SQLite copy: absent dry-run; atomic apply; second execution no writes; provider/profile and FK checks PASS.
- Local `sqlite.db`: verified backup reported PASS; absent dry-run; atomic apply; repeat `complete; no writes`; read-only audit provider `supabase`, ATHLETE in `team_1`, profile no group, `integrity_check = ok`, `foreign_key_check = []`; four original users present.
- Manual real-account Supabase B login, own Athlete context and `/plan` reported PASS.
- **Not covered:** complete historical-state equality of four existing actors; Coach-created plan/progression/cohort/variant/session and Athlete multieweek consumption (KAN-766/T8); Supabase Auth registration itself.

Once merged into `dev`, this infrastructure story can close independently of KAN-766/T8. See KAN-778 and subtasks KAN-779–783 for test/commit provenance.

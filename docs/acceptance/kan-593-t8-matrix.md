# KAN-593/T8 — Consolidated acceptance and integration record

Candidate preparation 2026-11-27. T1–T7 Finalizada in Jira. This matrix references existing evidence; no historical gates are replayed merely to recreate logs. Operator results are not independently executed by the agent.

| Cut | Accepted capability | Recoverable functional checkpoint / evidence | Exact limitations |
| --- | --- | --- | --- |
| T1 KAN-877 | v1 domain, complete/partial, null/zero, independent provenance, safe totals | `5d42d976d1e9cbb9239a021f0a043066ba61e011`; RED8 `f8a5fe542a6b1aa73186789a04fc598f85798123`; pn tdd tests/sessions/vertical-prescription.test.ts --verbose, GREEN reported; Jira 14800–14814 | RED7 GREEN-on-introduction, not causal RED; no full gate, auth or persistence |
| T2 KAN-878 | JSON, migration SQLite 0029/PG 0043, reader/writer, transaction/audit and preservation | `0581b643cc1c34695480cb165701d93327ebf32a`; RED/GREEN 1–18 in Jira, PG 14892: 1 PASS/0 SKIP; 14897: pn verify --db 6/6 PASS, 333208 ms; 14898–14899 closure | gate no local SHA output; PG TEMP only, no public schema/FK/RLS deployment |
| T3 KAN-879 | scoped Coach mutations and safe read, auth/rollback | `3de68b582a0055e6c619a5683cae9f67f59238e1`; Jira 15145, historical 14973–14996; grouped SQLite GREEN exact SHA, authenticated Assistant GET 404 and real POST functional DENY, logical Session/Prescription/audit before-after unchanged | rollback extracted real transaction body, not HTTP fault injection; auth/HTTP operator-reported, no full DB byte hash |
| T4 KAN-880 | manual Coach editor/roundtrip/i18n | RED `257154401563dddfdc426bc345afd1c0da3c57fd`; GREEN `a8ad2190f5b51f19a57747a8b83beb8f4d848704`, 1578 leaves, walkthrough 9/9; Jira 15146 | approved track adoption deferral; no independent WCAG audit |
| T5 KAN-881 | Athlete effective dose/revision, Base/Variant and safe projection | RED `7fb546207995fb844e7498cf1d57c65474a433f7`; GREEN `f1be3fc1f6c537076fee71e47967dbc9624aeaa2`, 1610 leaves, walkthrough 10/10; Jira 15147 | no independent browser/SQL traces; focal SQLite resolver plus wiring, not full loader certification |
| T6 KAN-882 | H6 ownership, unknown aggregate, shared Session, regeneration and audit | RED `0d253acc21779789090cb386baae752f7308553d`; GREEN `d1ee21f3e6d8b4621d95b18b148e01bc0b1f1822`, 1610 leaves; PG writer real GREEN reported; Jira 15148 | PG initial RED blocked, not causal; GREEN PG no detailed TAP/local SHA; TEMP only |
| T7 KAN-883 | H12 effective operands, authoritative linkage, read-only | RED `8861942d60c58c741bdcc505d04f4eef5a61a0b9`; GREEN `98b824b5eff2710cf381a0b527ae7e67d2c7b408`, 1610 leaves; authenticated walkthrough global PASS; Jira 15149 | no per-case walkthrough, exact local walkthrough SHA or independent HTTP trace; SQLite query_only and logical snapshots |
| T8 KAN-884 | integration gate, transverse gaps, docs, PR, postmerge and cleanup | pending candidate and results | no PASS or merge claimed before evidence |

Exact commands and detailed evidence per cut: [handoff](../handoffs/kan-593.md), Jira references above. All RED shorthand without transcript remains operator-reported; no fabricated counts.

## Integration review

Historical story head `805c12fa00a52690242914273867d9db0bbd0a21`, current dev `1d6090fa495f92ec516ccc2a4551db0bca764cac`, reported common ancestor `42c024ee67b83945d50d364622b6f388f4079df4`. Three-way blob inventory: 79 dev-only paths, 108 story-only, one overlapping path docs/README.md. Preserve both histories and dev KAN-885 operational launcher, AGENTS/harness, current integrated handoff and package scripts. Reconcile index, publish architecture and matrix; no changes to dev before PR.

Runner review: T6 reuses exact KAN-878 target and serial focused lane; missing/unsafe URL blocks. Audit found basename-only match and generic PG lane including dedicated files. T8 restricts exact normalized repository paths, blocks quoted globs selecting dedicated acceptance, excludes them from mutable generic PG and ordinary gates, preserves KAN-646/KAN-791 guards and canonical tdd/tsc contract. Coverage in kan-878-focused-pg-lane.test.ts; gate pending. No new service or DB.

## Remaining acceptance

- Candidate `pn verify --db` (six gates, exact SHA). SQLite canonical lifecycle included; no developer database repair.
- Explicit guarded KAN-878/T6 TEMP lane on candidate, report actual TAP pass/fail/skip and SHA. Reuses existing 55478 fixture; no production migration or RLS claim. Existing generic PG checks remain historical unless an applicable change requires new isolated regression evidence.
- Reuse T3 authenticated ALLOW/DENY and snapshots, T4 Coach 9/9, T5 Athlete 10/10, T6 real writer and T7 focal tests. Complete remaining material transverse observation: on candidate Coach/Athlete ES/EN session and plan-real, verify exact effective D+ total against existing evidence, no invalid evidence disclosure, legacy still readable, record observed vs NO OBSERVABLE, no fictitious logs. Base/Variant and H6 protected regeneration covered by focal and final gates; no repeat of valid mutation walkthroughs solely for this matrix.
- Handoff checker, PR review/checks, ordinary merge, exact-SHA postmerge gate, integrated docs/index/Jira and final checker. Worktree inventory and preservation followed by explicit operator-approved retirement or documented blocker. No beta authorization.

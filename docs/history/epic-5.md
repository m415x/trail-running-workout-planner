# Epic 5 — Membership Billing

Status: closure in KAN-464. H1–H5 are the durable economic contract; KAN-298 owns the next identity/authentication/authorization phase.

## Purpose

Epic 5 separated monthly athlete economics from identity and authorization. It introduced a temporal, auditable membership billing domain whose mutable authorities are persisted economic facts; balances, statuses and prior-debt blocking are derived projections.

Delivered stories:

```text
KAN-459  H1 — team economic policy, athlete billing terms and monthly charge
KAN-460  H2 — economic exceptions
KAN-461  H3 — payments and balance
KAN-462  H4 — account state and explainable economic history
KAN-463  H5 — Coach/Athlete experience and prior-debt blocking
KAN-464  H6 — integral Epic 5 closure
```

## H1 — temporal policy, terms and monthly charge

`TeamEconomicPolicy` stores the team's prospective monthly amount, currency and ordinary due day. Policy replacement is temporal and does not rewrite historical athlete conditions or charges.

`AthleteBillingTerms` stores the economic condition actually applied to one athlete. `MonthlyCharge` is the immutable month snapshot. Any billing-terms interval intersecting a civil month produces the full monthly amount; Epic 5 does not prorate automatically.

Materialization is explicit and idempotent. Read paths do not create charges. The legacy `memberships` table is preserved but is not authority for the new economic domain and is not used to infer ambiguous billing history.

## H2 — explicit economic exceptions

H2 introduced append-only, reasoned revisions for:
- global due-date exceptions for one team/month;
- charge reductions or scholarships;
- individual charge extensions.

Due-date precedence is ordinary policy → current global period exception → first-month activation clamp → charge `baseDueDate` → current individual extension → `effectiveDueDate`.

Reprojection is convergent. A later global exception never destroys an individual extension; if a base date temporarily overtakes it, the extension remains auditable.

## H3 — Payment as historical fact

`Payment` is an append-only historical fact associated with one `MonthlyCharge`. The MVP payment methods are only `cash` and `bank_transfer`; Mercado Pago is not a separate method.

Corrections and voids append new revisions. Effective paid amount is the sum of current non-void payment revisions. Effective payments may not exceed the H2-effective amount due. Epic 5 creates no credit balance or automatic redistribution between months.

## H4 — deterministic account projection

H4 derives, for an explicit civil cutoff date:

- `settled` when remaining amount is zero;
- `pending` while remaining amount is positive and cutoff is on or before inclusive `effectiveDueDate`;
- `overdue` when remaining amount is positive and cutoff is after `effectiveDueDate`.

Balances remain grouped by persisted currency; unlike currencies are never summed. The explainable economic history relates the applicable terms, charge, H2 revision histories, H3 payment history and final H4 result without inventing a parallel ledger.

## H5 — shared Coach/Athlete debt experience

Athlete presentation uses yellow for `pending`, red for `overdue` and normal presentation for `settled`.

The final approved blocking contract is:

`blocked_for_prior_debt` is true iff at least one charge belongs to a civil month before the current civil month and H4 already derives that charge as `overdue`.

Consequences:
- a prior-month charge under a still-effective extension remains `pending` and does not block;
- after the extension expires, the same prior-month charge becomes `overdue` and blocks;
- a current-month overdue charge does not create prior-debt blocking;
- settlement clears the block by recomputation.

Coach and Athlete consume the same derived `debtExperience`; UI components do not recompute due-date or debt rules. H5 adds no persistence, auth/session/role/permission model or monetary aggregate.

## Persistence, lifecycle and security evidence

Epic 5 persists H1–H3 facts in SQLite and PostgreSQL/Supabase with matching structural contracts.

SQLite closure verifies:
- fresh bootstrap and seeded states;
- representative upgrade;
- preservation of existing data and legacy memberships;
- fresh-versus-upgraded schema drift;
- safe rerun/idempotence;
- partial migration metadata reconciliation.

Supabase evidence is split deliberately:
- `pn db:supabase:check` validates the local Drizzle migration set;
- `pn db:supabase:verify` queries the configured remote deployment.

KAN-464 remote verification reported H1/H2/H3 billing persistence contracts OK, 45/45 application tables present and 45/45 tables with RLS enabled.

Application reads and writes retain team/athlete isolation. RLS presence does not itself define the future user/session/role authorization model.

## H6 closure

KAN-464 reconciled H1–H5 acceptance criteria and found one real cross-contract coverage gap: prior tests separately covered H2 extensions, H4 temporal state and H5 blocking but did not prove the complete chain.

The added closure regression demonstrates:
- H2 extension through its inclusive due date → H4 `pending` → H5 no block;
- next civil day → H4 `overdue` → H5 block for the prior month;
- full H3 payment → H4 `settled` → H5 unblock.

No productive behavior was added because the contract was already implemented.

Focused persistence/isolation and Coach/Athlete/i18n suites were GREEN, and the manual walkthrough of reproducible current surfaces was GREEN. Historical prior-month UI scenarios were not fabricated with new tooling because they are deterministic automated-domain evidence.

## Explicit future boundaries

Epic 5 does not implement:
- authentication, session establishment, roles, permissions or authorization;
- gateways, checkout, webhooks, provider reconciliation or speculative external IDs;
- generic settings infrastructure;
- automatic proration, interest, credit balance or redistribution;
- differential training fees or other additional charges.

Differential training and additional charges remain a deliberate future extension. They must receive their own real domain contract rather than becoming a second membership or overloading `MonthlyCharge`.

The next phase is KAN-298. It must begin by auditing the system that actually exists — Supabase Auth/RLS, users, teams, belonging/membership concepts, roles and server-side boundaries — before new stories or implementation are defined.

## Durable references

Current behavior is authoritative in code and:
- `docs/architecture/memberships.md`
- `docs/README.md`
- `docs/handoffs/kan-503.md` while it remains the current operational handoff
- Jira KAN-5 and KAN-459 through KAN-464

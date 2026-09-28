# Membership billing foundation, H2 exceptions and H3 payments

KAN-459 establishes the H1 economic foundation for memberships. KAN-460 extends that foundation with H2 economic exceptions. KAN-461 adds H3 payments and per-charge balance derivation. Later Epic 5 stories may extend this contract but must not reinterpret historical H1, H2 or H3 facts.

## Authorities and temporal model

`TeamEconomicPolicy` is the team's temporal default configuration. It owns only the default monthly amount, currency and ordinary due day. Policies use half-open intervals `[effectiveFrom, effectiveUntil)`. Initial configuration and permanent replacements start on a month boundary; a replacement closes the prior interval and opens a new prospective interval.

The initial product configuration is ARS 25,000 with ordinary due day 5. Those values are configuration data, not universal domain constants or database defaults.

`AthleteBillingTerms` is the economic condition actually applied to one athlete. Applying initial terms may start on any explicit date. Ordinary replacement terms start on a month boundary, close the prior open interval and apply prospectively. A later team-policy change does not rewrite existing athlete terms.

`MonthlyCharge` is the immutable monthly snapshot produced from the athlete terms and the policy applicable to that month. Money is represented as positive integer minor units; H1 does not use floating-point money.

## Monthly materialization

An athlete owes the complete monthly amount when one billing-terms interval intersects any part of that calendar month. H1 never prorates automatically.

At most one terms interval may claim an athlete/month. Ambiguity is rejected before materialization. Persistence adds the final uniqueness defense with `(athlete_id, year, month)`.

For the first reached month, `baseDueDate` is the later of the ordinary policy due date and the terms' `effectiveFrom`. Later H1 months use the ordinary policy due date. H1 initializes `effectiveDueDate` to `baseDueDate`; later stories may extend due-date semantics without rewriting the historical base fact.

Materialization is explicit application behavior, not navigation behavior. `materializeMonthlyChargesThrough` skips already-existing months, and the persistence adapter inserts only missing charges. Reading the Coach membership UI or an athlete membership snapshot must not create charges.

Historical charges are snapshots. Prospective policy or terms changes do not recalculate or rewrite already materialized months.

## Persistence and isolation

SQLite migration `0008_membership_billing_foundation.sql` and Supabase migration `0023_membership_billing_foundation.sql` persist `team_economic_policies`, `athlete_billing_terms` and `monthly_charges` with integer money, date/order checks, foreign keys and the athlete/month unique index.

Application reads and materialization validate team/athlete membership before exposing or mutating athlete economic data. The current fixed development identity remains temporary infrastructure and is not an authentication/authorization model.

The pre-existing `memberships` table is not the H1 economic contract. H1 preserves legacy data rather than inferring economic history from ambiguous legacy rows. New economic truth is written only through the three H1 structures above.

## Coach presentation

The Coach membership surface is desktop-first and localized ES/EN. It exposes current, scheduled and historical team policies; athlete detail exposes current, scheduled and historical billing terms plus already-materialized charges.

Forms chain prospective changes from the latest scheduled/open interval while presentation still distinguishes what is current on the Argentina-local date. Backend diagnostics are not exposed as raw user-facing errors.

## H2 economic exceptions

KAN-460 models reductions/scholarships, global monthly due-date exceptions and individual extensions as explicit auditable facts layered over H1. Revision history is append-only: corrections create a new current revision and explicit withdrawals create a replacement revision instead of deleting or silently editing history. Every decision requires a non-empty reason; semantic retries are idempotent.

A global monthly due-date exception has one current decision per team/year/month and affects both existing and future charges for that period. Due-date precedence is: ordinary team-policy due date → current global monthly exception → first-month activation clamp → `MonthlyCharge.baseDueDate` → current individual extension → `MonthlyCharge.effectiveDueDate`. Reprojection is convergent and an individual extension is never destroyed by a later global exception. If the base date overtakes an extension, the extension remains auditable and can become effective again if the base date later moves back.

A reduction has one current revision per charge. Active reductions use an absolute positive minor-unit amount no greater than the H1 base amount; withdrawal uses a zero-amount revision. The projection is `amountDueMinor = baseAmountMinor - reductionAmountMinor`; base amount and currency remain historical H1 facts. A reduction is not a payment, credit, balance or proration.

An individual extension has one current revision per charge. An active date must be later than the current base due date; withdrawal uses a null date. Its projection is `effectiveDueDate = max(baseDueDate, currentExtendedDueDate)`.

SQLite migrations `0009_membership_global_due_date_exceptions.sql`, `0010_membership_monthly_charge_reductions.sql` and `0011_membership_monthly_charge_extensions.sql` persist H2. PostgreSQL/Supabase migration `0024_membership_billing_exceptions.sql` provides the equivalent three revision tables, constraints, partial current-revision indexes and RLS enablement. The shared Drizzle billing adapter consumes the environment schema rather than duplicating H2 repository/domain logic.

Supabase H2 tables are RLS-enabled but KAN-460 deliberately does not invent permissive policies before the identity/authentication/authorization phase. Reduction and extension facts remain charge-scoped; athlete/team identity is reached through `MonthlyCharge` and guarded at application/persistence boundaries. A versioned migration and `db:supabase:check` are not evidence that a remote Supabase instance has received migration 0024; `db:supabase:verify` is the remote deployment verifier.

## Coach operations and presentation

KAN-479 exposes the established H1/H2 contract through localized Coach ES/EN workflows without making the UI a second economic authority.

Monthly materialization has an explicit team-wide Coach trigger for an exact calendar month. The use case processes only athletes that already have valid billing terms for the team, skips already materialized months and reports only newly inserted charges as created. A future scheduler may invoke the same application use case; navigation and read loaders remain read-only.

New athlete creation initializes billing atomically when Membership is enabled. The athlete receives initial `AthleteBillingTerms` from the team policy effective on the creation date and the join/current-month `MonthlyCharge` is materialized in the same synchronous SQLite transaction. The effective creation date uses the established Argentina-local civil date. If no team economic policy is effective on that date, creation fails rather than leaving an economically incomplete athlete. Existing legacy athletes without terms are not silently backfilled or assigned historical debt.

Join-month materialization applies the current global monthly due-date exception before the first-month activation clamp. This preserves the H2 precedence contract while still allowing a mid-month athlete to use the later of the exception/policy candidate and the economic activation date.

Coach H2 controls operate only on persisted monthly charges. Reduction and extension forms derive period identity from the selected charge, explicit withdrawals create append-only revisions, and histories show their persisted economic value and current/historical status. Global due-date history is likewise auditable.

Money presentation derives from persisted `amountMinor` plus `currency`; locale affects formatting only. UI projections must not invent ARS or hard-code a currency symbol. The current product still uses ARS as the approved initial/default configuration, while broader team locale/currency/time-zone preferences remain deferred. Civil billing dates remain `YYYY-MM-DD` facts; UI formatting uses controlled UTC interpretation so due dates and exception/extension dates do not shift calendar day.

KAN-479 also hardened the local operational path required by these flows: H2 SQLite verification/recovery recognizes partially reconciled migration metadata, better-sqlite3 transactions remain synchronous, and Drizzle SQLite mutation statements are explicitly executed rather than relying on lazy statement construction.

## H3 payments and per-charge balance

KAN-461 introduces `Payment` as an explicit historical economic fact associated with one persisted `MonthlyCharge`. It is not a reduction, credit, charge mutation or account-status field. The MVP registers payments manually, and the only admitted methods are `cash` and `bank_transfer`. Mercado Pago remains a transfer provider/destination detail rather than a distinct `paymentMethod`.

`paidAt` is the economic date of the payment and remains distinct from record creation time. Partial and full payments are supported. Effective paid amount is derived from the current non-void revision of each logical Payment identity; historical revisions remain auditable and never contribute twice.

Payment correction and void are append-only revision operations. A correction preserves the logical `paymentId`, closes the previous current revision and appends a replacement revision. A void likewise appends an explicit current void revision instead of deleting or destructively updating the historical fact. Historical revisions are read-only in the Coach UI.

The effective balance for one charge is derived as:

- `paid = sum(current non-void Payment amounts)`
- `remaining = amountDueMinor - paid`

The effective paid amount may never exceed the H2-effective `amountDueMinor`. H2 reductions are therefore also guarded against lowering the effective amount due below already-effective payments. H3 creates neither credit balance nor automatic redistribution between months.

SQLite persists H3 in `payment_revisions` with a positive-amount check, the closed payment-method set, a charge index and a partial unique current-revision index per logical Payment. PostgreSQL/Supabase migration `0025_robust_thunderbolt_ross.sql` provides the equivalent H3 delta and enables RLS. The generated 0025 snapshot/journal establish the repaired forward migration lineage after the previously missing H1/H2 Supabase snapshots; generated metadata was preserved rather than hand-edited.

The local SQLite lifecycle similarly verifies `payment_revisions` at HEAD. If an existing development database predates H3, the supported recovery path is `pn db:sqlite:upgrade`; application runtime must not assume that merely updating source code mutates an existing local database.

## Coach H3 operations and presentation

The Coach athlete membership surface exposes payment entry, effective paid/remaining amounts and append-only history in ES/EN. Money display continues to derive from persisted minor units plus the persisted charge currency; locale affects formatting only.

Correction controls and explicit void controls are shown only for the current non-void revision. Historical revisions remain visible without mutation controls. The UI delegates all economic validation to the established H3 application/persistence boundary rather than reimplementing overpayment or revision rules.

The Coach surface remains desktop-first with deliberate responsive behavior. H3 does not introduce an aggregate account state, debt classification, blocking or notices.

## Supabase deployment evidence for H3

KAN-461 applied the pending H2/H3 migrations to the verified Supabase environment and then ran the remote verifier successfully. The verified result was 45/45 application tables and 45/45 tables with RLS, with H1, H2 and H3 persistence contracts all reported `OK`.

PostgreSQL truncated two long H2 foreign-key identifiers to its 63-character limit. The verifier therefore validates those H2 foreign keys structurally by source table/column and referenced table/column rather than depending on long constraint names.

## Reserved for later Epic 5 stories

H4 remains responsible for aggregate account/history semantics such as derived `settled | pending | overdue` state, notices and Athlete blocking. H3 introduces no credit balance, automatic payment redistribution, gateway/provider/webhook/checkout model, additional charges, authentication or authorization, and no implicit proration.

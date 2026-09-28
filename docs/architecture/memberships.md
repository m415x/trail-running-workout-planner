# Membership billing foundation, H2 exceptions, H3 payments, H4 account projection and H5 experience

KAN-459 establishes the H1 economic foundation for memberships. KAN-460 extends that foundation with H2 economic exceptions. KAN-461 adds H3 payments and per-charge balance derivation. KAN-462 adds the H4 derived account state and explainable economic history. KAN-463 adds the H5 Coach/Athlete experience and prior-debt blocking projection. Later Epic 5 stories may extend this contract but must not reinterpret historical H1, H2 or H3 facts or persist H4/H5 projections as mutable authority.

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

## H4 account state and explainable economic history

KAN-462 derives account state exclusively from persisted H1/H2/H3 facts. H4 does not add a mutable account-status column, balance ledger or parallel economic authority.

The cutoff date is an explicit civil `YYYY-MM-DD` input. Domain derivation does not consult the runtime clock or runtime timezone. For one charge:

- `remainingMinor === 0` → `settled`
- `remainingMinor > 0` and `cutoffDate <= effectiveDueDate` → `pending`
- `remainingMinor > 0` and `cutoffDate > effectiveDueDate` → `overdue`

`effectiveDueDate` is therefore inclusive for `pending`. The calendar day 10 has no independent economic-state meaning; it may support later operational follow-up but does not create a fourth status or override the actual due date.

Paid and remaining values continue to come from the H3 balance projection. Aggregate account balance is derived by persisted currency so unlike monetary units are never summed together or implicitly converted.

H4 also exposes an explainable per-charge projection that relates:

- the applicable `AthleteBillingTerms`;
- the persisted `MonthlyCharge`;
- global due-date exception revision history;
- reduction/scholarship revision history;
- individual extension revision history;
- Payment correction/void history;
- the final derived H4 result at the supplied cutoff date.

This is structured explanation, not a synthetic ledger or invented total chronology. H2/H3 append-only revision authority remains intact. Current, historical and voided facts remain distinguishable.

The athlete Membership read path accepts `cutoffDate` separately from general page `onDate`, gathers the required H1/H2/H3 facts under team + athlete isolation and remains side-effect-free. Reading H4 never materializes charges or mutates exceptions, reductions, extensions or payments.

The Coach athlete Membership surface renders the derived H4 account state, paid/remaining values, per-currency total balance and explainable history in localized ES/EN. The UI formats dates/money only; it does not reimplement economic status or balance rules. Currency codes remain explicit in presentation.

## H5 Coach/Athlete experience and prior-debt blocking

KAN-463 consumes the H4 projection without introducing a second economic authority.

Athlete presentation is per charge:

- `pending` uses a yellow signal;
- `overdue` uses a red signal;
- `settled` uses the normal light/dark-compatible presentation.

The functional H5 block is derived as `blocked_for_prior_debt`. It is true if and only if at least one charge belongs to a civil month before the current civil month and H4 has already classified that charge as `overdue`.

This deliberately preserves H2/H4 extension semantics:

- a prior-month charge with a still-effective extension remains H4 `pending` while `asOfDate <= effectiveDueDate` and therefore does not block;
- once `asOfDate > effectiveDueDate`, H4 derives `overdue`; if the charge is from a prior month, H5 then blocks;
- a current-month charge may already be `overdue` and appear red without causing `blocked_for_prior_debt`;
- when payments make the relevant prior charge H4 `settled`, H5 clears the block by recomputation.

Coach and Athlete consume the same derived `debtExperience` from the Membership read model. UI components present that projection only; they do not compare due dates or recompute debt rules.

H5 is non-monetary. Existing H4 balances remain grouped by persisted currency. H5 does not sum unlike currencies, define a cross-currency account total or introduce FX conversion.

H5 adds no table, schema field, migration, mutable blocking state, session, role, permission or authorization rule. Blocking is functional Membership behavior inside the application and remains separate from the identity/authentication/authorization model reserved for KAN-298.

H1–H5 introduce no credit balance, automatic payment redistribution, gateway/provider/webhook/checkout model, additional charges, authentication or authorization, and no implicit proration.


## Epic 5 closure boundary

KAN-464 closes Epic 5 without introducing a new economic authority. H1–H5 above are the durable Membership billing contract.

The final prior-debt rule is intentionally narrower than “any unpaid prior month”: `blocked_for_prior_debt` requires a charge from a civil month before the current civil month whose H4-derived status is already `overdue`. A prior-month charge under a still-effective extension remains `pending` through its inclusive `effectiveDueDate` and does not block. A current-month overdue charge is visually overdue but does not create prior-debt blocking. When effective payments settle the relevant prior charge, H4 derives `settled` and H5 clears the block.

The pre-existing `memberships` table remains preserved legacy data and is not the authority for team policy, athlete terms, monthly charges, exceptions, payments, account state or debt experience.

Local migration validation and deployed-state validation are separate evidence classes. `pn db:supabase:check` validates the local Drizzle migration set. `pn db:supabase:verify` queries the configured remote Supabase environment and is required before claiming the deployed contract or RLS state.

Epic 5 deliberately leaves these concerns outside its authority:

- authentication, session establishment, roles, permissions and authorization, reserved for KAN-298;
- payment gateways, webhooks, checkout, reconciliation providers and speculative external IDs;
- a generic settings framework;
- automatic proration, credit balances or payment redistribution;
- differential training fees and other additional charges.

Differential training and additional charges remain an explicit future extension. They must be modeled from a real future contract and must not be represented as a second membership or by overloading the ordinary `MonthlyCharge`.

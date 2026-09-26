# Membership billing foundation and H2 exceptions

KAN-459 establishes the H1 economic foundation for memberships. KAN-460 extends that foundation with H2 economic exceptions. Later Epic 5 stories may extend this contract but must not reinterpret historical H1 or H2 facts.

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

## Reserved for later Epic 5 stories

H2 does not implement payments, credits, balances, derived `settled | pending | overdue` state, notices, Athlete blocking, additional charges, authentication or authorization. It also introduces no implicit proration.

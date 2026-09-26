# Membership billing foundation

KAN-459 establishes the H1 economic foundation for memberships. This contract is the baseline for later Epic 5 stories; later stories may extend it but must not reinterpret historical H1 facts.

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

## Reserved for later Epic 5 stories

H1 does not implement reductions/scholarships, global monthly due-date exceptions, individual extensions, payments, derived `settled | pending | overdue` state, balances, notices, Athlete blocking, additional charges, authentication or authorization.

The extension order reserved for H2 due-date work is: team policy → global monthly exception → `MonthlyCharge.baseDueDate` → individual extension → `MonthlyCharge.effectiveDueDate`. H2 reductions must modify the charge traceably rather than masquerading as payments.

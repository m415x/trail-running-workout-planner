# Athlete page-level feedback pattern (KAN-703)

## Contract

Use `features/athlete-planning/components/AthletePageState.tsx` for page-level failure states in the Athlete mobile shell. This component wraps the existing design-system `CustomCard` from `components/ui/custom/card-containers.tsx`, preserving the surface tokens, responsive horizontal margins, maximum width, centered text and accessible `role='alert'`.

Server-side authorization remains authoritative. Classify **DENY** before generic errors; never render sensitive content or a misleading empty-state when SELF fails. Pass an already-localized message (using the current `next-intl` namespace) to the presentation component. No authorization logic, fetching or identity resolution belongs in the card.

Examples:
- Home: `<AthletePageState message={tPlan('unauthorized')} />` for an explicit authorization denial; `<AthletePageState message={t('errors.saveFailed')} />` for an unrelated failure.
- Plan: `<AthletePageState message={t('unauthorized')} />` for denial; use a distinct load-error message otherwise.
- Legitimately empty authorized planning/records: show the existing empty content state, **not** the denial card.
- Missing/ambiguous SELF profile: fail closed on the server, do not expose profile existence via speculative client classification.

## Fresh-chat implementation checklist

1. Read `AGENTS.md` and `docs/agent-harness.md`, then this document before adding an Athlete page DENY/error.
2. Reuse `AthletePageState` instead of separate `Card`/fullscreen `div` variants.
3. Preserve distinct localized denied/error/empty messages, `role='alert'`, responsive 320px+, and dark/light surface tokens.
4. Test unauthorized direct navigation (Home and Plan), unaffected authorized athlete, and restoration after revocation. Verify focus/keyboard if interactive controls are later introduced.
5. Keep authorization changes and non-Athlete screens outside KAN-703; expand reuse only after reviewing each screen's contract.

## Evidence

KAN-703 RED: `tests/athletes/kan-703-athlete-page-state-presentation.test.ts`. Visual acceptance: an inactive second Athlete TeamMembership receives explicit DENY on both Home and Plan; the first athlete remains authorized. Restore the second membership after confirming the unified presentation. Do not claim the restored ALLOW without an interactive check.

# KAN-646 — Athlete Profile SELF biometric and account contract

## Runtime authority and presentation

The authenticated Athlete Profile reads the H2 Supabase session and EPT identity, H3 active Team, and H5A own active AthleteProfile. The header never uses fixture `currentUser` as runtime authority. Profile keeps Physiology and Settings; the Material tab is hidden for beta. Stats remains the separate performance/evolution surface, with no duplicate time-series analysis in Profile.

The four self-declared editable biometrics are weight (kg; tenths), height (cm; tenths), maximum heart rate (bpm; integer) and resting heart rate (bpm; integer). The Athlete client exposes create and correction, dates and provenance. The two public Server Actions only delegate to the internal SELF writer. Neither request payload nor presentation controls own User, Team or AthleteProfile identity. Every read/write resolves H2/H3/H5A capability and own-profile scope server-side; persistence reauthorizes current membership and own profile in the SQLite transaction. Cross-Team, cross-athlete, different-kind, invalid authorization and conflicting corrections must not mutate observations.

Observations are append-only: correction inserts a new row referencing its predecessor (`supersedes_observation_id`) rather than replacing historical evidence. Idempotency keys protect identical retries. Readers select current eligible observations by effective civil date and recorded-at cutoff. A valid persisted Team IANA `teams.time_zone` is mandatory; missing/invalid configuration fails closed rather than defaulting to server locale. The recorded observation retains `observed_on`, `recorded_at`, `source` and `observed_time_zone`. No derived VO2max, heart-rate zones or clinically interpreted metric may be fabricated from missing inputs. Eligible accepted 1000 m evidence may expose only the approved RunningReference; otherwise show unknown.

Settings reuse existing theme persistence, Supabase password recovery and sign-out. There is no second credential store.

## Acceptance and evidence (feature branch, pre-merge)

- KAN-646/T8 operator walkthrough: authenticated `athlete@test.com` linked to local EPT `accept_h4b_athlete`, Team `team_1`, own profile; all four editors visible and used (weight 71 kg, height 175 cm, maximum HR 185 bpm, resting HR 55 bpm). SQLite read-only audit of weight confirmed two `athlete_declared` observations 705 → 710, canonical correction link, and `America/Argentina/Buenos_Aires` provenance. Do not treat the local acceptance dataset as production or imply all three other values received independent read-only database audits.
- Operator reported ES/EN, light/dark, 360/390 px, tablet/desktop, 200% zoom and keyboard/focus PASS. Focal authorization/transaction isolation tests GREEN. `tests/authorization/kan-646-t8-public-action-self-boundary.test.ts` GREEN checks public action-to-SELF writer wiring; it is **not** an adversarial HTTP E2E request test.
- Candidate `af9ca6c980c343cfc31729131fdaa48794fb72f6`: operator `pn verify --db -v` PASS 6/6 (Tests 104669 ms; TypeScript 10277 ms; ESLint 31635 ms; Build 49573 ms; i18n 366 ms; SQLite 44868 ms; total 241388 ms). PostgreSQL focused evidence is separate; the ordinary gate does not represent an exhaustive PG E2E run.
- Numeric comma input `70,5` currently returns invalid input in ES. Explicit operator decision: address numeric decimal normalization across application inputs in a separate post-merge task; no KAN-646-only workaround. Keep this limitation visible until that subsequent task is completed.

This document records the feature candidate only. PR, merge into `dev`, post-merge gate and completed-story handoff are separate T9 steps.

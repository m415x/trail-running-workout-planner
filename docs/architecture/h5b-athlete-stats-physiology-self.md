# H5B — Athlete SELF Stats and physiology (KAN-608)

## Scope and authority

H5B introduces the nondelegable capabilities `stats.self.read` and `physiology.self.read`. A successful SELF read requires an authenticated H2 EPT actor, an active Team, an active TeamMembership with the corresponding capability, and exactly the actor's own AthleteProfile in that Team. Presets (ATHLETE/ASSISTANT/COACH/ADMIN) do not authorize cross-athlete SELF access. The server resolves both athlete ID and Team ID: client parameters cannot select another subject.

The `/stats` entry point and training, load, adherence and competition details consume athlete-safe server projections. Sources use realized training records and internal SELF planning/plan-real queries rather than Coach-only Server Actions; unavailable or inconsistent source evidence yields an error, not fabricated zeros or silent empty-state results. A genuinely absent observation remains unknown. The race-registration projection is scoped to the same server-resolved athlete and Team. UI distinguishes `loaded`, `denied` and `error`.

The 1000 m SELF read only discloses eligible accepted, active field-test evidence, factual evolution and the deterministic RunningReference. Pending/rejected evidence does not contribute; absent evidence yields `unknown`. No raw physiology/medical records, unauthorized Coach data, or invented heart-rate zones, VO2max and body measurements are exposed. The Profile athlete name comes from the active AthleteProfile (nickname, otherwise first and last names), never the global fixture identity. Athlete and Coach write/review actions are outside H5B; the legacy 1000 m registration UI was removed from the H5B Stats read page. Writes require separate H4C/H7A approval.

## Verification and acceptance

Work was delivered through scoped RED→GREEN cuts KAN-705–KAN-712 and KAN-713. T9 additionally verified separation of SELF read/write, multi-Team and multi-athlete SELF selection, all four detail-route denial states, and the removal of Profile fixture identity. Legacy static tests were reconciled to the newly approved contracts without reopening Coach write authority.

Final functional verification candidate: `7ed63d4123ec3723a3b6255f90b16c20a55bf1c2` on `feat/KAN-608-athlete-stats-physiology-self`, confirmed as identical to remote HEAD. User-reported `pn verify --db`: Tests PASS 74316ms, TypeScript PASS 11101ms, ESLint PASS 28830ms, Build PASS 27606ms, i18n PASS 419ms, SQLite PASS 46695ms; overall PASS (188967ms).

Interactive acceptance: Stats passed in ES/EN. Profile passed ES/EN in dark mode; two separate acceptance athletes displayed distinct identities, `Acceptance Athlete` and `Acceptance Athlete B`. Neither athlete had recorded 1000 m evidence, so localized `unknown` was expected. This walkthrough does **not** independently attest to display of an available RunningReference or every simulated DENY/error state; those states are covered by focused automated contracts, not asserted as manually observed. The final verification evidence is tied to the functional SHA above; publication of this documentation alone is not represented as another executed six-stage gate.

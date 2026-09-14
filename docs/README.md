# Project documentation

This directory contains durable project context. `README.md` is the repository entry index and `AGENTS.md` defines operating rules; this directory separates current architecture, verifiable research, historical evolution and operational handoffs.

All repository documentation must be written and maintained in English.

## Architecture — domain source of truth

- [Automatic session generation](architecture/session-generation.md)
- [Planning cohorts](architecture/planning-cohorts.md)
- [Category and competitive distance](architecture/category-race-distance.md)
- [Planning intent and competition context](architecture/planning-intent-and-competition-context.md)
- [Competition calendar](architecture/competition-calendar.md)
- [Race catalog](architecture/race-catalog.md)
- [Race catalog persistence](architecture/race-catalog-persistence.md)
- [Race course classification](architecture/race-classification.md)
- [Race catalog → planning](architecture/race-catalog-planning.md)
- [Race catalog → TrainingGoal](architecture/race-catalog-training-goals.md)
- [Future RaceRegistration boundary](architecture/race-registration-boundary.md)
- [Competitive adjustment](architecture/competitive-adjustment.md)
- [Integral planning review and safe persistence](architecture/planning-review-persistence.md)
- [Individual readiness assessment](architecture/readiness-assessment.md)
- [Realized training timing and manual capture](architecture/realized-training-timing.md)
- [Realized training corrections](architecture/realized-training-corrections.md)
- [Realized training deduplication](architecture/realized-training-deduplication.md)
- [KAN-290 — focused implementation evidence](architecture/realized-training-validation.md)
- [Product help and domain glossary](architecture/product-help-and-domain-glossary.md)
- [Progressive internationalization policy](architecture/internationalization-policy.md)
- [UX action safety — pending cross-cutting policy](architecture/ux-action-safety.md)

Use architecture documentation when a task depends on how the system works **now**. Do not reconstruct current contracts from history or old conversations.

## Research — versioned external evidence

- [Race classification systems — 2026 snapshot](research/race-classification-systems-2026.md)

Documents in `research/` record external sources and their access dates for decisions that may change over time. They are not domain policy on their own: architecture/types must explicitly adopt any conclusion that becomes a product contract.

## History — consolidated evolution

- [Epic 1 — Planning Core](history/epic-1.md)
- [Epic 2 — Planning Automation](history/epic-2.md)

Each epic maintains one consolidated history document. Old `epic-2-h*.md` fragments are removed once incorporated into `epic-2.md`.

Do not read history by default when starting a task. Consult it to understand historical rationale, superseded decisions, apparent inconsistencies or the origin of a rule.

## Handoffs — operational continuity

- [Epic 3 — KAN-257 closure handoff](handoffs/epic-3.md)

A handoff is brief and temporary: it summarizes the baseline, verifiable status, constraints and next work item. It does not duplicate architecture or history, or preserve transcripts. When a new epic begins, it may be replaced with that epic's operational handoff.

## Maintenance rule

- Durable contract changes → update `architecture/` in the same story.
- Time-sensitive/versioned external research → record it in `research/` with dates and sources.
- Significant evolution/epic closure → consolidate `history/<epic>.md`.
- Execution status and criteria → Jira.
- Immediate continuity → one relevant handoff.
- Indexes/paths → keep `README.md`, this file and `AGENTS.md` synchronized.
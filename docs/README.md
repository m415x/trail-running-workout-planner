# Project documentation

This directory contains durable project context. It complements `AGENTS.md` and prevents implementation history from living only in long chat conversations.

## Architecture

- [Automatic session generation](architecture/session-generation.md)
- [Planning cohorts](architecture/planning-cohorts.md)
- [Category and competitive distance](architecture/category-race-distance.md)
- [Planning intent and competition context](architecture/planning-intent-and-competition-context.md)
- [Competition calendar](architecture/competition-calendar.md)
- [Competitive adjustment](architecture/competitive-adjustment.md)
- [Integral planning review and safe persistence](architecture/planning-review-persistence.md)
- [Product help and domain glossary](architecture/product-help-and-domain-glossary.md)
- [Progressive internationalization policy](architecture/internationalization-policy.md)

Architecture documents describe the current durable domain model and should be preferred when a task depends on how the system works now.

## History

- [Epic 1 — Planning Core](history/epic-1.md)
- [Epic 2 — Planning Automation (H1-H8)](history/epic-2.md)
- [Epic 2 / H9 — Planning intent and competitive calendar](history/epic-2-h9.md)
- [Epic 2 / H10 — Competitive adjustment](history/epic-2-h10.md)
- [Epic 2 / H11 — Integral planning review and safe persistence](history/epic-2-h11.md)

History documents preserve how the product and domain model evolved: original assumptions, implementation outcomes, coach feedback, discovered limitations, and later refinements.

**Do not read project history by default when starting or continuing a story.** Use the current handoff and referenced architecture documents first. Consult `history/` only when historical rationale, a superseded decision, an apparent inconsistency, or the origin of a domain rule is relevant.

## Handoffs

- [Epic 2 / H11 — Planning review and safe persistence](handoffs/epic-2-h11.md)

H11 keeps the single active operational handoff until the real Supabase gate and final local story validation are complete. Once H11 closes, its durable rules live in architecture/history and the handoff may be replaced by the next active story.

Handoffs are intentionally temporary and minimal. Keep only the handoff needed to resume the active/recent story; durable decisions belong in architecture/history and execution state belongs in Jira. Superseded handoffs should be removed once their durable information has been consolidated.

## Maintenance rule

Update architecture documents only when a durable domain decision changes. Consolidate meaningful product/domain evolution into the corresponding history document without turning it into a commit log. Keep the active handoff short and operational. Do not copy complete chat transcripts into this directory.

# Project documentation

This directory contains durable project context. It complements `AGENTS.md` and
prevents implementation history from living only in long chat conversations.

## Architecture

- [Automatic session generation](architecture/session-generation.md)
- [Planning cohorts](architecture/planning-cohorts.md)
- [Category and competitive distance](architecture/category-race-distance.md)
- [Planning intent and competition context](architecture/planning-intent-and-competition-context.md)
- [Competition calendar](architecture/competition-calendar.md)
- [Product help and domain glossary](architecture/product-help-and-domain-glossary.md)
- [Progressive internationalization policy](architecture/internationalization-policy.md)

Architecture documents describe the current durable domain model and should be
preferred when the task depends on how the system works now.

## History

- [Epic 1 — Planning Core](history/epic-1.md)
- [Epic 2 — Planning Automation](history/epic-2.md)

History documents preserve how the product and domain model evolved: original
assumptions, implementation outcomes, coach feedback, discovered limitations,
and later refinements.

**Do not read project history by default when starting or continuing a story.**
Use the current handoff and referenced architecture documents first. Consult
`history/` only when historical rationale, a superseded decision, an apparent
inconsistency, or the origin of a domain rule is relevant to the task.

## Handoffs

- [Epic 2 / History 6 completed](handoffs/epic-2-h6.md)
- [Epic 2 / History 7 completed](handoffs/epic-2-h7.md)
- [Epic 2 / History 8 completed](handoffs/epic-2-h8.md)

Handoffs describe the current operational state and are the primary starting
point for continuing active implementation work.

## Maintenance rule

Update architecture documents only when a durable domain decision changes.
Consolidate meaningful product/domain evolution into the corresponding history
document without turning it into a commit log. Create or replace a handoff when
a history closes or work moves to a new Codex task. Do not copy complete chat
transcripts into this directory.
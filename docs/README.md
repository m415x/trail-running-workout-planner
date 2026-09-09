# Project documentation

This directory contains durable project context. It complements `AGENTS.md` and
prevents implementation history from living only in long chat conversations.

## Architecture

- [Automatic session generation](architecture/session-generation.md)
- [Planning cohorts](architecture/planning-cohorts.md)

## Handoffs

- [Epic 2 / History 6 completed](handoffs/epic-2-h6.md)
- [Epic 2 / History 7 in progress](handoffs/epic-2-h7.md)

## Maintenance rule

Update architecture documents only when a durable domain decision changes.
Create or replace a handoff when a history closes or work moves to a new Codex
task. Do not copy complete chat transcripts into this directory.

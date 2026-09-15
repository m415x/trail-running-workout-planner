# Documentation

This directory contains the project's durable technical, product, research, historical, and handoff documentation.

All versioned GitHub documentation is written in English. Localized product help belongs in the application's message catalogs.

## Structure

### `architecture/`
Current technical and domain architecture, organized by durable functional area rather than Jira story number:

- `planning/`
- `competitions/`
- `realized-training/`
- `monitoring/`
- `platform/`

See [`architecture/README.md`](architecture/README.md).

### `glossary/`
English-only technical/domain terminology, split by semantic domain. See [`glossary/README.md`](glossary/README.md).

The technical glossary is not the localized product glossary. User-facing help is maintained under `DomainGlossary` in `messages/en/glossary/` and `messages/es/glossary/`.

### `research/`
Scientific and methodological research supporting product and architecture decisions. Research documents must distinguish evidence from product heuristics and must state important limits of interpretation.

### `product/`
Durable product principles that are not implementation-specific.

### `history/`
Historical epic summaries and superseded context retained for traceability.

### `handoffs/`
Implementation handoffs and story-level operational summaries. These are useful for continuity but are not the primary architecture source of truth.

### `superpowers/`
Development plans produced by the engineering workflow.

## Documentation policy

1. GitHub documentation is English-only.
2. Jira may remain in Spanish for project tracking and discussion.
3. Architecture documents describe current durable behavior, not ticket chronology.
4. Research documents provide scientific/methodological support and clearly label operational heuristics.
5. New or materially changed terminology requires a glossary review.
6. Localized user help must be maintained symmetrically under `messages/en/` and `messages/es/`.
7. When files move, update repository references in the same change so documentation navigation remains valid.

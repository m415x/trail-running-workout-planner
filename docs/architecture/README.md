# Architecture

Current architecture is organized by durable functional domain rather than Jira story number.

- [`planning/`](planning/) — planning intent, cohorts, review persistence, and session generation.
- [`competitions/`](competitions/) — race catalog, classification, competition calendar, impact windows, and competitive adjustments.
- [`realized-training/`](realized-training/) — realized-training boundaries, corrections, validation, and Plan–Real comparison.
- [`monitoring/`](monitoring/) — readiness, longitudinal training-monitoring signals, systematic-volume excess, and cross-domain training-response convergence.
- [`platform/`](platform/) — cross-cutting internationalization, product-help, and UX-safety policies.

New architecture documents should be placed in the owning functional domain. Research belongs in `../research/`; terminology belongs in `../glossary/`.

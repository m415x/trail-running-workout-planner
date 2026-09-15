# Product help and domain glossary

## Purpose

The application exposes training and planning concepts that may require more
context than a field label can provide. Product help must explain those concepts
consistently to coaches and athletes without duplicating domain definitions or
leaking implementation terminology into the user experience.

This document defines the durable policy for contextual help and the product
domain glossary.

## Core policy

Every user-visible domain concept that requires interpretation must be evaluated
for reusable contextual help.

There is one conceptual definition per term. Its short definition must be
understandable by both coaches and athletes. When one audience needs additional
detail, the glossary may provide a coach-specific or athlete-specific expansion,
but those expansions must preserve the same underlying meaning.

The product must not maintain independent coach and athlete glossaries.

## Audience model

A glossary term may be relevant to:

- coaches only;
- athletes only; or
- both coaches and athletes.

A shared term should have:

1. a common product-facing name;
2. a concise shared definition;
3. optional coach-specific detail;
4. optional athlete-specific detail;
5. audience metadata that controls where the term is useful.

Audience-specific detail changes depth, not meaning. If a concept requires
incompatible definitions for coaches and athletes, the domain model should be
reviewed because two different concepts may have been conflated.

## Language and internationalization

Every glossary term and every reusable product-help text introduced by the
application must be delivered in Spanish and English (`es` and `en`) in the same
change.

A glossary/help change is incomplete when either supported translation is
missing.

Translations must preserve domain meaning rather than translate internal type or
class names literally. Product labels should use the natural vocabulary of
training and planning for the target language.

## Content layers

Product help is separated into four responsibilities.

### Domain glossary

Explains what a stable product or training concept means. It is reusable across
screens and may later feed a dedicated **Help and concepts** experience.

Examples include planning intent, planning cohort, weekly volume, heart-rate
zone, PAM, taper, and competition priority.

### Contextual help

Explains why a concept matters in the current interaction or how it affects the
current choice. A field may expose glossary content through an information icon
or popover and may add screen-specific guidance when necessary.

Contextual help must not redefine the underlying glossary term.

### Validation

Explains why submitted or entered data is invalid, blocked, or advisory. Messages
such as "volume must be greater than zero" are validation, not glossary entries.

### Technical documentation

Explains implementation architecture, persistence, algorithms, invariants, and
internal boundaries to developers. Concepts such as a pure
`CompetitionContext` derivation or a database ownership relationship belong in
`docs/architecture`, not in coach or athlete glossary copy.

## Product language rule

Glossary content describes the product and training domain, not the codebase.

For example, a coach may need to know that a planning intent influences the
general approach used to propose load and intensity. The user does not need to
know which TypeScript enum, Drizzle table, or generator input represents that
intent.

Internal names such as `PlanningIntent` may remain implementation vocabulary;
the UI must use appropriate product-facing Spanish and English labels.

## Reuse and presentation

The glossary is intended to become a single source of truth for reusable help.
A contextual information control such as an `(i)` icon or popover should refer
to a glossary term instead of embedding a second independent definition in the
component.

The same source may later support a broader **Help and concepts** section. That
future presentation should be able to filter or adapt content according to the
current user's audience without creating a second glossary.

Not every glossary term needs a visible information icon everywhere it appears.
Help should be added where interpretation is useful and should avoid cluttering
self-explanatory interactions.

## Incremental growth policy

The glossary grows with the domain rather than through a separate exhaustive
documentation project.

When a story introduces or substantially changes a user-visible domain concept,
the implementation must evaluate whether the concept needs:

- a new glossary entry;
- an update to an existing entry;
- contextual help at the point of use; or
- no additional help because the concept is already sufficiently clear.

This evaluation is part of the story's product work and should not be deferred
automatically to a later documentation phase.

## Definition of done rule

For a user-visible domain concept that requires interpretation, the related task
is not complete until reusable help has been evaluated and, when applicable,
implemented with both `es` and `en` content.

This rule does not require every field or label to have a tooltip. It requires an
explicit product decision about help for concepts whose meaning or consequences
are not self-evident.

## Initial application in H9

H9 is the first story to apply this policy while introducing the corrected
planning vocabulary.

`PlanningIntent` and its product-facing options are expected to be the first
terms implemented through the reusable glossary/help infrastructure. The exact
technical implementation belongs to the corresponding H9 task; this policy does
not prescribe a specific React component or storage shape.

Competition calendar concepts introduced later in H9, such as competition
priority and lifecycle, must undergo the same help evaluation as they become
user-visible.

## Architectural consistency check

The glossary also acts as a lightweight semantic test for the domain model.

A concept should be explainable consistently to both product audiences at its
shared level. Difficulty writing a stable definition, contradictory coach and
athlete explanations, or repeated need to describe implementation details are
signals that the underlying domain boundary may need refinement.

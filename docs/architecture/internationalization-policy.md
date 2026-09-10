# Progressive internationalization policy

## Purpose

The application supports Spanish (`es`) and English (`en`) through `next-intl`.
Internationalization is a product-wide concern: it applies to every user-visible
string, not only to glossary or help content.

This document defines the durable policy for introducing and improving
internationalization progressively without turning localization debt into a
blocking rewrite.

## Core policy

All new user-visible product copy must be internationalized when it is
introduced. Spanish and English translations must be delivered in the same
change.

Existing hard-coded product copy is migrated progressively when the owning flow,
component, action, validation, or domain concept is substantially modified.
Unrelated legacy strings do not need to be migrated opportunistically during a
focused task.

This keeps new debt at zero while reducing existing debt continuously.

## Supported locales

The current supported locales are:

- `es` — default locale;
- `en` — secondary locale.

A user-visible change is incomplete when a required translation is missing for
one of the supported locales.

## What must be internationalized

The policy applies to user-visible strings across the product, including:

- page titles, headings, labels, buttons, menus, tabs, and navigation;
- descriptions, empty states, helper text, placeholders, badges, and notices;
- form feedback, validation errors, warnings, confirmations, and success states;
- server-action errors when they are shown directly to the user;
- planning, training, physiology, competition, and athlete-facing terminology;
- contextual help and domain glossary content;
- accessibility text such as `aria-label`, visually hidden descriptions, and
  equivalent user-facing assistive copy;
- date, number, unit, and percentage presentation when locale-sensitive
  formatting is required.

Developer logs, internal exception details, database identifiers, test names,
code comments, architecture documents, and other non-product implementation text
do not need runtime translation unless they are exposed to the user.

## Progressive migration rule

Internationalization follows a touched-code policy.

When a task creates or substantially modifies a user-facing flow, the task must:

1. internationalize all new user-visible strings in that scope;
2. migrate directly related hard-coded legacy strings that are being changed or
   are part of the same interaction;
3. add both `es` and `en` messages;
4. preserve the existing locale-routing and `next-intl` conventions;
5. avoid broad unrelated translation refactors merely because nearby legacy
   strings exist.

A substantial modification includes changes to visible wording, interaction,
validation behavior, field structure, or the domain concept represented by the
flow.

## No new localization debt

New UI and product behavior must not introduce hard-coded user-visible copy when
the string can be represented through the existing internationalization layer.

Temporary hard-coded product text requires an explicit reason and should be
tracked as debt rather than becoming an informal exception.

## Translation semantics

Translations must preserve product and domain meaning. They should not be
literal translations of internal TypeScript identifiers or database values when
natural product vocabulary differs.

Stable domain values remain language-independent in code and persistence. The UI
maps those values to localized labels and explanations.

For example:

```text
PlanningIntent.development
        |
        +-- es: Desarrollo
        `-- en: Development
```

The persisted/domain value remains `development`; only presentation is
localized.

## Domain glossary relationship

The product-help and domain-glossary policy is a specialized application of this
broader internationalization policy.

Glossary terms, summaries, coach-specific detail, athlete-specific detail, and
contextual help must follow the same `es`/`en` requirement. The glossary must not
become a separate localization mechanism.

## Validation and server actions

User-facing validation and server-action messages are part of the product
experience and therefore belong to the internationalization migration.

Where architecture currently makes localization difficult, a focused task may
first establish a language-neutral error code or structured validation result
and translate it at the presentation boundary. Do not couple pure domain rules
to React or `next-intl` solely to eliminate a hard-coded string.

## Formatting

Locale-aware formatting should be used where presentation depends on language or
regional conventions. Dates, numbers, percentages, and similar values must not
be embedded into translated prose using ad-hoc concatenation when the
internationalization layer can format them safely.

Units that are stable domain notation, such as `km` or `m+`, may remain shared
when their product meaning does not change by locale, while surrounding labels
and explanatory copy remain localized.

## Definition of done rule

For every new or substantially modified user-facing scope:

- no new hard-coded product copy is introduced without an explicit exception;
- directly affected legacy copy is migrated where practical;
- Spanish and English messages are added together;
- both locales are considered in manual review when the change affects UI;
- missing translations are treated as incomplete implementation, not optional
  polish.

This rule does not require a story to translate unrelated legacy screens.

## Migration strategy

The application is migrated progressively rather than through an all-at-once
localization rewrite:

```text
new work
  -> fully internationalized

modified legacy flow
  -> migrate affected copy

untouched legacy flow
  -> remains debt until its scope is visited
```

A dedicated cleanup task may still be created when remaining localization debt
is concentrated enough to justify it, but routine feature work should steadily
reduce that debt by following this policy.

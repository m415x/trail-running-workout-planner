# UX action safety

## Status

Pending cross-cutting UX/technical debt. Tracked in Jira as **KAN-282**. This work is intentionally deferred from the KAN-257/KAN-280 race-catalog closure, while feature work may adopt the policy incrementally when a concrete flow requires it.

## Problem

Actions should not require confirmation solely because they are destructive. Confirmation friction must be proportional to the risk of accidental execution and the consequence of the action.

Several existing flows can currently commit a meaningful state change or discard unsaved form work with too little friction. Conversely, harmless operations should not accumulate unnecessary confirmation dialogs. The policy must therefore be solved consistently rather than with isolated page-specific dialogs.

Known examples include:

- deactivating an athlete directly from the athlete list;
- cancelling or archiving entities where the action changes lifecycle state;
- bulk operations where an accidentally selected entity could receive an unintended domain change;
- leaving an edit form after making changes without saving, including back navigation or changing dashboard section.

## Existing primitive

`ConfirmActionDialog` in `components/ui/custom/confirm-dialog.tsx` is the reusable confirmation primitive for explicit actions that require a confirmation barrier. New ad-hoc confirmation dialogs should not be introduced when this component satisfies the interaction.

Its variants communicate the nature of the confirmation:

- `primary` for significant, non-destructive actions that warrant contextual review;
- `destructive` for destructive or high-impact actions.

The primitive does not determine whether an action needs confirmation. That decision follows the risk levels below.

## Action confirmation levels

### Level 1 — ordinary / low risk

Do not require confirmation for ordinary operations whose accidental execution has little consequence or can be corrected immediately without a meaningful domain effect.

Examples include harmless navigation, filters, read-only actions and other routine interactions.

The absence of a confirmation dialog is deliberate: confirmation fatigue reduces the value of confirmation barriers elsewhere.

### Level 2 — significant / error-prone

Require contextual confirmation when an action is not inherently destructive but an accidental selection or execution can produce a meaningful domain change.

This level especially applies to bulk operations or interactions where the user may reasonably overlook an extra selected entity.

Use `ConfirmActionDialog`, normally with `variant='primary'`. The dialog must summarize the concrete effect before committing it, including the affected entities and destination or target when relevant.

Race registration provides the first explicit adoption case. A coach performing course-first bulk registration selects only eligible athletes and, before the mutation is executed, reviews a confirmation such as: `Estás por inscribir a Ana, Juan y Pedro en Ansilta XK 2026 · 21K.` This protects against an athlete remaining selected accidentally without presenting the operation as destructive.

The confirmation is a review barrier, not a replacement for application, domain or persistence validation.

### Level 3 — destructive / high impact

Require reinforced confirmation for destructive, lifecycle-changing or otherwise high-impact actions when accidental execution has a meaningful consequence.

Use `ConfirmActionDialog`, normally with `variant='destructive'`, before actions such as deactivate, archive, cancel, unlink or equivalent operations.

The dialog must:

- name the action and affected entity clearly;
- explain whether the operation is reversible;
- distinguish lifecycle cancellation/archive from hard deletion;
- require an explicit confirmation action.

If a future operation warrants a stronger barrier than the current primitive provides — for example typed acknowledgement — that requirement must be justified by its risk rather than added indiscriminately to all Level 3 actions.

## Unsaved form changes

Unsaved-change protection is related action-safety infrastructure but is not one of the three explicit action-confirmation levels. `ConfirmActionDialog` alone is not sufficient.

Forms that can lose meaningful edits need a reusable dirty-form/navigation guard capable of intercepting the navigation paths supported by the application, including internal navigation and browser exit/reload where technically possible.

The guard should:

- activate only after the form differs from its persisted/initial state;
- not prompt after a successful save or when nothing changed;
- offer an explicit choice to remain editing or discard changes;
- be reusable across feature modules instead of coupling the behavior to athlete forms.

## Action density and menus

When a row, card, or page header exposes three or more peer secondary actions, group them in the shared Shadcn `DropdownMenu`. Use an explicit “Actions” trigger on detail pages and an accessible ellipsis trigger in dense tables.

A frequently used primary action may remain visible when the product hierarchy justifies it; the menu is not a reason to hide the only clear next step. Lifecycle/destructive entries must use destructive styling, but menu placement does not replace the confirmation required by this policy.

## Non-goals

- Do not add confirmation to harmless navigation or read-only actions.
- Do not classify every write operation as destructive merely because it persists data.
- Do not use confirmation dialogs to compensate for unclear domain lifecycle semantics or missing validation.
- Do not convert cancel/archive operations into hard deletes solely for UI convenience.
- Do not create feature-specific confirmation primitives when `ConfirmActionDialog` satisfies the interaction.

## Adoption

The athlete list and athlete detail header are the first adopted action-density examples. KAN-282 should inventory existing actions and editable forms, apply the three-level policy consistently, establish shared patterns where the existing primitive is insufficient, then migrate flows incrementally.

KAN-366 race registration is the first explicit Level 2 adoption: course-first multi-select registration must provide a contextual review/confirmation before committing the bulk operation.

Athlete deactivation and athlete edit navigation remain known regression cases from the KAN-280 walkthrough; the former belongs to explicit action confirmation and the latter to unsaved-change protection.

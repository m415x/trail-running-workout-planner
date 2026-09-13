# UX action safety

## Status

Pending cross-cutting UX/technical debt. Tracked in Jira as **KAN-282**. This work is intentionally deferred from the KAN-257/KAN-280 race-catalog closure.

## Problem

Several existing flows can currently commit a destructive state change or discard unsaved form work with too little friction. The policy must be solved consistently rather than with isolated page-specific dialogs.

Known examples include:

- deactivating an athlete directly from the athlete list;
- cancelling or archiving entities where the action changes lifecycle state;
- leaving an edit form after making changes without saving, including back navigation or changing dashboard section.

## Existing primitive

`ConfirmActionDialog` is the reusable confirmation primitive for explicit destructive or lifecycle-changing actions. New ad-hoc confirmation dialogs should not be introduced when this component satisfies the interaction.

## Required future policy

### Explicit destructive/lifecycle actions

Use `ConfirmActionDialog` before actions such as deactivate, archive, cancel, unlink or equivalent operations when an accidental click would have a meaningful consequence.

The dialog must:

- name the action and affected entity clearly;
- explain whether the operation is reversible;
- distinguish lifecycle cancellation/archive from hard deletion;
- require an explicit confirmation action.

### Unsaved form changes

`ConfirmActionDialog` alone is not sufficient. Forms that can lose meaningful edits need a reusable dirty-form/navigation guard capable of intercepting the navigation paths supported by the application, including internal navigation and browser exit/reload where technically possible.

The guard should:

- activate only after the form differs from its persisted/initial state;
- not prompt after a successful save or when nothing changed;
- offer an explicit choice to remain editing or discard changes;
- be reusable across feature modules instead of coupling the behavior to athlete forms.

## Non-goals

- Do not add confirmation to harmless navigation or read-only actions.
- Do not use confirmation dialogs to compensate for unclear domain lifecycle semantics.
- Do not convert cancel/archive operations into hard deletes solely for UI convenience.

## Adoption

KAN-282 should inventory current destructive actions and editable forms, establish the shared pattern, then migrate flows incrementally. Athlete deactivation and athlete edit navigation are the first known regression cases from the KAN-280 walkthrough.

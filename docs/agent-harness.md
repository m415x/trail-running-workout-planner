# Agent harness — story workflow and evaluation

## Purpose

This document describes the development harness used to execute Jira stories without depending on long chat history. `AGENTS.md` is the operational authority; this document explains the experiment and provides the compact evaluation record for the final two Epic 3 stories.

The goal is not minimum token usage in isolation. The goal is to reduce wasted context, redundant tool activity and retry loops **without reducing correctness, acceptance-criteria coverage, verification honesty or handoff quality**.

## Harness architecture

```text
short bootstrap prompt
        ↓
AGENTS.md — stable operational contract
        ↓
just-in-time retrieval
  ├─ docs indexes / architecture / glossary / research
  ├─ current handoff
  ├─ Jira story/tasks
  └─ focused code/tests
        ↓
working context
        ↓
implementation + focused verification
        ↓
story closure
        ↓
durable documentation + next-story baseline
        ↓
fresh-chat capable next story
```

### Context rules

- Durable repository sources and Jira replace conversation history as project authority.
- Bootstrap loads indexes and the minimum relevant baseline; detail is retrieved just in time.
- Large tool outputs should not be repeatedly reloaded or carried conceptually after their decision-relevant findings and stable locators are known.
- A Jira story is the natural compaction boundary: closure converts working context into architecture, glossary/research changes where relevant, indexes, Jira evidence and a concise handoff.

### Tool/error rules

- Use the narrowest available action that answers the current question.
- Diagnose the first failure before retrying.
- Stop after two substantially equivalent failed attempts and change strategy.
- Focused validation is preferred during implementation; the complete project gate remains a story-closure requirement.
- Never claim evidence that did not actually run.

## Evaluation protocol

`harness-eval-v1` is frozen for the final two Epic 3 stories. Do not tune it between stories unless a rule causes a blocking safety/correctness failure. Record such an exception explicitly.

At each story closure, append one compact record using the template below. Counts should be based on observable trace/evidence when available; use `unknown` rather than inventing precision.

### Story evaluation template

```md
### <Jira story> — harness-eval-v1

- Redundant/repeated tool calls: <count/unknown + short examples>
- Unnecessary large/full-source reloads: <count/unknown + examples>
- Equivalent failed-operation loops: <count>; retry budget respected: <yes/no/n-a>
- Context/source-of-truth mistakes: <count + description>
- Durable information unnecessarily requested from human: <count + description>
- Premature task/branch creation or reopened settled decisions: <count + description>
- Unnecessary local/full-gate requests during implementation: <count + description>
- Unsupported verification claims: <count + description>
- Missed acceptance criteria attributable to workflow/context handling: <count + description>
- Corrective human interventions attributable to harness behavior: <count + description>
- Durable documentation/handoff complete: <yes/no + gaps>
- Evidence that reduced context/tool usage harmed correctness: <none/description>
- Notes for post-experiment v2 (do not change v1 yet): <short observations>
```

## Behavioral evals

These are expected harness behaviors rather than product tests:

| Situation | Expected behavior |
| --- | --- |
| New story starts | Read `AGENTS.md` and durable baseline before designing |
| Previous handoff exists | Use it as a navigation/baseline source, then verify current truth |
| Jira and code/docs disagree | Surface the discrepancy rather than silently choosing |
| Story looks partially implemented | Inspect implementation before creating tasks |
| New story branch needed | Start from current `dev` and infer existing naming convention |
| Tool/action fails once | Diagnose before retrying |
| Same mechanism fails twice | Stop repeating and change strategy |
| Large source was already inspected | Retain finding + locator; reload only when detail is needed |
| Task appears complete | Reconcile against original Jira intent/AC |
| Durable decision is introduced | Place it in the appropriate durable source |
| Implementation plan is complete | Mark it completed/historical |
| Test/gate has no execution evidence | Do not describe it as passing |
| Story closes | Perform full applicable gate and AC-by-AC review |
| Story closes | Produce durable docs + next-story baseline |
| Next chat starts | Do not require previous chat history |

## Post-experiment review

After both remaining Epic 3 stories are complete, compare their evaluation records. Classify observations as:

- **keep** — rule demonstrably prevented waste/error or improved continuity;
- **remove** — rule added ceremony/context without observable value;
- **revise** — useful intent but poor threshold/wording/tool interaction;
- **new failure mode** — recurring problem not addressed by v1.

Only then publish a `harness-eval-v2` change. Avoid optimizing solely for fewer tokens; correctness and human intervention remain counter-metrics.


## Story evaluations

### KAN-281 — harness-eval-v1

- Redundant/repeated tool calls: observed; notable cases included asking for already-pasted test/typecheck evidence and some repeated source/test inspection during reconciliation.
- Unnecessary large/full-source reloads: observed but not precisely counted; large TypeScript/test output was later reduced through filtered extraction and partitioned race-registration batches.
- Equivalent failed-operation loops: observed in SQLite/Supabase schema-reflection and Drizzle DB-typing attempts; retry discipline eventually changed strategy rather than continuing the same mechanism.
- Context/source-of-truth mistakes: at least one implementation fixture initially used the conceptual nested scope shape instead of the current top-level persistence shape; current code/types corrected it.
- Durable information unnecessarily requested from human: at least one repeated gate/evidence request after the user had already supplied it.
- Premature task/branch creation or reopened settled decisions: none observed; the existing story branch remained canonical.
- Unnecessary local/full-gate requests during implementation: some redundant requests occurred, then verification was partitioned/focused; the final complete gate was correctly reserved for closure.
- Unsupported verification claims: none retained as closure evidence; stale gates were explicitly marked stale after later production changes.
- Missed acceptance criteria attributable to workflow/context handling: automated structural coverage did not catch several runtime/IA defects before manual validation.
- Corrective human interventions attributable to harness behavior: the human flagged repeated evidence requests, athlete-first edition/course filtering, Stats-vs-Plan information architecture, RaceEdition density and stale participation-editor state.
- Durable documentation/handoff complete: yes for KAN-281; architecture, glossary, indexes, handoff and next-story baseline were consolidated by KAN-367.
- Evidence that reduced context/tool usage harmed correctness: structural source tests and narrow static inspection gave false confidence around independent edition/course selects, a form-field contract mismatch and RSC/client state synchronization; manual runtime validation materially improved correctness.
- Notes for post-experiment v2 (do not change v1 yet): retain source-of-truth ordering, manual closure walkthrough and focused/partitioned verification. Review how structural source tests are weighted, how already-supplied human evidence is tracked, and how retry limits are enforced for type-system/schema experiments.


### KAN-282 — harness-eval-v1

- Redundant/repeated tool calls: observed; notable cases were repeated edits of the KAN-372 inventory test and repeated hypotheses while diagnosing browser/dialog behavior.
- Unnecessary large/full-source reloads: none material retained as closure evidence; focused source retrieval and log-tail commands were generally used.
- Equivalent failed-operation loops: observed; retry budget was not consistently respected. Six Jira subtask creates used the wrong issue-type name before switching strategy, KAN-370 went through event-handler and timer hypotheses before structural diagnosis, and the KAN-372 inventory edit required repeated correction.
- Context/source-of-truth mistakes: observed. A local command initially assumed PowerShell despite the human using Bash; an early remote RED request omitted `git pull`; and the KAN-372 inventory initially relied on stale/default-branch workout evidence rather than the story branch.
- Durable information unnecessarily requested from human: none material after the Bash workflow was made durable in `AGENTS.md`.
- Premature task/branch creation or reopened settled decisions: none after story understanding/decomposition approval; branch and Jira subtasks were created only after the requested approvals.
- Unnecessary local/full-gate requests during implementation: no complete project gate was required before KAN-373; focused verification was used per task and the full gate was reserved for story closure.
- Unsupported verification claims: none retained. The native `beforeunload` dialog was not claimed after the browser suppressed it; runtime instrumentation established only that the handler fired and applied `preventDefault`/`returnValue`.
- Missed acceptance criteria attributable to workflow/context handling: structural tests did not catch dropdown-owned dialog unmounting, the RSC/client event-handler boundary, or implicit form submission around the registration cancellation dialog. Manual task walkthroughs caught these before closure.
- Corrective human interventions attributable to harness behavior: observed. The human corrected the shell assumption, exposed the missing-pull RED failure, reported the KAN-370 disappearing dialog, reported the KAN-371 RSC runtime and implicit-submit defects, and surfaced course-change confirmation plus legacy athlete i18n/future-DOB follow-up debt.
- Durable documentation/handoff complete: yes; action-safety architecture, Epic 3 handoff, Bash shell rule, Jira evidence and follow-up issues are durable.
- Evidence that reduced context/tool usage harmed correctness: source-regex/structural tests alone gave false confidence around client ownership and browser runtime behavior. Manual walkthroughs and targeted instrumentation were necessary; reduced source loading itself was not shown to be the cause.
- Notes for post-experiment v2 (do not change v1 yet): keep source-of-truth ordering, focused verification, story-level full gates, manual runtime walkthroughs and durable handoffs. Revise retry enforcement, branch-aware search discipline and tracking of already-known shell/evidence state. Treat structural source tests as regression hints, not runtime proof.

## Post-experiment comparison — KAN-281 vs KAN-282

Both stories support keeping the durable source-of-truth order, focused implementation gates, final full gate, manual closure walkthrough and story handoff. In both, structural/static tests missed runtime interaction defects, so they should not be treated as substitutes for behavioral validation.

KAN-282 improved task sizing and deferred the complete project gate until closure, but retry discipline remained the clearest weakness: repeated Jira creation attempts, dialog hypotheses and the inventory-test edit exceeded the intended two-attempt strategy. KAN-282 also exposed branch-aware source retrieval and durable shell state as explicit failure modes.

For a future v2, classify the current observations as follows: **keep** source-of-truth ordering, focused verification, manual walkthrough and closure documentation; **revise** retry-budget enforcement and evidence-state tracking; **new failure mode** branch/default-branch search ambiguity and transient-component ownership not represented by structural tests. No v2 rules are published by this record.

### KAN-462 — harness-eval-v1

- Redundant/repeated tool calls: low; one full `billing.ts` reload was used during implementation after earlier focused reads, otherwise retrieval stayed path/section scoped.
- Unnecessary large/full-source reloads: 1 observed (`billing.ts`); no repeated large documentation reloads after bootstrap.
- Equivalent failed-operation loops: 0; retry budget respected: yes. Jira subtask creation hit one transient Atlassian database outage, then creation switched to the legacy create action after service recovery instead of repeating the same failing mechanism.
- Context/source-of-truth mistakes: 0 material. A multi-currency aggregate risk was identified before implementation and resolved by deriving balances per persisted currency rather than inventing conversion.
- Durable information unnecessarily requested from human: 0.
- Premature task/branch creation or reopened settled decisions: 0; task/branch creation followed explicit decomposition approval.
- Unnecessary local/full-gate requests during implementation: 0; focused TDD was used and the full gate remained reserved for KAN-493 closure.
- Unsupported verification claims: 0. A structural integration test that was already GREEN when introduced was explicitly not recorded as RED evidence.
- Missed acceptance criteria attributable to workflow/context handling: 0 known before closure walkthrough/full gate.
- Corrective human interventions attributable to harness behavior: 0; human responses during TDD supplied expected execution evidence and surfaced normal failing assertions/typecheck output.
- Durable documentation/handoff complete: yes; memberships architecture, documentation index and KAN-493 handoff were updated before final gate.
- Evidence that reduced context/tool usage harmed correctness: none observed. Focused tests exposed legacy caller/type and UI presentation mismatches before closure.
- Notes for post-experiment v2 (do not change v1 yet): explicit evidence-state tracking continued to prevent false RED/GREEN claims; retry-budget discipline worked for the transient Jira outage. Structural tests remain regression evidence, not substitutes for the manual closure walkthrough.


### KAN-463 — harness-eval-v1

- Redundant/repeated tool calls: low. One Jira create batch failed because the localized issue-type name `Subtarea` was invalid; metadata was then queried and the correct `Subtask` type was used.
- Unnecessary large/full-source reloads: limited; the Coach athlete page and Membership architecture were loaded at closure/reconciliation points where full context was materially useful.
- Equivalent failed-operation loops: 0; retry budget respected: yes. The failed Jira create mechanism was not repeated after diagnosis.
- Context/source-of-truth mistakes: 0 material. The prior-debt rule was explicitly changed by product decision before implementation and recorded in Jira/docs before closure.
- Durable information unnecessarily requested from human: 0.
- Premature task/branch creation or reopened settled decisions: 0; subtasks and branch were created only after explicit approval of the adjusted decomposition.
- Unnecessary local/full-gate requests during implementation: 0; focused TDD remained task-scoped and the complete gate was reserved for KAN-499 closure.
- Unsupported verification claims: 0. T5 regressions that were GREEN when introduced were explicitly recorded as GREEN-on-introduction, not as RED/GREEN cycles.
- Missed acceptance criteria attributable to workflow/context handling: 0 known before closure gate/walkthrough.
- Corrective human interventions attributable to harness behavior: 0; the human supplied expected RED/GREEN execution evidence and made the product decision that prior-month pending extensions must not block before implementation.
- Durable documentation/handoff complete: yes before final gate; Membership architecture, documentation index and KAN-499 handoff record the H5 contract and KAN-464 entry boundary.
- Evidence that reduced context/tool usage harmed correctness: none observed. Focused domain/read-model/UI tests plus cross-surface boundary regressions covered the intended seams; manual walkthrough remains required closure evidence.
- Notes for post-experiment v2 (do not change v1 yet): querying project issue-type metadata immediately after the first Jira type mismatch avoided a retry loop. Continue distinguishing product-semantic changes from implementation defects and record GREEN-on-introduction regressions honestly.


### KAN-504 — harness-eval-v1

- Redundant/repeated tool calls: low; retrieval was generally task-scoped, with a few closure-time full-file reads used to reconcile current contracts.
- Unnecessary large/full-source reloads: limited; one large competition route read and closure documentation reads were materially tied to integration/reconciliation.
- Equivalent failed-operation loops: 0 material; retry budget respected: yes. Unexpected GREEN/RED results were diagnosed before changing strategy or assertions.
- Context/source-of-truth mistakes: 1 minor test-design mistake. The first action-conflict structural test searched the whole action module and produced a false-positive GREEN; it was immediately narrowed to the target action body before implementation evidence was accepted.
- Durable information unnecessarily requested from human: 0 material. Human execution was requested for the agreed local TDD/full-gate commands and manual walkthroughs.
- Premature task/branch creation or reopened settled decisions: 0; the existing approved KAN-504 decomposition and story branch remained authoritative.
- Unnecessary local/full-gate requests during implementation: 0; focused TDD was used per task and the complete project gate was reserved for KAN-520 closure.
- Unsupported verification claims: 0 retained. Structural tests were treated as structural evidence; runtime/manual walkthroughs and SQLite integrations were used where required.
- Missed acceptance criteria attributable to workflow/context handling: 0 at closure. Manual walkthrough clarified that the shared-race multi-group visual case was not naturally reproducible from the current seed; automated isolation evidence was recorded instead of fabricating data.
- Corrective human interventions attributable to harness behavior: 1 minor. The human surfaced that the multi-group walkthrough case could not be reproduced naturally, which led to an evidence-class clarification rather than a product/code change.
- Durable documentation/handoff complete: yes; planning-cohort and race-catalog planning contracts, architecture/documentation indexes and the KAN-473 handoff now encode the KAN-504 baseline and KAN-505 entry boundary.
- Evidence that reduced context/tool usage harmed correctness: none observed. The one structural false-positive came from test scope, not reduced retrieval, and was corrected before implementation evidence was accepted.
- Notes for post-experiment v2 (do not change v1 yet): continue treating structural tests as wiring hints rather than runtime proof. Preserve the distinction between naturally reproducible walkthrough evidence and deterministic automated evidence; do not manufacture demo data solely to satisfy a visual checklist.


### KAN-522 — harness-eval-v1

- Redundant/repeated tool calls: low; one Supabase verifier diagnosis reloaded large migration/schema context, but the final diagnosis stayed focused on the failing contract.
- Unnecessary large/full-source reloads: limited; closure-time architecture/handoff reads were required to reconcile durable documentation.
- Equivalent failed-operation loops: 1 connector pattern was blocked twice for long Jira closure comments; strategy changed to shorter materialization instead of repeating the same payload.
- Context/source-of-truth mistakes: 1 test-design mistake. A regeneration test initially injected sibling-plan prescriptions into `reconcileSessionGeneration()`, violating its documented precondition that existing prescriptions are pre-scoped to the active plan. The test was removed and moved to the real persistence boundary.
- Durable information unnecessarily requested from human: 0.
- Premature task/branch creation or reopened settled decisions: 0; implementation followed the already-approved KAN-522 decomposition.
- Unnecessary local/full-gate requests during implementation: 0; focused TDD was used until KAN-529 closure.
- Unsupported verification claims: 0. The initial Supabase verifier FAIL was treated as a real closure blocker; no remote migration success was claimed until `pn db:supabase:migrate` and `pn db:supabase:verify` were actually run.
- Missed acceptance criteria attributable to workflow/context handling: 0 known at closure. A legacy `updateSession()` identity mismatch was detected during T5/T6 reconciliation and fixed before the final gate.
- Corrective human interventions attributable to harness behavior: 0 material; human RED/GREEN and full-gate evidence followed the approved workflow.
- Durable documentation/handoff complete: yes; planning-cohort, session-generation and KAN-473 handoff contracts now encode planning-scope prescription identity and Athlete resolution.
- Evidence that reduced context/tool usage harmed correctness: none observed. Focused RED/GREEN cycles exposed the relevant boundaries while closure reconciliation caught the remaining manual-edit mismatch.
- Notes for post-experiment v2 (do not change v1 yet): continue distinguishing pure reconciler preconditions from persistence/orchestration boundaries. Shorter Jira evidence payloads are more reliable with the connector.


### KAN-521 — harness-eval-v1

- Redundant/repeated tool calls: low to moderate; most retrieval remained task-scoped, though closure reconciliation required several focused rereads of the Coach adjustment action/component after walkthrough defects were found.
- Unnecessary large/full-source reloads: limited; one large action-file reload was used during stale-authority diagnosis, otherwise reads were path-scoped.
- Equivalent failed-operation loops: 0 material; retry budget respected: yes. False REDs caused by outdated structural assertions were diagnosed and corrected rather than retried unchanged.
- Context/source-of-truth mistakes: 2 test-design mistakes. One regex used the unsupported dotAll flag for the project target; another assertion expected a literal withdrawn state instead of the implemented conditional expression. Both were corrected before accepting GREEN evidence.
- Durable information unnecessarily requested from human: 0 material. Human execution was requested only for local TDD/full-gate/manual walkthrough evidence.
- Premature task/branch creation or reopened settled decisions: 0; implementation stayed within the approved KAN-521 decomposition and existing story branch.
- Unnecessary local/full-gate requests during implementation: 0; focused TDD was used during implementation and the full gate was repeated only after walkthrough-driven code changes invalidated the earlier closure gate.
- Unsupported verification claims: 0 retained. Manual/runtime findings were distinguished from structural tests, and the prior full gate was explicitly treated as stale after subsequent changes.
- Missed acceptance criteria attributable to workflow/context handling: 0 at closure. Manual walkthrough exposed defects that structural tests did not catch: Home using the legacy group-only loader, persisted values not remounting immediately, raw/partial i18n, UUID stimulus entry, competing assignment controls, excessive input density, return-to-inherit semantics, and stale soft-deleted source visibility.
- Corrective human interventions attributable to harness behavior: several product/UX findings came from the human walkthrough, but they were not caused by missing durable context; they materially improved runtime correctness and usability before closure.
- Durable documentation/handoff complete: yes; planning architecture and KAN-473 handoff now record KAN-521 authority, audit, regeneration, Athlete resolution and deferred i18n debt.
- Evidence that reduced context/tool usage harmed correctness: none observed. The main missed issues were runtime/interaction defects that required manual walkthrough rather than broader source loading.
- Notes for post-experiment v2 (do not change v1 yet): preserve final manual walkthroughs and the rule that any post-gate code change invalidates closure evidence. Structural tests remain useful regression hints, but runtime state transitions and UI affordances need behavioral/manual verification.

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

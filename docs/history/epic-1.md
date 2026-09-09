# Epic 1 — Planning Core

Status: completed.

## Purpose

Epic 1 built the first functional planning core of the Trail Running Workout
Planner.

The project started from a practical problem: a coach was manually preparing
a large number of training plans in spreadsheets. The first goal was not to
automate the complete coaching methodology, but to determine whether that
workflow could be represented coherently in software.

This epic therefore focused on the minimum vertical slice required to manage
athletes and groups, define training goals, build a planning hierarchy,
schedule shared training sessions, and expose the resulting work to athletes.

The domain model was not considered final. Several assumptions made during
this phase were later reviewed against the coach's real workflow and refined
during Epic 2.

---

## H0 — Define the Phase 1 domain model

### Context

The project already contained planning concepts and partial implementations,
but ownership between athletes, groups, goals, planning cycles, and sessions
was not sufficiently clear.

Continuing feature development without resolving those boundaries risked
creating several competing sources of truth.

### Goal

Audit the existing schema and TypeScript model and establish a coherent
domain for the Phase 1 MVP.

### Result

The planning hierarchy was organized around the group:

```text
GroupTrainingPlan
└── Macrocycle
    └── Mesocycle
        └── Microcycle
```

Training events were separated from that hierarchy:

```text
Session
└── GroupSessionPrescription
```

Athlete context remained separate:

```text
AthleteProfile
├── AthleteGroup
└── TrainingGoal
```

### Decisions at this stage

- Planning would be primarily group-based.
- `AthleteProfile` would represent the athlete in the sporting domain.
- `AthleteGroup` would organize athletes who train together.
- `GroupTrainingPlan` would own the planning hierarchy.
- `TrainingGoal` would provide athlete-specific planning context.
- `Session` would represent a shared training event.
- `GroupSessionPrescription` would describe the work assigned to a group
  within that event.
- Individual differences should not silently mutate the shared group plan.
- The coach would retain authority over generated planning.

### Why it mattered

H0 changed the direction of the project from a collection of planning
features into an explicit domain model.

It also established a principle that survived later refinements:

> Automation should support group planning without removing explicit coach
> control.

---

## H1 — Manage athletes

### Goal

Provide the coach with the athlete management required by the rest of the
planning workflow.

### Result

`AthleteProfile` management was completed with:

- athlete listing;
- creation;
- editing;
- active/inactive state;
- athlete detail.

### What we learned

Athlete identity and planning ownership needed to remain separate.

An athlete provides context for planning, but making every plan athlete-owned
would conflict with the coach's real workflow, where many athletes train and
are planned together.

This became one of the first practical reasons to keep the system
group-oriented.

---

## H2 — Manage training groups

### Goal

Represent the groups the coach uses to organize athletes who train together.

### Result

`AthleteGroup` management was implemented with:

- group creation and editing;
- athlete assignment;
- group changes;
- group membership information;
- member views.

### Decision at this stage

The group became the main operational unit for shared planning.

This allowed the coach to work with groups instead of maintaining an
independent planning structure for every athlete.

### Limitation discovered later

At this stage, belonging to the same sporting group and sharing the same
planning variant were effectively treated as the same concept.

Later coach feedback showed that this was too restrictive.

Athletes may belong to the same sporting category or level while temporarily
requiring different planning because of their objectives or preparation
context.

Epic 2 later addresses this distinction without removing the stable sporting
group.

---

## H3 — Define training goals

### Goal

Represent the objective that gives direction to an athlete's training, with
or without a target race.

### Result

`TrainingGoal` was introduced with:

- optional race context;
- validation;
- creation UI;
- persistence.

### Early ambiguity

The original planning discussions did not yet fully separate the group's
planning objective from each athlete's individual objective.

This created an important question:

> If athletes train together, do they necessarily share the same goal?

### Domain refinement

Further analysis showed that they do not.

Athletes can train together while preparing for different objectives or
different race dates.

The responsibility therefore became clearer:

```text
AthleteProfile
└── TrainingGoal
```

while:

```text
AthleteGroup
└── GroupTrainingPlan
```

### Lasting consequence

`TrainingGoal` became individual context rather than ownership of the shared
group plan.

This distinction later becomes essential when the system needs to support
planning variants inside the same sporting group.

---

## H4 — Generate planning

### Goal

Generate an initial training plan instead of requiring the coach to manually
create every planning cycle.

### Result

The application established the hierarchy:

```text
GroupTrainingPlan
└── Macrocycle
    └── Mesocycle
        └── Microcycle
```

Generation covered:

- goals with and without target races;
- macrocycle planning;
- mesocycle generation;
- microcycle generation;
- initial target-volume distribution;
- taper handling;
- persistence.

### Decision at this stage

The planning hierarchy belonged to `GroupTrainingPlan`.

Child cycles did not need to independently own group and goal context when
that context could be resolved through the plan.

### What this solved

For the first time, the application could turn planning context into a
structured temporal plan.

The coach no longer needed to manually create the complete hierarchy before
working with it.

### Limitation discovered later

The first generator necessarily relied on simplified rules and heuristics.

It could create a planning structure, but it did not yet represent the full
methodology the coach uses to determine:

- progressive load;
- recovery;
- volume;
- elevation gain;
- intensity;
- weekly training frequency;
- session distribution.

This limitation became one of the main reasons for Epic 2.

---

## H5 — Edit planning

### Context

Automatic generation alone was insufficient.

Even a reasonable generated plan must be adjusted according to the coach's
judgment and the athlete or group's actual situation.

### Goal

Allow the coach to modify the generated planning instead of treating
generation as an immutable result.

### Result

Planning values such as the following became editable and persistable:

- volume;
- dates;
- microcycle type;
- notes;
- other planning adjustments.

### Domain decision

A fundamental rule emerged:

> Generated planning is a proposal. Explicit coach decisions take
> precedence.

This was initially a functional requirement for editing, but later became a
general automation invariant.

### Later evolution

Epic 2 formalizes this principle through provenance and regeneration rules.

Generated values may be recalculated, but explicit manual decisions must not
be silently destroyed by regeneration.

---

## H6 — Schedule training sessions

### Goal

Move from abstract weekly planning to actual training events that athletes
can perform.

### Result

Session scheduling introduced:

- training date;
- training type;
- location;
- volume;
- group-specific workload;
- intensity;
- structure;
- instructions and notes.

A key domain separation emerged:

```text
Session
└── GroupSessionPrescription
```

### Why this separation was necessary

A training event can be shared.

For example, several groups may train at the same mountain location on the
same day while performing different workloads.

Duplicating the complete `Session` for every group would incorrectly model
the real event.

Instead:

- `Session` represents what, when, and where the shared event occurs.
- `GroupSessionPrescription` represents what a particular group performs.

### Early simplification

At this point, concepts such as intensity could still be represented
generically.

The MVP needed to prove that a session could carry a prescription; it did
not yet model every physiological method used by the coach.

### Later coach feedback

Further discussion with the coach clarified that intensity is prescribed
differently depending on the training stimulus.

Long or continuous sessions are commonly prescribed using heart-rate zones,
while shorter quality work such as intervals or fartlek may use a percentage
derived from the athlete's latest PAM assessment.

This later leads to explicit intensity methods instead of treating intensity
as one generic scalar concept.

---

## H7 — Training calendar

### Goal

Give the coach a practical temporal view of scheduled training.

### Result

The application added:

- monthly calendar view;
- weekly calendar view;
- scheduled session display;
- group filtering;
- session detail access.

### Domain decision

The calendar remained a projection of scheduled training rather than a new
planning source of truth.

Planning decisions belong to the planning hierarchy and prescriptions.
The calendar organizes their execution in time.

### Boundary discovered

Training scheduling and competition scheduling are related but different
problems.

The training calendar therefore did not become a general competition
calendar.

Competition-calendar concerns were deliberately left for later work.

---

## H8 — Athlete view

### Goal

Complete the first vertical slice by allowing athletes to see the training
they are expected to perform.

### Result

The athlete-facing weekly view exposed:

- current training sessions;
- workload applicable to the athlete's group;
- instructions;
- location.

### Phase 1 resolution model

At this stage, session applicability could be resolved primarily through the
athlete's current group:

```text
AthleteProfile
└── AthleteGroup
    └── GroupSessionPrescription
        └── Session
```

### What this proved

The application now supported a complete functional path:

```text
Coach
→ Athlete / Group
→ Planning
→ Session
→ Group prescription
→ Athlete view
```

This was the first usable end-to-end representation of the planning workflow.

### Limitation discovered later

The assumption that an athlete's current sporting group always determines
the applicable planning variant proved insufficient.

Later domain analysis showed that athletes may temporarily follow a different
planning variant while remaining members of the same sporting group.

This becomes a separate applicability problem in Epic 2 rather than a reason
to replace `AthleteGroup`.

---

## H9 — Stabilize and close Phase 1

### Context

By H8 the complete workflow existed, but several inconsistencies and
technical risks remained.

Starting a larger automation effort on top of those inconsistencies would
have made later domain changes harder to reason about.

### Goal

Stabilize the Phase 1 vertical slice before beginning the automation phase.

### Result

The closing work included:

- correct group-prescription handling during session creation and editing;
- alignment of Home with group planning;
- relative dates in seed data;
- lint and TypeScript tooling stabilization;
- automated tests for critical flows;
- migration preparation;
- parallel PostgreSQL/Supabase schema work;
- validation of the coach → group → athlete workflow.

### Persistence decision

SQLite remained the local application runtime.

PostgreSQL/Supabase was prepared as a parallel future persistence target
without becoming the runtime source of truth.

### Epic outcome

At the end of Epic 1, the MVP could represent the complete basic workflow.

It could manage athletes and groups, define goals, generate and edit planning,
schedule shared sessions, assign group-specific work, and expose that work to
athletes.

What it could not yet do reliably was reproduce the coach's complete planning
methodology.

That became the purpose of Epic 2.

---

# Between Epic 1 and Epic 2 — Domain validation

Completing the first vertical slice made it possible to discuss the system
with the coach using concrete workflows rather than abstract requirements.

Those conversations exposed several assumptions that had been acceptable for
the first MVP but were too simple for realistic planning.

This was not treated as a failure of Phase 1. The first implementation made
the missing domain knowledge visible.

Several important refinements emerged.

## Group membership is not planning equivalence

The initial model could plan effectively by sporting group.

Coach feedback showed that athletes in the same group may still require
different temporary planning variants.

The stable sporting classification therefore needed to remain separate from
temporary planning compatibility.

This later motivates `PlanningCohort`.

## Individual goals and shared planning are different concerns

Athletes training together may have different goals and race dates.

Therefore:

- `TrainingGoal` remains individual.
- Base planning remains group-owned.
- Individual context must not silently mutate shared planning.

## Training load requires explicit strategy

The initial generator could distribute planning values, but realistic
planning requires deliberate progression, recovery, and adjustment rules.

Load therefore needed to become an explicit planning concept rather than an
implicit generator heuristic.

## Volume and elevation are related but distinct

Trail-running workload cannot be represented adequately by distance alone.

Elevation gain must participate explicitly in planning and progression rather
than being treated only as session metadata.

## Intensity depends on the training stimulus

A single generic intensity representation was insufficient.

The coach's methodology distinguishes, among other cases:

- heart-rate-zone prescription for longer/continuous work;
- PAM-percentage prescription for shorter quality work.

This required explicit intensity methods and planning rules.

## Session generation must preserve coach authority

Once planning became detailed enough to generate sessions automatically, a
new problem appeared: regeneration could destroy deliberate coach changes.

Automation therefore needed provenance, stable identity, and regeneration
rules.

Generated work and manually modified work could no longer be treated as
equivalent.

---

# Architecture at Epic 1 completion

The conceptual model established during Phase 1 was:

```text
AthleteProfile ──────→ AthleteGroup
      │                    │
      │                    ▼
      │             GroupTrainingPlan
      │                    │
      │                    ▼
      │                Macrocycle
      │                    │
      │                    ▼
      │                Mesocycle
      │                    │
      │                    ▼
      │                Microcycle
      │
      └────→ TrainingGoal


Session
└── GroupSessionPrescription
```

This diagram describes domain responsibilities, not exact database
cardinalities or foreign keys.

## Durable outcomes

Epic 1 established several boundaries that survived later refinement:

- planning is primarily group-oriented;
- athlete identity is separate from planning ownership;
- individual goals and shared planning are separate concerns;
- `GroupTrainingPlan` owns the temporal planning hierarchy;
- `Session` represents a shared training event;
- `GroupSessionPrescription` represents group-specific work;
- athlete-specific differences must be explicit;
- generated planning must remain subordinate to explicit coach decisions;
- calendar and athlete views consume planning rather than becoming competing
  sources of truth.

Some concepts remained intentionally incomplete.

In particular, Phase 1 did not yet fully model load strategy, elevation
progression, intensity methodology, automatic session generation, temporary
planning variants, or date-aware plan applicability.

Those gaps define the transition to Epic 2.

---

# Transition to Epic 2

Epic 1 answered the first product question:

> Can the coach's planning workflow be represented as a functional software
> system?

The answer was yes.

The resulting vertical slice was sufficient to expose the next, harder
question:

> Can that workflow be automated while preserving the coach's methodology
> and control?

Epic 2 starts from that question.

Its purpose is not to replace the Phase 1 model, but to refine the simplified
assumptions discovered through implementation and coach feedback and turn the
planning core into a controlled automation system.

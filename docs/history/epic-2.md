# Epic 2 --- Planning Automation

Status: in progress.

## Purpose

Epic 1 proved that the coach's planning workflow could be represented as
a

functional software system.

Epic 2 addresses the next problem:

> Can that workflow be automated while preserving the coach's
> methodology

> and control?

The goal is not full autonomous planning.

The system should automate repetitive planning work, propose coherent
values,

and generate usable training structures while keeping the coach
responsible

for reviewing and adjusting the result.

This epic progressively replaces the simplified generation heuristics
from

Phase 1 with explicit domain concepts for load, progression, volume,

elevation, intensity, session templates, and session generation.

The implementation process also became a domain-discovery process.
Working

with increasingly concrete planning rules exposed assumptions that were

reviewed with the coach and refined as the epic progressed.

## About domain refinements

Several domain decisions in this epic were refined through informal

discussions with the coach while implementation was already in progress.

Those conversations were not recorded as formal refinement sessions, so
the

sections labeled "Domain refinement" describe the conceptual evolution
of

the model rather than claiming an exact meeting chronology.

The history preserves what changed and why when that rationale is known,

without inventing dates or attributing decisions to a specific meeting
when

the evidence is incomplete.

---

# Starting point

At the end of Epic 1, the application already supported the complete
basic

workflow:

```text

Athlete / Group

      ↓

GroupTrainingPlan

      ↓

Macrocycle

      ↓

Mesocycle

      ↓

Microcycle

      ↓

Session

      ↓

GroupSessionPrescription

      ↓

Athlete view
```

The structure worked, but much of the planning intelligence was still

simplified.

The application could represent a plan, but it did not yet model in
enough

detail how the coach decides:

- how training load evolves;

- when recovery is introduced;

- how weekly volume changes;

- how elevation gain participates in trail-running load;

- how intensity is prescribed;

- how many sessions should exist in a week;

- how those sessions distribute the planned workload;

- how automatic regeneration should interact with manual coach
  changes.

Epic 2 started by making those decisions explicit.

---

## H1 --- Define load strategy

### Context

Phase 1 could generate planning cycles and target values, but
progression was

embedded in generation logic rather than represented as an explicit
planning

decision.

That made it difficult to explain why a plan progressed in a particular
way

or to change the progression without changing the generator itself.

### Goal

Represent the intended load behavior of a training plan as explicit
domain

data.

### Result

Load strategy became a first-class planning concept.

Instead of treating weekly workload as a sequence of unrelated generated

numbers, the plan could express the strategy that should guide its
evolution.

This created a boundary between:

```text

Planning intent

      ↓

LoadStrategy

      ↓

Generated load values
```

### Domain outcome

The generator should consume planning strategy rather than secretly own
that

strategy.

This was an important shift in the automation model:

> Rules that express coaching intent belong to the domain model;
> generation

> applies those rules.

### Early assumption

At this stage, load strategy also appeared to be a natural place to
describe

weekly training frequency.

That assumption was later refined when session generation became
concrete.

---

## H2 --- Define load progression

### Context

Representing a strategy was not enough.

The system also needed deterministic rules for turning that strategy
into

load targets across mesocycles and microcycles.

### Goal

Calculate progressive load targets while respecting training phases and

recovery.

### Result

Load progression became explicit across the planning hierarchy.

The implementation introduced rules for:

- planning horizon;

- mesocycle target progression;

- microcycle load distribution;

- recovery/deload behavior;

- configurable deload percentage.

Conceptually:

```text

GroupTrainingPlan

      ↓

LoadStrategy

      ↓

Macrocycle horizon

      ↓

Mesocycle targets

      ↓

Microcycle targets
```

### Domain outcome

Progression and recovery became deliberate parts of planning rather than

incidental consequences of a generator.

A recovery microcycle is therefore not simply a week with an
accidentally

lower value. It represents an intentional change in load.

### What this enabled

Once weekly targets became explicit, later planning dimensions could be

derived from or coordinated with the same temporal structure.

This prepared the system for explicit distance, elevation, and intensity

planning.

---

# Domain refinement --- Planning strategy versus generated values

H1 and H2 exposed a broader architectural distinction.

The first implementation had mixed two responsibilities:

```text

What should the plan do?
```

and:

```text

What values should the generator produce?
```

Epic 2 began separating them.

Strategies express coaching intent.

Generators transform that intent into concrete planning values.

Persisted planning values remain reviewable and editable by the coach.

This distinction later becomes important for session generation, where
the

system must be able to regenerate automatic work without treating every

existing value as disposable.

---

## H3 --- Plan volume and elevation

### Context

Distance alone is not sufficient to describe trail-running workload.

Two sessions with the same distance can represent substantially
different

training demands when their elevation gain differs.

Phase 1 could store workload-related values, but elevation was not yet

integrated deeply enough into planning progression.

### Goal

Represent distance and elevation gain as explicit planning dimensions.

### Result

Weekly planning evolved from a primarily distance-oriented model toward
a

trail-specific workload model.

Conceptually:

```text

Microcycle

├── target volume

└── target elevation gain
```

Both dimensions could participate in planning rather than elevation
being

treated only as descriptive session metadata.

### Domain outcome

Volume and elevation are related planning dimensions but not
interchangeable

ones.

The system should be able to reason about both while preserving their

separate meaning.

### Why it mattered

This was one of the points where the application moved away from a
generic

running planner toward a trail-running-specific domain.

Planning could now better represent the difference between flat mileage
and

mountain workload.

### Later consequence

Session generation must eventually distribute both planned distance and

planned elevation across the week.

A generated set of sessions is not coherent merely because its total

kilometers match the microcycle target.

---

## H4 --- Plan intensity

### Context

Load, distance, and elevation describe only part of a training stimulus.

The system also needed to represent how hard the prescribed work should
be.

An early model could have treated intensity as a generic numeric value,
but

discussion of the coach's actual methodology showed that this would lose

important domain meaning.

### Goal

Represent intensity explicitly in planning and make its prescription
method

part of the domain.

### Coach feedback

The coach does not prescribe all training intensity using the same
method.

For longer or continuous sessions, intensity is commonly expressed
through

heart-rate zones.

For shorter quality work, such as intervals or fartlek, intensity may
instead

be prescribed as a percentage derived from the athlete's latest PAM

assessment.

Therefore:

```text

Intensity

├── HR zone

└── PAM percentage
```

was more accurate than:

```text

Intensity

└── generic number
```

### Result

Intensity planning became explicit and method-aware.

The domain distinguishes the prescription method rather than forcing
both

forms into a single ambiguous scalar.

A representative session-level model later became:

```text

TrainingIntensity

├── method: hr_zone

│   └── zone

│

└── method: pam_percentage

    └── percentage
```

PAM percentages use human-readable percentage values, so `92.5`
represents

`92.5%`, rather than storing the same value as `0.925`.

### Domain outcome

Intensity method is part of the meaning of the prescription.

A value without its method is insufficient.

### Important boundary

Planning intensity is authoritative.

Reusable templates may help describe a workout, but they must not
silently

override intensity determined by the plan.

---

# Domain refinement --- Intensity follows the training stimulus

This was an important example of implementation revealing missing domain

knowledge.

The original software problem appeared simple:

> A session needs intensity.

Coach feedback exposed the more accurate question:

> How is intensity prescribed for this type of training stimulus?

That changed the model from a generic property into an explicit method.

The lesson extended beyond intensity:

> Domain values that look numerically similar may represent different

> coaching concepts and should not be collapsed merely because they can
> share

> a primitive data type.

---

## H5 --- Define session templates

### Context

Once planning could describe load, volume, elevation, and intensity, the
next

problem was translating that planning into recognizable training
sessions.

Many sessions follow reusable structures.

Examples include recurring forms of continuous running, intervals,
fartlek,

recovery work, or other structured workouts.

Recreating those structures manually for every session would preserve
much of

the spreadsheet workload the project was intended to reduce.

### Goal

Introduce reusable workout/session templates without making templates
the

authority over planning.

### Result

Reusable templates became a source of session structure.

They can provide predefined training organization while remaining
subordinate

to the actual planning context.

Conceptually:

```text

Planning

   +

Workout template

   ↓

Concrete session
```

rather than:

```text

Workout template

   ↓

Planning
```

### Domain outcome

A template describes reusable structure.

It does not own the final workload or planning decision.

The plan remains authoritative for values such as volume and intensity
when

those values are determined by planning.

### Important boundary

A `Session` does not require a template to exist.

Manual or generated sessions can exist independently.

Templates are therefore reusable inputs, not mandatory owners of
sessions.

### What this prepared

With planning strategies on one side and reusable structures on the
other,

the system had enough information to attempt automatic session
generation.

That became H6.

---

## H6 --- Generate sessions from planning

### Context

By this point, the application could describe:

```text

Planning hierarchy

+

Load progression

+

Volume

+

Elevation

+

Intensity

+

Reusable session structures
```

But sessions still needed to be created from that information.

The automation problem was no longer merely:

> Create some sessions.

It had become:

> Transform a planned microcycle into a coherent training week without

> violating planning targets or destroying deliberate coach decisions.

### Goal

Generate training sessions from planning while preserving planning
authority,

group semantics, and manual coach control.

### Core model

The generator produces shared events and group-specific prescriptions:

```text

Microcycle

    ↓

Session generation

    ↓

Session

    ↓

GroupSessionPrescription
```

`Session` remains the shared event.

`GroupSessionPrescription` remains the group-specific workload.

Automatic generation therefore extends the Phase 1 model instead of
creating

a parallel session model.

### Weekly frequency

During H6, an earlier assumption was refined.

The number of sessions per week had initially appeared to belong
naturally to

`LoadStrategy`.

Once session generation was implemented, it became clear that load
strategy

and session frequency answer different questions:

```text

LoadStrategy

    → How should training load evolve?

SessionGenerationPreferences

    → How should that workload be organized into sessions?
```

Weekly frequency therefore became the responsibility of

`SessionGenerationPreferences`.

The initial supported range is 3--5 sessions per week.

Frequency may be:

- automatically selected from planning context; or

- explicitly fixed by the coach.

### Weekly pattern

Session-generation preferences can also express a preferred weekly
pattern.

The pattern is guidance, not a rigid calendar rule.

Planning constraints, intensity requirements, recovery needs, and fixed

geographical sessions may require the generator to deviate from the
preferred

pattern.

This established an important precedence rule:

```text

Planning constraints

    >

weekly pattern preference

    >

template convenience
```

### Fixed and flexible workload

Some training sessions have geographical or structural constraints.

For example, a mountain session may already imply a specific distance or

elevation profile.

Those fixed loads must consume the microcycle's planned workload before

flexible sessions receive the remainder.

Conceptually:

```text

Weekly target

    -

fixed session loads

    =

load available to flexible sessions
```

This prevents automatic generation from satisfying a pattern while

accidentally exceeding the planned week.

### Intensity

The generator consumes the intensity determined by planning.

For longer/continuous work this may produce an HR-zone prescription.

For shorter quality work this may produce a PAM-percentage prescription.

Templates do not override the planning intensity.

### Shared events

Session generation preserved the Phase 1 shared-event model.

A single `Session` may serve multiple groups, while each group retains
its own

`GroupSessionPrescription`.

This prevents automatic generation from duplicating what is conceptually
one

training event.

### Generation identity

Regeneration introduced another domain problem.

If the generator creates a completely new identity every time it runs,
the

system cannot reliably determine whether an existing session is:

- the same generated event;

- a manually modified version of that event;

- or a completely manual session.

H6 therefore introduced stable generation identity.

Generated sessions use stable generation keys, including shared-event

identity where required.

This makes deterministic regeneration possible.

### Ownership and provenance

Generated sessions need explicit ownership state.

The resulting model distinguishes:

```text

generated

generated_modified

manual
```

This distinction answers a critical question:

> Is the generator still allowed to replace this session?

An untouched `generated` session may be regenerated.

A `generated_modified` session represents a generated result that the
coach

has deliberately changed.

A `manual` session belongs entirely to the coach.

### Regeneration policy

The resulting rule is:

```text

generated

    → replaceable by regeneration

generated_modified

    → preserve

manual

    → preserve
```

Regeneration therefore updates automation-owned work without silently

destroying coach-owned work.

### Idempotency

Stable generation identity also allows repeated generation to remain

idempotent.

Running the generator again should reconcile generated planning rather
than

blindly append duplicate sessions.

### Purity boundary

The H6 generator was deliberately designed as a pure operation.

It determines what should exist but does not directly write to the
database.

Conceptually:

```text

planning state

      ↓

pure generator

      ↓

generation result

      ↓

persistence/reconciliation layer
```

This keeps domain reasoning testable and separates planning decisions
from

storage concerns.

### Domain outcome

H6 transformed automation from simple creation into controlled

reconciliation.

The important result was not merely that the application could generate

sessions.

It established that automatic generation must have:

- explicit planning authority;

- stable identity;

- provenance;

- idempotency;

- deterministic regeneration;

- protection for manual coach decisions.

---

# Domain refinement --- Automation ownership

H6 exposed one of the most important architectural principles of Epic 2.

Early automation could be understood as:

```text

input

  ↓

generator

  ↓

output
```

That model is insufficient once humans can edit generated results.

The real workflow is cyclical:

```text

planning

   ↓

generation

   ↓

coach review

   ↓

manual adjustment

   ↓

planning changes

   ↓

regeneration
```

The system therefore needs to know not only what a value is, but also
who

currently owns the decision.

This led to a broader rule:

> Regeneration may replace automation-owned state, but it must preserve

> explicit human-owned state.

This principle is expected to remain relevant beyond session generation.

---

# Evolution through H1--H6

The first six histories progressively moved planning knowledge out of

implicit generator behavior and into explicit domain concepts.

The progression can be summarized as:

```text

Phase 1 generator heuristics

        ↓

explicit LoadStrategy

        ↓

explicit progression and recovery

        ↓

distance + elevation planning

        ↓

method-aware intensity

        ↓

reusable session structure

        ↓

planning-driven session generation

        ↓

stable identity + provenance + regeneration policy
```

The system therefore evolved from:

> Generate a plausible plan.

toward:

> Represent the coach's planning decisions explicitly, then automate the

> repetitive transformations that follow from those decisions.

This is a fundamental difference.

The coach remains responsible for the planning decision.

The software increasingly becomes responsible for applying those
decisions

consistently.

---

# H7 --- Manage planning cohorts

H1--H6 improved how one group plan is created and transformed into
training

sessions.

That exposed another limitation inherited from Phase 1:

```text

one sporting group

        =

one planning audience
```

Coach workflow does not always satisfy that assumption.

Athletes may remain in the same sporting group while temporarily
requiring

different planning because of their preparation context or objectives.

Changing their sporting group would incorrectly change their
classification.

Creating individual plans would undermine the group-first model.

The next problem therefore became:

> How can part of a sporting group temporarily follow a planning variant

> without changing sporting classification or turning planning

> athlete-first?

This motivated H7 and the introduction of `PlanningCohort`.

The emerging distinction is:

```text

AthleteGroup

    → stable sporting classification

PlanningCohort

    → temporary planning subdivision
```

A cohort variant remains related to the group's base plan rather than
becoming

an unrelated planning hierarchy.

Individual `TrainingGoal` remains separate.

### Goal

Allow athletes from the same sporting group to follow a shared temporary
plan

variant without changing their sporting classification or creating
individual

plans.

### Result

H7 separated sporting identity from planning audience:

```text

AthleteGroup

    ├── base GroupTrainingPlan

    └── PlanningCohort

          ├── dated athlete memberships

          └── derived planning variant
```

`PlanningCohort` belongs to one team and one parent group. It has no
independent

date range: membership periods determine when it applies to an athlete,
while

the plan and macrocycles retain the planning horizon.

Memberships reference `AthleteProfile`, preserve assignment and closure
history,

and use inclusive ISO date boundaries. They do not replace the financial

`memberships` model and never modify `AthleteProfile.groupId`.

A cohort variant remains a `GroupTrainingPlan` for the same group and
records

both its cohort and direct base-plan source. Variant chains are
forbidden.

Derivation creates a detached draft snapshot with new identities while

preserving generated/manual provenance; materialized sessions are not
copied.

For a given athlete and date, resolution now follows an explicit order:

1\. reconstruct the applicable sporting group for the date;

2\. use the applicable cohort variant when exactly one valid membership
exists;

3\. otherwise use the applicable base group plan;

4\. report conflicting legacy data instead of choosing silently.

The coach can create, edit, archive, inspect, assign athletes to, and
close

memberships in cohorts. Current, scheduled, and historical periods
remain

visibly separate. The athlete list keeps the stable group visible and
adds the

current cohort only when applicable.

### Domain outcome

Group-first planning no longer means that every athlete in one sporting
group

must always be the same planning audience. A cohort is still shared
planning,

not an individual override.

The preferred future entry point is competitive intent: race and
distance,

combined with the athlete's group and planning horizon, should allow the
system

to propose a compatible cohort for coach confirmation. H7 deliberately
retains

manual cohort management as the foundation and does not introduce the
race

calendar, automatic assignment, or cohort-specific session
prescriptions.

Persistence was prepared consistently for SQLite and PostgreSQL,
including RLS

enablement for the new Supabase tables. Production policies and
authentication

remain future work. Cross-aggregate rules such as same-team/same-group

consistency and date overlap remain transaction-level application
invariants in

addition to database constraints.

The durable contract and detailed invariants live in

`docs/architecture/planning-cohorts.md`; the completed operational
record lives

in `docs/handoffs/epic-2-h7.md`.

# H8 --- Validate category and competitive distance

H7 made planning audiences more precise by separating the stable
sporting

group from temporary planning cohorts.

While preparing realistic planning fixtures after that work, another

assumption became visible.

A technically valid seed associated an `S2` group with a 42 km target
race.

The plan could be generated and its weekly workload could be coherent,
but

the combination was inconsistent with the sporting meaning of the group

category.

That exposed a distinction that had not yet been represented explicitly:

```text

competitive race distance

        ≠

weekly training volume
```

An athlete preparing for a 12 km race may train substantially more than

12 km during a week.

Likewise, the weekly volume assigned to a group does not define the

competitive distance represented by its sporting category.

This motivated H8.

### Goal

Make the relationship between sporting category and competitive target

distance explicit without turning that relationship into an automatic

classification or reassignment mechanism.

The system should be able to detect a potentially incoherent combination
and

inform the coach while preserving the coach's authority over the final

decision.

### Domain refinement --- Sporting category versus weekly load

Before H8, two existing concepts could appear related enough to be
confused:

```text

AthleteCategory

    → sporting / competitive context

GROUP_VOLUME_MATRIX

    → weekly training-volume guidance
```

They answer different questions.

`AthleteCategory` helps describe the competitive context represented by
the

athlete's sporting group.

`GROUP_VOLUME_MATRIX` helps determine appropriate weekly training volume
for a

category and level.

The latter therefore cannot be used to infer the former.

H8 introduced a separate race-distance policy rather than extending or

repurposing the weekly-volume matrix.

### Category policy

The initial explicit competitive-distance policy is:

```text

E — Elite

    unrestricted

U — Ultra

    42 km and above

M — Marathon

    21 km to 42 km

H — Half-Marathon

    15 km to 21 km

S — Short

    5 km to 15 km

B — Base

    policy not yet defined
```

The base boundaries are inclusive.

The overlap at category boundaries is deliberate. The model does not
assume

that one race distance uniquely determines one sporting category.

`E` remains unrestricted because Elite classification depends on
coaching

context rather than a fixed automatic distance ceiling.

`B` deliberately remains without a definitive competitive-distance
policy.

The system must represent that absence explicitly rather than inventing
a

limit.

Athlete level (`1`, `2`, or `3`) does not modify this race-distance
policy.

Level remains relevant to training-load guidance, but not to the
competitive

distance represented by the category.

### Tolerance

Exact sporting boundaries should not turn nearby race distances into
brittle

hard failures.

H8 therefore introduced a configurable warning tolerance.

The initial value is:

```text

10%
```

The tolerance expands only the threshold used to decide whether a
warning is

necessary.

It does not redefine the underlying sporting ranges.

Conceptually:

```text

base category range

        ↓

sporting meaning

base category range + tolerance

        ↓

warning threshold
```

The 10% value is an initial configurable rule and remains open to future

refinement with the coach.

### Pure compatibility evaluation

Compatibility is represented through a pure, reusable domain evaluation.

The result distinguishes:

```text

compatible

incompatible

unrestricted

policy_not_defined

not_applicable

invalid
```

These states intentionally preserve different meanings.

For example:

- a race inside the accepted range is `compatible`;

- a valid race sufficiently outside the range is `incompatible`;

- Elite is `unrestricted`;

- Base currently returns `policy_not_defined`;

- planning without an applicable race target is `not_applicable`;

- malformed distance input is `invalid`.

The evaluator does not mutate any planning state.

### Coach authority

An incompatible category-distance combination is informative, not

automatically corrective.

The system may warn:

> This race distance is outside the expected competitive range for this

> sporting category.

It must not respond by silently:

- changing `AthleteProfile.groupId`;

- moving the athlete to another `AthleteGroup`;

- modifying the `TrainingGoal`;

- modifying `LoadStrategy`;

- changing generated planning;

- creating an individual override.

A valid incompatibility therefore remains saveable when the coach
deliberately

chooses to keep it.

This continues the broader Epic 2 principle:

> Automation should expose relevant domain information while keeping
> explicit

> coaching decisions under human control.

### Planning integration

The compatibility result was integrated into planning contexts where
both the

sporting category and target race distance are known.

The result travels with planning previews and generated planning data
rather

than becoming a second source of planning truth.

Persisted plans are enriched with the compatibility evaluation when they
are

read.

The compatibility result itself is not persisted.

This means that saving and reloading a plan does not require storing a

duplicated warning state: the warning is recalculated from the durable

sporting and race data.

For cohort variants, compatibility continues to use the category of the

parent `AthleteGroup`.

A `PlanningCohort` does not introduce a new sporting classification.

Conceptually:

```text

AthleteGroup

    ↓

sporting category

    ↓

race-distance compatibility

PlanningCohort

    ↓

planning audience only
```

### User-facing result

Planning creation and detail flows can now surface the compatibility
result to

the coach.

Normal cases remain quiet:

```text

compatible

unrestricted

not_applicable
```

Cases requiring attention are made explicit, including:

```text

incompatible

policy_not_defined

invalid
```

The warning does not become an implicit blocker.

This allows the application to identify combinations such as an `S`
group

preparing for a substantially longer race without pretending that
software

alone should decide the athlete's correct classification.

### Domain outcome

H8 introduced a new explicit boundary between three concepts that had

previously been easy to conflate:

```text

competitive distance

        ↓

CategoryRaceDistancePolicy

weekly training load

        ↓

GROUP_VOLUME_MATRIX / LoadStrategy

planning audience

        ↓

AthleteGroup / PlanningCohort
```

Each now has a distinct responsibility.

This makes future automation safer because the system can reason about

competitive intent without silently converting that intent into either a
new

sporting classification or a different weekly workload.

The durable policy and integration contract live in

`docs/architecture/category-race-distance.md`.

---

# Architecture after H8

By the end of H6, the automation model can be summarized conceptually
as:

```text

AthleteGroup

    ↓

GroupTrainingPlan

    │

    ├── LoadStrategy

    ├── IntensityStrategy

    ├── SessionGenerationPreferences

    │

    └── Macrocycle

        └── Mesocycle

            └── Microcycle

                  ↓

            Session generation

                  ↓

               Session

                  ↓

       GroupSessionPrescription
```

Alongside the group plan:

```text

AthleteProfile

    ↓

TrainingGoal
```

Planning audiences now extend that structure without replacing it:

```text

AthleteGroup

    ├── base GroupTrainingPlan

    └── PlanningCohort

          ├── PlanningCohortMembership → AthleteProfile

          └── cohort GroupTrainingPlan variant
```

The diagrams describe domain responsibilities rather than exact database

cardinalities or foreign keys.

Competitive-distance compatibility now complements that architecture
without

changing planning ownership:

```text

AthleteGroup

    ↓

AthleteCategory

    ↓

CategoryRaceDistancePolicy

    ↓

RaceDistanceCompatibility

TrainingGoal / planning target

    ↓

race distance

    ────────────────┘
```

This evaluation informs planning but does not own the athlete's sporting

classification, weekly load, or planning audience.

---

# Durable outcomes so far

Epic 2 H1--H8 established the following principles:

- Planning strategy should be explicit rather than hidden inside
  generators.

- Load progression and recovery are deliberate planning concepts.

- Distance and elevation are distinct trail-running planning
  dimensions.

- Intensity must preserve its prescription method.

- Longer/continuous work may use HR zones.

- Shorter quality work may use PAM percentage.

- Templates provide reusable structure but do not override planning.

- Session frequency belongs to session-generation preferences, not
  load

  strategy.

- Weekly patterns are preferences rather than rigid constraints.

- Fixed session workload consumes weekly targets before flexible
  workload is

  distributed.

- `Session` remains a shared event.

- `GroupSessionPrescription` remains the group-specific prescription.

- Generated state requires stable identity and provenance.

- Regeneration must be idempotent.

- Untouched generated work may be replaced.

- Manually modified generated work must be preserved.

- Manual work must be preserved.

- Pure domain generation should remain separate from persistence.

- Automation supports the coach; it does not silently replace coach

  decisions.

- Sporting group and planning audience are separate concepts.

- Cohort applicability is dated and historical; current group
  membership alone

  is insufficient for historical plan resolution.

- A cohort plan is a direct variant of one base group plan, not an
  independent

  hierarchy or a chain of variants.

- Planning resolution prefers one valid cohort variant, falls back to
  the group

  base plan, and exposes ambiguity rather than resolving it
  arbitrarily.

- Competitive race distance and weekly training volume are separate
  domain

  concepts.

- Sporting-category race-distance policy must remain separate from

  `GROUP_VOLUME_MATRIX`.

- Category-distance compatibility informs the coach but does not
  automatically

  reclassify athletes or mutate planning.

- Elite remains unrestricted by automatic race-distance ceilings.

- Undefined category policy must remain explicit rather than being
  replaced by

  an arbitrary rule.

- Race-distance warning tolerance does not redefine the underlying
  sporting

  category ranges.

- Planning cohorts inherit sporting category from their parent group;
  they do

  not introduce a new sporting classification.

---

# Epic 2 direction

Epic 2 began with a technical-sounding objective: automate planning.

The work progressively revealed that useful automation depends on
accurately

representing coaching intent.

The central question therefore evolved from:

> How can the system generate more of the plan automatically?

to:

> Which decisions belong to the coach, which transformations can the
> system

> automate, and how can the boundary between them remain explicit?

H1--H6 answer much of the transformation side of that question.

H7 addresses the audience side:

> Who should a particular planning variant apply to, and for what
> period,

> without changing the athlete's sporting identity?

H8 adds another boundary:

> When a competitive objective appears inconsistent with that sporting

> identity, what should the system detect and what should remain a coach

> decision?

The answer continues the same pattern established throughout Epic 2.

The system can now detect and communicate a category-distance mismatch
without

silently changing sporting classification, weekly load, planning
audience, or

the athlete's objective.

Automation becomes safer and more useful as previously implicit domain

assumptions become explicit and the boundary of coach authority remains

visible.

The next step is H9: managing the competitive calendar so that race
events and

their planning relevance can become explicit domain data rather than
remaining

isolated target information.

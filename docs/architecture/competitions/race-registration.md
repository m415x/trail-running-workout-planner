# Race registration and competitive history

## Purpose

This document is the durable KAN-281 contract for effective individual race registrations, participation evidence and factual competitive history. It supersedes the future-only design status of `race-registration-boundary.md`; that earlier document remains useful for the original KAN-275 reservation.

## Domain model

A `RaceRegistration` is an **effective individual registration**, not an intention, goal, planning entry, readiness decision or realized-training record.

The persisted state carries an opaque id, explicit `teamId` and `athleteProfileId`, a concrete `RaceCourseReference`, registration lifecycle, participation state, historical snapshot and optional factual result. `TrainingGoal`, `CompetitionEntry` and `RaceRegistration` remain independent facts; none creates, cancels or rewrites another automatically.

## Registration lifecycle

`RaceRegistrationStatus` is `registered | cancelled`. Registration lifecycle is independent from participation: a registered athlete can still have `participationStatus = unknown`.

Lifecycle changes are allowed only while participation remains unknown. Cancellation does not mean DNS. Reactivation restores the registration fact; it does not assert participation.

## Participation evidence

`RaceParticipationStatus` is:

- `unknown` — no participation fact is known.
- `started` — explicit evidence says the athlete started.
- `finished` — explicit evidence says the athlete finished.
- `dnf` — explicit evidence says the athlete started but did not finish.
- `dns` — explicit evidence says the athlete did not start.

Missing evidence remains `unknown`; it must never be inferred as DNS, DNF, zero distance or zero elapsed time. Participation is explicitly recordable and correctable. Result fields do not infer participation state.

## Factual result

The MVP `RaceResult` contains `actualDistanceKm: number | null` and `elapsedTimeSeconds: number | null`. `null` means unknown; numeric zero is a known value and must not be collapsed into unknown.

Nominal course distance/elevation and actual covered distance are different facts. A DNF or otherwise incomplete/unknown participation must not be presented as having covered the nominal course distance merely because the catalog knows it.

Rank, position, official classification, performance prediction and interpretation are outside KAN-281.

## Historical snapshot

Each registration persists event name, edition label/date, course label, nominal distance and nominal elevation gain. These accepted facts preserve historical meaning across later catalog edits or archive operations. Catalog foreign keys use restrictive deletion semantics so physical catalog deletion cannot silently destroy registration history.

A same-edition course change refreshes the course reference and course-dependent snapshot together. Ordinary course change is allowed only for an active registration whose participation is still unknown, and only to another valid course in the same edition.

## Uniqueness and course changes

Persistence enforces one registration fact per `teamId + athleteProfileId + raceEditionId`. The course is deliberately excluded from the uniqueness key. Selecting another course in the same edition is an explicit course change, never a second registration.

Course-first bulk registration revalidates each athlete at execution time and supports partial success. An athlete already registered in that edition is reported as a per-athlete failure rather than being silently moved to another course.

## Persistence and isolation

SQLite and Supabase/PostgreSQL persist the same registration semantics. Repository reads and mutations used by Coach workflows scope registration lookup by team. Athlete registration creation verifies that the athlete belongs to the current team before writing.

The current application still uses the established temporary fixed development team identity. KAN-281 does not introduce authentication/tenant resolution and must not spread that temporary identity into new domain contracts.

Final KAN-281 DB verification reported 36/36 Supabase application tables with RLS.

## Coach surfaces

KAN-281 integrates into existing Coach information architecture:

- RaceCourse context supports multi-athlete registration with Level 2 confirmation and structured partial-success feedback.
- Athletes registered on another course in the same edition are contextual rows with an explicit course-change action.
- RaceEdition context groups registrations by course and supports lifecycle changes plus explicit participation/result recording and correction.
- Athlete detail supports athlete-first registration and factual individual competition history.

Coach surfaces are desktop-first. Remaining purely visual/Tailwind polish is deliberately deferred; functional responsive behavior was validated in the story walkthrough.

## Athlete disclosure

Athlete disclosure uses an explicit athlete-safe race-registration projection rather than exposing the Coach aggregate.

The final KAN-281 information architecture is:

- `Plan -> Competition`: upcoming effective registrations with factual event/edition/course, date, nominal distance/D+ and participation state.
- `Stats -> Competition`: historical participation/results only, including factual actual distance and elapsed time when known.

This placement is a presentation decision, not domain coupling: an upcoming `RaceRegistration` does not become a `TrainingGoal`, `CompetitionEntry` or planning write merely because it is shown under Plan.

No ranking, readiness, authorization, fitness assessment, performance interpretation or automatic realized-training mutation is disclosed or derived from registration/result data.

## Deferred work

KAN-281 deliberately does not implement automatic organizer integration; payment/bib/qualification/lottery/waitlist workflows; official ranking/position/classification; performance prediction; automatic goal/planning, readiness or realized-training mutation; authentication/tenant resolution; deferred KAN-360 scope; or non-functional visual polish reserved for a later UI/UX epic.

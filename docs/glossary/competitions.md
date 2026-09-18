# Competition terminology

## Race registration

An **effective individual entry** for one athlete in one concrete race course. It is scoped by team and athlete and is independent from a TrainingGoal or CompetitionEntry.

A future intention to enter a race is **not** a RaceRegistration. Intent belongs to goal/planning concepts until an effective registration is explicitly recorded.

## Registration status

The lifecycle of the effective entry itself: `registered` or `cancelled`. It does not describe whether the athlete started or finished.

Cancellation is not DNS.

## Participation status

Explicit factual evidence about participation:

- **unknown** — no participation fact is known;
- **started** — the athlete is known to have started;
- **finished** — the athlete is known to have finished;
- **DNF (did not finish)** — the athlete is known to have started and not finished;
- **DNS (did not start)** — the athlete is explicitly known not to have started.

Missing evidence is unknown, not DNS or DNF.

## Race result

The factual result fields attached to participation evidence. KAN-281 stores actual covered distance and elapsed time when known. Missing values remain unknown.

A race result is not automatically a realized-training record, readiness assessment, ranking or performance interpretation.

## Nominal distance

The catalog/snapshot distance of the selected race course. It describes the course, not what the athlete actually covered.

## Actual distance

The factual distance known to have been covered by the athlete. It may differ from nominal distance and can remain unknown. Numeric zero is a known value when explicitly evidenced.

## Historical registration snapshot

The event/edition/course labels, edition date and nominal course facts accepted when the registration is created or explicitly moved to another course. The snapshot preserves historical meaning if the live catalog later changes.

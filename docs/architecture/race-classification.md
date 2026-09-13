# Race course classification

## Purpose

Define how `RaceCourse` stores and validates external sporting classifications without treating one federation/ecosystem taxonomy as universal product truth.

Research basis: [`../research/race-classification-systems-2026.md`](../research/race-classification-systems-2026.md).

## Separation from modality and demand

Three concepts remain independent:

```text
RaceCourse.modality
  normalized product fact: road / trail / skyrunning / vertical_kilometer / other

RaceCourse original + derived profile
  distanceKm / elevationGainM / m+/km / kilometerEffortKm

RaceCourse.classifications[]
  versioned external statements from WA / ITRA / ISF / UTMB / future systems
```

An external classification must never silently replace `RaceCourse.modality`, and a derived km-effort value is not automatically an official classification unless a selected system/version defines the mapping and the classification provenance records that derivation.

## Contract

```text
RaceCourseClassification
- systemId
- authority
- dimension
- versionRef
- code
- label?
- provenance
- sourceUrl?
- assessedAt?
```

### systemId

Stable product identifier for the external ruleset family, for example:

```text
itra.endurance_points
itra.distance_category
world_athletics.international_format
isf.discipline
isf.technical_level
utmb.race_category
```

These are identifiers, not hardcoded enums. New systems can be stored without changing the `RaceCourse` entity model.

### authority

Human-readable owner/authority. It is stored separately from `systemId` so audit/UI can show who owns the classification.

### dimension

The normalized semantic dimension represented by the classification:

```text
endurance_difficulty
distance_category
international_format
discipline
technical_level
other
```

Different dimensions may coexist on the same course. For example:

```text
ITRA endurance difficulty = 3
ITRA distance category = 50K
ISF discipline = SKYULTRA
ISF technical level = 2
```

### versionRef

Mandatory explicit ruleset/effective reference. It may be:

- a formal published version/year;
- an approval date;
- an effective date;
- a dated research snapshot when the authority exposes a living rules page without semantic versioning.

A classification code is never interpreted without `systemId + dimension + versionRef`.

Historical and current classifications may coexist if they have different version references.

### code and label

`code` preserves the source-specific value exactly as needed by the integration/domain adapter (`3`, `50K`, `SKYULTRA`, `2`, etc.).

`label` is optional presentation metadata and is not identity.

### provenance

```text
declared_by_source
  the authority/event data explicitly declares the classification

derived_from_source_rules
  the product calculated it by applying the selected source rules/version

manual_reference
  a coach/catalog curator recorded an external reference manually
```

The product must not label a classification `derived_from_source_rules` unless the matching versioned rule is actually implemented and its inputs are sufficient.

### sourceUrl / assessedAt

`sourceUrl` points to the primary/reference source when available. `assessedAt` records when the classification was checked/derived.

These fields support audit and later re-evaluation when external systems change.

## Multiplicity and uniqueness

`RaceCourse.classifications` is an array and may be empty.

Empty means unknown/not applicable, not "unclassified by every possible system".

A course may contain multiple systems and multiple dimensions from one authority. However, within one:

```text
systemId + dimension + versionRef
```

there is a single active classification slot. Two different codes for that exact slot are contradictory and rejected by `validateRaceCourseClassifications`.

The same system/dimension with a different version is allowed so historical classification can remain reproducible.

## Coherence validation policy

`validateRaceCourseCoherence` separates hard invariants from source-dependent interpretation.

### Hard errors

The following are always invalid domain state:

- invalid primitive distance/D+ values;
- structurally invalid modality;
- structurally invalid/duplicate classification records;
- a classification marked `derived_from_source_rules` whose code contradicts the exact registered `systemId + dimension + versionRef` rule.

The last case is a hard error because the product itself claims to have derived the value from that ruleset; keeping a contradictory code would make the record internally false.

### Warnings

A source-declared/manual classification that differs from a locally reproducible rule is preserved but flagged:

```text
race_course_external_classification_profile_mismatch
```

This is not automatically rewritten because official/catalog source measurements may differ from the values currently stored locally.

If the exact registered rule exists but required profile inputs are unknown, the result is:

```text
race_course_classification_cannot_be_verified
```

Again this is a warning/limitation, not proof that the external classification is wrong.

### No rule, no invented validation

If the application has no implementation for the exact system/dimension/version, it does **not** guess whether the code is valid. The classification remains structurally valid external metadata.

This is how historical taxonomies and future rule changes remain representable without accidentally applying today's thresholds to another version.

### Versioned rules

`RaceCourseClassificationRule` is the boundary for an implemented external policy:

```text
systemId
dimension
versionRef
resolveCode(profile) -> code | null
```

KAN-272 includes `ITRA_ENDURANCE_POINTS_2026_09_13`, based on the current primary ITRA material researched in KAN-270. The date in `versionRef` is deliberate: the external taxonomy is living policy, not timeless source code.

### Unusual is not invalid

The generic coherence policy deliberately has no rules such as:

- "too much D+ for road";
- "too little D+ for trail";
- "high m+/km means Vertical Kilometer";
- "this distance cannot be skyrunning".

Those statements are either context-dependent or belong to explicit external rules. A structurally valid but unusual profile remains valid unless a documented versioned policy says otherwise.

## No automatic universal mapping

The domain does not contain a generic function such as:

```text
kmEffort -> externalClassification
```

because each system/version owns its own thresholds and applicability.

A versioned policy may implement, for example:

```text
ITRA Endurance Points / current-2026-09-13
  known distance + known D+
  -> km-effort
  -> source-version-specific code
```

but the output still records that exact system/version/provenance.

## Historical XXS–XXL

The 2026 research did not find XXS–XXL in the current official ITRA material consulted. The generic model can preserve such a code if imported as a historical classification with an explicit historical `versionRef`, but the application must not present it as current ITRA truth by default.

## Snapshot boundary

External classification belongs to the catalog course. When KAN-273 maps a `RaceCourse` into a plan-owned `CompetitionEntry`, any classification needed by planning/history must follow the same snapshot principle as distance/D+: later catalog reclassification must not silently rewrite accepted historical planning context.

## Invariants

1. Classification is external/versioned metadata, not catalog identity.
2. No one authority is universal product truth.
3. System + dimension + version + code are inseparable semantically.
4. Multiple dimensions/systems may coexist.
5. Unknown/not applicable is represented by absence, not fabricated defaults.
6. Modality, course-demand descriptors and external classification remain distinct.
7. Historical codes remain reproducible through explicit version references.
8. Derived official classifications require explicit versioned source rules and sufficient inputs.
9. Source-declared mismatches are reviewable warnings, not silently rewritten data.
10. Unusual profiles are not invalidated by undocumented heuristics.

# Race classification systems — research snapshot 2026

Consulted: 2026-09-13

Purpose: identify current, attributable classification systems that may apply to `RaceCourse` without hardcoding a historical taxonomy as universal product truth.

This is a research snapshot, not a domain policy. KAN-271 uses these findings to define a generic versioned classification contract.

## Executive conclusion

There is **no single universal current race classification** that covers road, trail, mountain, skyrunning and ultra events with one code.

Current sources expose multiple dimensions and authorities:

1. World Athletics / ITRA difficulty based on kilometer-effort and 0–6 difficulty/endurance points.
2. ITRA distance categories based on course distance, separate from endurance difficulty.
3. World Athletics international mountain/trail event terminology (`Uphill`, `Classic`, `Short Trail`, `Long Trail`).
4. International Skyrunning Federation disciplines (`VERTICAL`, `SKY`, `SKYULTRA`, etc.) plus a separate technical-level concept.
5. UTMB World Series race categories (`20K`, `50K`, `100K`, `100M`) based on its own kilometer-effort category system; this is an ecosystem/commercial classification, not a global federation rule.

Therefore the product must model classifications as **system + version/effective reference + code**, and must allow several classifications to coexist on one `RaceCourse` when they describe different dimensions.

The historical `XXS–XXL` taxonomy is **not present in the current official ITRA material consulted for 2026**. It must not be encoded as the current ITRA classification unless a versioned historical record explicitly requires it.

## 1. World Athletics — Competition and Technical Rules 2026

Authority: World Athletics.

Primary sources:

- Book of Rules: https://worldathletics.org/about-iaaf/documents/book-of-rules
- Technical Information / Competition and Technical Rules 2026: https://worldathletics.org/about-iaaf/documents/technical-information
- Mountain and Trail Running overview: https://worldathletics.org/disciplines/mountain-running/mountain-running

Version/effective reference consulted:

- `C1.1 & C2.1 - Competition Rules & Technical Rules`, current listing modified 2026-07-01.
- Rule 57: Mountain and Trail Races.

### 1.1 Mountain/trail difficulty points

World Athletics Rule 57 describes race evaluation using the ITRA kilometer-effort method:

```text
km-effort = distanceKm + elevationGainM / 100
```

Difficulty points:

| km-effort | points |
| ---: | ---: |
| 0–24 | 0 |
| 25–44 | 1 |
| 45–74 | 2 |
| 75–114 | 3 |
| 115–154 | 4 |
| 155–209 | 5 |
| 210+ | 6 |

This is a course-difficulty/endurance dimension. It is not the same concept as modality, technicality, athlete readiness or training load.

### 1.2 International-event terminology

For international/regional mountain and trail events, Rule 57 uses:

- `Uphill` — predominantly uphill, normally no more than 60 minutes;
- `Classic` — up/down, up to 30 km;
- `Short Trail` — 30–60 km;
- `Long Trail` — over 60 km.

World Championship target ranges are more specific (for example Short Trail and Long Trail have championship distance/elevation ranges), but those championship requirements must not be treated as universal validation limits for every catalog race.

### Product implication

World Athletics contributes at least two separate classification dimensions:

- difficulty points (`0`–`6`), based on km-effort;
- international event format terminology.

They should not be collapsed into one enum.

## 2. ITRA — current race evaluation and categories

Authority: International Trail Running Association (ITRA).

Primary sources:

- Discover Trail Running: https://itra.run/About/DiscoverTrailRunning
- Performance Index FAQ: https://itra.run/FAQ/PerformanceIndex
- Runner FAQ / Endurance Points: https://itra.run/FAQ/Runner

### 2.1 Endurance/difficulty points

ITRA currently documents kilometer-effort as:

```text
1 km distance = 1 km-effort
100 m positive elevation = 1 km-effort
```

and uses points 0–6 with the same bands documented by World Athletics Rule 57:

| km-effort | ITRA endurance/difficulty points |
| ---: | ---: |
| 0–24 | 0 |
| 25–44 | 1 |
| 45–74 | 2 |
| 75–114 | 3 |
| 115–154 | 4 |
| 155–209 | 5 |
| 210+ | 6 |

ITRA explicitly describes these points as an endurance-difficulty measure and notes that they do not represent terrain technicality.

### 2.2 Distance categories

Current ITRA documentation also exposes distance-based categories independently of endurance points:

| category | distance |
| --- | --- |
| Vertical* | 2–<12 km (with additional vertical criteria) |
| 10K | 5–<15 km |
| Half Marathon | 15–<35 km |
| Marathon | 35–<45 km |
| 50K | 45–<65 km |
| 50M | 65–<90 km |
| 100K | 90–<130 km |
| 100M | 130–<190 km |
| Endurance | 190+ km |

The current ITRA pages distinguish this distance category from km-effort endurance difficulty.

### 2.3 Historical XXS–XXL caution

Some historical/secondary material on the web still describes `XXS`, `XS`, `S`, `M`, `L`, `XL`, `XXL` bands based on km-effort. However, the current official ITRA pages consulted above use:

- 0–6 endurance/difficulty points; and
- named distance categories (`10K`, `Half Marathon`, ..., `Endurance`).

No current official support was found in the consulted ITRA documentation for treating XXS–XXL as the active taxonomy. The application must therefore **not** encode XXS–XXL as current ITRA truth. If historical data later requires it, it should be represented with its historical system/version explicitly.

## 3. International Skyrunning Federation (ISF)

Authority: International Skyrunning Federation.

Primary sources:

- Current rules page: https://www.skyrunning.com/rules/
- Technical classification guidelines: https://www.skyrunning.com/technical-classification-guidelines/
- 2026 World Championships: https://www.skyrunning.com/2026-skyrunning-world-championships/
- 2026 VK OPEN definition: https://www.skyrunning.com/2026-vk-open-world-cup/

Current rules page states that the sport rules were approved in December 2025.

### 3.1 Discipline classification

Current ISF material uses disciplines including:

- `VERTICAL`;
- `SKY`;
- `SKYULTRA`.

The 2026 World Championships explicitly contest those three disciplines.

`Vertical Kilometer®` is a specific rule-defined event inside the Vertical discipline. Current ISF material defines it using a vertical-climb requirement around 1,000 m (with tolerance) and a maximum course length of 5 km, with additional incline requirements. Double/triple variants are also recognised.

This reinforces the product decision already made in KAN-268: `vertical_kilometer` must be an explicit modality/discipline fact, not inferred merely from high `m+/km`.

### 3.2 Technical classification

ISF separately publishes technical classification guidelines with levels:

- Level 1;
- Level 2;
- Level 3.

The assessment considers factors such as altitude, incline, technical climbing, fixed ropes/via ferrata, snow/glacier, loose terrain, ridges and exposure.

This is a **technicality dimension**, not a replacement for discipline or distance/demand classification.

### Product implication

At least two ISF classifications may coexist on one course:

```text
ISF discipline = SKYULTRA
ISF technical level = 2
```

The generic model must not assume one classification record per authority.

## 4. UTMB World Series / UTMB Index

Authority/owner: UTMB World Series ecosystem. This is a current influential trail-running system, but it is **not a global sports-governing federation classification**.

Primary sources:

- Sports system: https://utmb.world/sports-system
- UTMB Index: https://utmb.world/utmb-index

Current race categories:

- `20K`;
- `50K`;
- `100K`;
- `100M`.

UTMB states that these race categories are based on kilometer-effort and uses the same basic km-effort formula (`distance + D+/100`). Its category system is tied to UTMB Index/World Series participation and performance workflows.

### Product implication

UTMB categories are useful catalog metadata when a race/course participates in that ecosystem, but must be identified as a separate system/owner. They must not silently become the application's universal distance taxonomy.

## 5. Road-running courses

KAN-257 also supports `road` modality. None of the trail/skyrunning systems above should be applied automatically to a road course merely because distance/D+ values are available.

Standard road-event names/distances may be modeled separately when needed, but KAN-270 found no justification to force trail km-effort difficulty points or skyrunning disciplines onto road courses.

`RaceCourse.classifications` must therefore allow **zero applicable external classifications**.

## 6. Classification dimensions discovered

The research shows that the future domain should distinguish at least:

```text
endurance_difficulty   // e.g. ITRA/WA 0–6 by km-effort
race_distance          // e.g. ITRA 50K / 100K; UTMB 50K / 100K
international_format   // e.g. WA Short Trail / Long Trail
skyrunning_discipline  // e.g. ISF SKY / SKYULTRA / VERTICAL
technical_level        // e.g. ISF Level 1–3
```

These dimensions can overlap. A course may legitimately hold more than one classification from one or several systems.

The existing `RaceCourse.modality` remains the application's normalized course modality and is **not** replaced by an external classification code.

## 7. Requirements for KAN-271

The classification model should support, at minimum:

- system/authority identifier;
- classification dimension/type;
- system version or effective date/reference;
- code/value;
- optional display label;
- provenance/source URL or reference;
- evaluated/assigned timestamp when persisted;
- optional status such as current/historical if needed by persistence policy;
- multiple classifications per `RaceCourse`;
- absence of classification when unknown/not applicable.

It should **not**:

- hardcode one universal enum across authorities;
- infer current classification from historical labels;
- merge modality and external classification;
- equate difficulty classification with athlete readiness;
- automatically mutate an accepted `CompetitionEntry` snapshot if an external classification later changes.

## 8. Source-quality policy

Classification support should prefer:

1. current primary governing-body/owner documentation;
2. explicit edition/effective date when published;
3. attributable ecosystem rules for private systems (for example UTMB), clearly marked as such;
4. historical/secondary sources only for historical records, never as proof of current taxonomy.

Because these systems can change, classification rules belong to versioned policy/data rather than timeless domain constants.

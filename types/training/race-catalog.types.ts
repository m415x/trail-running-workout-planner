import type { BaseEntity } from '@/types/core/base.types'

/** Stable lifecycle for the catalog identity that survives across editions. */
export type RaceEventStatus = 'active' | 'archived'

/** Lifecycle of one time-bounded edition of an event. */
export type RaceEditionStatus = 'draft' | 'published' | 'completed' | 'cancelled'

/** Lifecycle of one concrete course offered by an edition. */
export type RaceCourseStatus = 'draft' | 'published' | 'cancelled'

/** Core modalities understood natively by the application. */
export type KnownRaceCourseModalityCode =
  | 'road'
  | 'trail'
  | 'skyrunning'
  | 'vertical_kilometer'

/**
 * Course modality without coupling catalog identity to a closed enum forever.
 *
 * `other` preserves an explicit custom label until a future modality becomes a
 * first-class code. Vertical kilometer is always explicit and is never inferred
 * from elevation density.
 */
export type RaceCourseModality =
  | { readonly code: KnownRaceCourseModalityCode }
  | { readonly code: 'other'; readonly label: string }

/** Dimension described by one external classification record. */
export type RaceCourseClassificationDimension =
  | 'endurance_difficulty'
  | 'distance_category'
  | 'international_format'
  | 'discipline'
  | 'technical_level'
  | 'other'

/** How the classification was obtained for this course. */
export type RaceCourseClassificationProvenance =
  | 'declared_by_source'
  | 'derived_from_source_rules'
  | 'manual_reference'

/**
 * Versioned external classification attached to a concrete RaceCourse.
 *
 * The system is intentionally open-ended. Current examples include World
 * Athletics, ITRA, ISF and UTMB, but those authorities/codes are not encoded as
 * timeless TypeScript enums because their taxonomies may change independently.
 */
export interface RaceCourseClassification {
  /** Stable product identifier for the external system, e.g. `itra.endurance_points`. */
  readonly systemId: string
  /** Human-readable authority/owner, e.g. `ITRA` or `World Athletics`. */
  readonly authority: string
  /** Semantic dimension represented by this classification. */
  readonly dimension: RaceCourseClassificationDimension
  /**
   * Explicit ruleset/version/effective reference.
   *
   * This may be a formal version (`2026`) or a dated effective reference when
   * the source does not publish semantic versions. It must never be omitted.
   */
  readonly versionRef: string
  /** Source-specific code/value; never interpreted without system + version. */
  readonly code: string
  /** Optional display text from the external system. */
  readonly label?: string | null
  /** How this particular value was obtained. */
  readonly provenance: RaceCourseClassificationProvenance
  /** Primary/source reference used to assign or derive the classification. */
  readonly sourceUrl?: string | null
  /** ISO timestamp/date recording when this classification was assessed. */
  readonly assessedAt?: string | null
}

/** Human-readable host location for one edition. */
export interface RaceEditionLocation {
  /** City/locality when known. */
  locality?: string | null
  /** Province/state/region when known. */
  region?: string | null
  /** ISO 3166-1 alpha-2 country code when known. */
  countryCode?: string | null
}

/** Stable identity and branding of a competitive event across time. */
export interface RaceEvent extends BaseEntity {
  name: string
  websiteUrl?: string | null
  description?: string | null
  status: RaceEventStatus
}

/** One temporal occurrence of a RaceEvent. */
export interface RaceEdition extends BaseEntity {
  raceEventId: string
  label: string
  startDate: string
  endDate?: string | null
  organizerName?: string | null
  location?: RaceEditionLocation | null
  websiteUrl?: string | null
  notes?: string | null
  status: RaceEditionStatus
}

/** One concrete competitive course within a RaceEdition. */
export interface RaceCourse extends BaseEntity {
  raceEditionId: string
  label: string
  distanceKm: number | null
  elevationGainM: number | null
  /** Explicit modality when known. `null` means not yet classified. */
  modality: RaceCourseModality | null
  /**
   * Zero or more versioned external classifications.
   *
   * Empty means unknown/not applicable; it must not trigger inferred defaults.
   */
  classifications: readonly RaceCourseClassification[]
  scheduledStartAt?: string | null
  startLocationLabel?: string | null
  notes?: string | null
  status: RaceCourseStatus
}

/** Editable original sporting profile fields owned by RaceCourse. */
export interface RaceCourseOriginalProfile {
  distanceKm: number | null
  elevationGainM: number | null
}

export interface RaceCatalogAggregate {
  event: RaceEvent
  editions: readonly RaceEditionCatalogNode[]
}

export interface RaceEditionCatalogNode {
  edition: RaceEdition
  courses: readonly RaceCourse[]
}

/** Stable catalog reference carried by planning/application boundaries. */
export interface RaceCourseReference {
  raceEventId: string
  raceEditionId: string
  raceCourseId: string
}

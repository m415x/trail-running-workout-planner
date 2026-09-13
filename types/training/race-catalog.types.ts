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
  readonly systemId: string
  readonly authority: string
  readonly dimension: RaceCourseClassificationDimension
  readonly versionRef: string
  readonly code: string
  readonly label?: string | null
  readonly provenance: RaceCourseClassificationProvenance
  readonly sourceUrl?: string | null
  readonly assessedAt?: string | null
}

/** Human-readable host location for one edition. */
export interface RaceEditionLocation {
  locality?: string | null
  region?: string | null
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
  modality: RaceCourseModality | null
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

/**
 * Minimum tenant/athlete scope reserved for a future individual race entry.
 *
 * Team scope is explicit so registration persistence cannot later rely on UI
 * filtering or infer tenancy only from a mutable athlete lookup.
 */
export interface FutureRaceRegistrationScope {
  teamId: string
  athleteProfileId: string
}

/**
 * Extension point for the future RaceRegistration story.
 *
 * This is intentionally not a persistent entity and contains no lifecycle,
 * payment, bib, qualification or result fields. It only fixes the two facts the
 * future model cannot change: athlete scope + concrete RaceCourse identity.
 */
export interface FutureRaceRegistrationTarget {
  scope: FutureRaceRegistrationScope
  course: RaceCourseReference
}

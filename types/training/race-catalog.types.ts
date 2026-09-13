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

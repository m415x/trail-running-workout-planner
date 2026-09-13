import type { BaseEntity } from '@/types/core/base.types'

/** Stable lifecycle for the catalog identity that survives across editions. */
export type RaceEventStatus = 'active' | 'archived'

/** Lifecycle of one time-bounded edition of an event. */
export type RaceEditionStatus = 'draft' | 'published' | 'completed' | 'cancelled'

/** Lifecycle of one concrete course offered by an edition. */
export type RaceCourseStatus = 'draft' | 'published' | 'cancelled'

/** Human-readable host location for one edition. */
export interface RaceEditionLocation {
  /** City/locality when known. */
  locality?: string | null
  /** Province/state/region when known. */
  region?: string | null
  /** ISO 3166-1 alpha-2 country code when known. */
  countryCode?: string | null
}

/**
 * Stable identity and branding of a competitive event across time.
 *
 * Example: "Patagonia Run". A RaceEvent is not a distance and is not the
 * concrete competitive unit referenced by planning.
 */
export interface RaceEvent extends BaseEntity {
  /** Stable public event/brand name; not used as technical identity. */
  name: string
  /** Canonical event website when the event has a stable homepage. */
  websiteUrl?: string | null
  /** Stable catalog description, not edition-specific instructions. */
  description?: string | null
  status: RaceEventStatus
}

/**
 * One temporal occurrence of a RaceEvent.
 *
 * Example: "Patagonia Run 2027". Edition identity is immutable even when its
 * dates, organizer or published courses are corrected later.
 */
export interface RaceEdition extends BaseEntity {
  raceEventId: string
  /** Human-facing edition label such as "2027"; not a unique technical key. */
  label: string
  /** First calendar day of the edition in YYYY-MM-DD format. */
  startDate: string
  /** Last calendar day when the event spans multiple days. */
  endDate?: string | null
  /** Organizer responsible for this concrete edition; may change over time. */
  organizerName?: string | null
  /** Host location for this edition; not promoted to stable event identity. */
  location?: RaceEditionLocation | null
  /** Edition-specific official/info/registration page when different from the event homepage. */
  websiteUrl?: string | null
  /** Notes that apply to this edition as a whole. */
  notes?: string | null
  status: RaceEditionStatus
}

/**
 * One concrete competitive course within a RaceEdition.
 *
 * Example: the 42K course of Patagonia Run 2027. Planning and future athlete
 * registration reference this identity rather than RaceEvent/RaceEdition.
 */
export interface RaceCourse extends BaseEntity {
  raceEditionId: string
  /** Human-facing course label such as "42K"; not a unique technical key. */
  label: string
  /**
   * Official/measured course distance in kilometers when known.
   *
   * `null` means unknown/unpublished. Zero is never a valid race distance.
   */
  distanceKm: number | null
  /**
   * Official/measured positive elevation gain in meters when known.
   *
   * `null` means unknown/unpublished. Zero is a valid known value for a flat
   * course and must not be used as a replacement for missing data.
   */
  elevationGainM: number | null
  /** Concrete start date/time when known; allows courses on different edition days. */
  scheduledStartAt?: string | null
  /** Course-specific start/location label when it differs from the edition host location. */
  startLocationLabel?: string | null
  /** Notes/instructions specific to this course. */
  notes?: string | null
  status: RaceCourseStatus
}

/** Editable original sporting profile fields owned by RaceCourse. */
export interface RaceCourseOriginalProfile {
  distanceKm: number | null
  elevationGainM: number | null
}

/** Catalog aggregate used by read/application boundaries without persistence coupling. */
export interface RaceCatalogAggregate {
  event: RaceEvent
  editions: readonly RaceEditionCatalogNode[]
}

export interface RaceEditionCatalogNode {
  edition: RaceEdition
  courses: readonly RaceCourse[]
}

/**
 * Stable catalog reference that may be stored by planning/application layers.
 *
 * RaceCourse is the concrete selectable unit. Parent IDs are carried as scope
 * evidence so callers can reject mismatched event/edition/course combinations
 * without inferring ancestry from labels.
 */
export interface RaceCourseReference {
  raceEventId: string
  raceEditionId: string
  raceCourseId: string
}

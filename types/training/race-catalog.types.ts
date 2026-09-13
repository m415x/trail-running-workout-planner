import type { BaseEntity } from '@/types/core/base.types'

/** Stable lifecycle for the catalog identity that survives across editions. */
export type RaceEventStatus = 'active' | 'archived'

/** Lifecycle of one time-bounded edition of an event. */
export type RaceEditionStatus = 'draft' | 'published' | 'completed' | 'cancelled'

/** Lifecycle of one concrete course offered by an edition. */
export type RaceCourseStatus = 'draft' | 'published' | 'cancelled'

/**
 * Stable identity of a competitive event across time.
 *
 * Example: "Patagonia Run". A RaceEvent is not a distance and is not the
 * concrete competitive unit referenced by planning.
 */
export interface RaceEvent extends BaseEntity {
  /** Human-facing stable event name; not used as technical identity. */
  name: string
  status: RaceEventStatus
}

/**
 * One temporal occurrence of a RaceEvent.
 *
 * Example: "Patagonia Run 2027". Edition identity is immutable even when its
 * dates or published courses are corrected later.
 */
export interface RaceEdition extends BaseEntity {
  raceEventId: string
  /** Human-facing edition label such as "2027"; not a unique technical key. */
  label: string
  status: RaceEditionStatus
}

/**
 * One concrete competitive course within a RaceEdition.
 *
 * Example: the 42K course of Patagonia Run 2027. Planning and future athlete
 * registration reference this identity rather than RaceEvent/RaceEdition.
 * Sporting profile fields are intentionally introduced by later KAN-257 tasks.
 */
export interface RaceCourse extends BaseEntity {
  raceEditionId: string
  /** Human-facing course label such as "42K"; not a unique technical key. */
  label: string
  status: RaceCourseStatus
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

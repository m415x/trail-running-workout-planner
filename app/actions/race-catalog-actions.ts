'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { RaceCourseModality } from '@/types/training/race-catalog.types'
import { db } from '@/db'
import {
  createRaceEvent, createRaceEdition, createRaceCourse,
  getRaceEvent, getRaceEdition, getRaceCourse,
  updateRaceEvent, updateRaceEdition, updateRaceCourse,
  softDeleteRaceEdition, softDeleteRaceCourse, searchRaceCourses,
} from '@/lib/race-catalog/catalog-repository'
import {
  eventFormSchema, editionFormSchema, courseFormSchema,
  type CatalogFormState,
} from '@/lib/race-catalog/catalog-form'
import { validateRaceCourseSelection } from '@/lib/race-catalog/race-course-selection-policy'

/** Searches shared product data. Consumers authorize their own team/athlete writes. */
export async function searchSelectableRaceCourses(query: string) {
  if (typeof query !== 'string' || query.length > 200) return []
  return searchRaceCourses({ query, selectableOnly: true, limit: 50 })
    .filter(({ event, edition, course }) => validateRaceCourseSelection(event, edition, course).valid)
}

/**
 * Maintains catalog-owned fields only. No consumer snapshot is written here.
 * Re-read ancestry and revision in the same SQLite transaction as the mutation.
 */
export async function saveRaceCatalog(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const value = (key: string) => String(formData.get(key) ?? '')
  const kind = value('kind')
  const operation = value('operation')
  const locale = value('locale') === 'en' ? 'en' : 'es'
  const base = locale === 'en' ? '/en/dashboard/competitions' : '/dashboard/competitions'
  if (!['event', 'edition', 'course'].includes(kind)
    || !['save', 'archive'].includes(operation)) return { error: 'invalid' }

  let destination = base
  try {
    const result = db.transaction((): CatalogFormState => {
      const id = value('id')
      const event = kind === 'event' ? (id ? getRaceEvent(id) : null) : getRaceEvent(value('eventId'))
      const edition = kind === 'edition' ? (id ? getRaceEdition(id) : null)
        : kind === 'course' ? getRaceEdition(value('editionId')) : null
      const course = kind === 'course' && id ? getRaceCourse(id) : null
      const existing = kind === 'event' ? event : kind === 'edition' ? edition : course

      if ((id && (!existing || existing.isDeleted))
        || (kind !== 'event' && (!event || event.isDeleted))
        || (edition && edition.raceEventId !== event?.id)
        || (kind === 'course' && (!edition || edition.isDeleted))
        || (course && course.raceEditionId !== edition?.id)) return { error: 'unavailable' }
      if (existing && existing.updatedAt !== value('revision')) return { error: 'stale' }

      if (operation === 'archive') {
        if (!existing) return { error: 'unavailable' }
        if (kind === 'event') updateRaceEvent(id, { status: 'archived' })
        else if (kind === 'edition') softDeleteRaceEdition(id)
        else softDeleteRaceCourse(id)
        destination = kind === 'event' ? base
          : kind === 'edition' ? base + '/' + event!.id
          : base + '/' + event!.id + '/editions/' + edition!.id
        return {}
      }

      const raw = Object.fromEntries(formData)
      if (kind === 'event') {
        const parsed = eventFormSchema.safeParse(raw)
        if (!parsed.success) return { error: 'invalid', fields: parsed.error.issues.map(issue => String(issue.path[0])) }
        const saved = id ? updateRaceEvent(id, parsed.data) : createRaceEvent(parsed.data)
        destination = base + '/' + saved.id
      } else if (kind === 'edition') {
        const parsed = editionFormSchema.safeParse(raw)
        if (!parsed.success) return { error: 'invalid', fields: parsed.error.issues.map(issue => String(issue.path[0])) }
        const { locality, region, countryCode, ...fields } = parsed.data
        const input = { ...fields, location: { locality, region, countryCode } }
        const saved = id ? updateRaceEdition(id, input)
          : createRaceEdition({ ...input, raceEventId: event!.id })
        destination = base + '/' + event!.id + '/editions/' + saved.id
      } else {
        const parsed = courseFormSchema.safeParse(raw)
        if (!parsed.success) return { error: 'invalid', fields: parsed.error.issues.map(issue => String(issue.path[0])) }
        const { modalityCode, modalityLabel, ...fields } = parsed.data
        const modality: RaceCourseModality | null = modalityCode === '' ? null : modalityCode === 'other'
          ? { code: modalityCode, label: modalityLabel } : { code: modalityCode }
        // Omitted classifications/provenance preserve the existing source facts.
        const input = { ...fields, modality,
          scheduledStartAt: course && fields.scheduledStartAt === (course.scheduledStartAt?.slice(0, 16) ?? null)
            ? course.scheduledStartAt : fields.scheduledStartAt,
        }
        const saved = id ? updateRaceCourse(id, input)
          : createRaceCourse({ ...input, raceEditionId: edition!.id })
        destination = base + '/' + event!.id + '/editions/' + edition!.id + '/courses/' + saved.id
      }
      return {}
    })
    if (result.error) return result
  } catch (error) {
    console.error('Catalog mutation failed', error)
    return { error: 'saveFailed' }
  }
  revalidatePath('/[locale]/dashboard/competitions/[[...segments]]', 'page')
  redirect(destination)
}

import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'

export function CourseRegistration({
  event,
  edition,
  course,
}: {
  event: RaceEvent
  edition: RaceEdition
  course: RaceCourse
}) {
  return (
    <section aria-label='Race registration' className='rounded-lg border p-4'>
      <h3 className='text-lg font-semibold'>Atletas inscriptos</h3>
      <p className='text-sm text-muted-foreground'>
        {event.name} · {edition.label} · {course.label}
      </p>
    </section>
  )
}

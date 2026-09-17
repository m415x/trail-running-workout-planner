import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'

type RegistrationInteraction = {
  eligible: Array<{ athleteProfileId: string; athleteName: string }>
  registeredHere: Array<{ athleteProfileId: string; athleteName: string; courseLabel: string }>
  registeredElsewhere: Array<{ athleteProfileId: string; athleteName: string; courseLabel: string }>
}

export function CourseRegistration({
  event,
  edition,
  course,
  interaction,
}: {
  event: RaceEvent
  edition: RaceEdition
  course: RaceCourse
  interaction: RegistrationInteraction
}) {
  return (
    <section aria-label='Race registration' className='rounded-lg border p-4'>
      <h3 className='text-lg font-semibold'>Atletas inscriptos</h3>
      <p className='text-sm text-muted-foreground'>
        {event.name} · {edition.label} · {course.label}
      </p>
      <p className='mt-2 text-sm text-muted-foreground'>
        {interaction.eligible.length} disponibles · {interaction.registeredHere.length} inscriptos aquí · {interaction.registeredElsewhere.length} en otro recorrido
      </p>
    </section>
  )
}

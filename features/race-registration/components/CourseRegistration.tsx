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

      <div className='mt-4 space-y-2'>
        {interaction.eligible.map((athlete) => (
          <label key={athlete.athleteProfileId} className='flex items-center gap-2'>
            <input
              type='checkbox'
              name='athleteProfileId'
              value={athlete.athleteProfileId}
            />
            <span>{athlete.athleteName}</span>
          </label>
        ))}

        {interaction.registeredHere.map((athlete) => (
          <div key={athlete.athleteProfileId} className='flex items-center justify-between gap-2'>
            <span>{athlete.athleteName}</span>
            <span className='text-sm text-muted-foreground'>Inscripto en este recorrido</span>
          </div>
        ))}

        {interaction.registeredElsewhere.map((athlete) => (
          <div key={athlete.athleteProfileId} className='flex items-center justify-between gap-2'>
            <span>{athlete.athleteName}</span>
            <span className='text-sm text-muted-foreground'>Inscripto en {athlete.courseLabel}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

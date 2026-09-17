'use client'

import { useActionState, useRef, useState } from 'react'

import { raceRegistrationAction } from '@/app/actions/race-registration-actions'
import { ConfirmActionDialog } from '@/components/ui/custom/confirm-dialog'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'

type RegistrationInteraction = {
  eligible: Array<{ athleteProfileId: string; athleteName: string }>
  registeredHere: Array<{ athleteProfileId: string; athleteName: string; courseLabel: string }>
  registeredElsewhere: Array<{ athleteProfileId: string; athleteName: string; courseLabel: string }>
}

type RegistrationResult = Awaited<ReturnType<typeof raceRegistrationAction>> | null

export function CourseRegistration({
  event,
  edition,
  course,
  interaction,
  locale,
}: {
  event: RaceEvent
  edition: RaceEdition
  course: RaceCourse
  interaction: RegistrationInteraction
  locale: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([])
  const [result, formAction] = useActionState<RegistrationResult, FormData>(
    async (_previousResult, formData) => raceRegistrationAction(formData),
    null,
  )
  const selectedAthletes = interaction.eligible.filter((athlete) => (
    selectedAthleteIds.includes(athlete.athleteProfileId)
  ))

  const toggleAthlete = (athleteProfileId: string, checked: boolean) => {
    setSelectedAthleteIds((current) => checked
      ? [...current, athleteProfileId]
      : current.filter((id) => id !== athleteProfileId))
  }

  return (
    <section aria-label='Race registration' className='rounded-lg border p-4'>
      <h3 className='text-lg font-semibold'>Atletas inscriptos</h3>
      <p className='text-sm text-muted-foreground'>
        {event.name} · {edition.label} · {course.label}
      </p>
      <p className='mt-2 text-sm text-muted-foreground'>
        {interaction.eligible.length} disponibles · {interaction.registeredHere.length} inscriptos aquí · {interaction.registeredElsewhere.length} en otro recorrido
      </p>

      <form ref={formRef} action={formAction} className='mt-4 space-y-2'>
        <input type='hidden' name='courseId' value={course.id} />
        <input type='hidden' name='locale' value={locale} />

        {interaction.eligible.map((athlete) => (
          <label key={athlete.athleteProfileId} className='flex items-center gap-2'>
            <input
              type='checkbox'
              name='athleteProfileId'
              value={athlete.athleteProfileId}
              checked={selectedAthleteIds.includes(athlete.athleteProfileId)}
              onChange={(event) => toggleAthlete(athlete.athleteProfileId, event.target.checked)}
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

        {interaction.eligible.length > 0 && (
          <ConfirmActionDialog
            variant='primary'
            title='Confirmar inscripciones'
            description={`Vas a inscribir en ${edition.label} · ${course.label}: ${selectedAthletes.map((athlete) => athlete.athleteName).join(', ')}`}
            confirmLabel='Inscribir'
            cancelLabel='Cancelar'
            onConfirm={() => formRef.current?.requestSubmit()}
            trigger={(openDialog) => (
              <button
                type='button'
                disabled={selectedAthleteIds.length === 0}
                onClick={openDialog}
                className='rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50'
              >
                Inscribir seleccionados
              </button>
            )}
          />
        )}
      </form>

      {result && (
        <div className='mt-4 rounded-md border p-3 text-sm' role='status'>
          <p>
            Solicitadas: {result.requested} · Exitosas: {result.succeeded} · Fallidas: {result.failed}
          </p>
          {result.failures.map((failure) => (
            <p key={failure.athleteProfileId} className='mt-1 text-muted-foreground'>
              {failure.athleteProfileId}: ya tiene una inscripción en {failure.existingCourseLabel}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}

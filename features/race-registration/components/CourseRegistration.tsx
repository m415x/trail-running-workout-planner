'use client'

import { useActionState, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { changeRaceRegistrationCourseAction, registerAthletesForRaceCourse } from '@/app/actions/race-registration-actions'
import { ConfirmActionDialog } from '@/components/ui/custom/confirm-dialog'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'

type RegistrationInteraction = {
  eligible: Array<{ athleteProfileId: string; athleteName: string }>
  registeredHere: Array<{ athleteProfileId: string; athleteName: string; registrationId: string; courseLabel: string }>
  registeredElsewhere: Array<{ athleteProfileId: string; athleteName: string; registrationId: string; courseLabel: string }>
}

type RegistrationResult = Awaited<ReturnType<typeof registerAthletesForRaceCourse>> | null

export function CourseRegistration({ event, edition, course, interaction, locale }: {
  event: RaceEvent
  edition: RaceEdition
  course: RaceCourse
  interaction: RegistrationInteraction
  locale: string
}) {
  const t = useTranslations('RaceCatalog.registrations')
  const tCatalog = useTranslations('RaceCatalog')
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([])
  const [result, formAction] = useActionState<RegistrationResult, FormData>(
    async (_previousResult, formData) => registerAthletesForRaceCourse(formData),
    null,
  )
  const selectedAthletes = interaction.eligible.filter((athlete) => selectedAthleteIds.includes(athlete.athleteProfileId))

  const toggleAthlete = (athleteProfileId: string, checked: boolean) => {
    setSelectedAthleteIds((current) => checked ? [...current, athleteProfileId] : current.filter((id) => id !== athleteProfileId))
  }

  return (
    <section aria-label='Race registration' className='rounded-lg border p-4'>
      <h3 className='text-lg font-semibold'>{t('title')}</h3>
      <p className='text-sm text-muted-foreground'>{event.name} · {edition.label} · {course.label}</p>
      <p className='mt-2 text-sm text-muted-foreground'>{t('summary', { eligible: interaction.eligible.length, here: interaction.registeredHere.length, elsewhere: interaction.registeredElsewhere.length })}</p>

      <form ref={formRef} action={formAction} className='mt-4 space-y-2'>
        <input type='hidden' name='courseId' value={course.id} />
        <input type='hidden' name='locale' value={locale} />

        {interaction.eligible.map((athlete) => (
          <label key={athlete.athleteProfileId} className='flex items-center gap-2'>
            <input type='checkbox' name='athleteProfileId' value={athlete.athleteProfileId} checked={selectedAthleteIds.includes(athlete.athleteProfileId)} onChange={(event) => toggleAthlete(athlete.athleteProfileId, event.target.checked)} />
            <span>{athlete.athleteName}</span>
          </label>
        ))}

        {interaction.registeredHere.map((athlete) => (
          <div key={athlete.athleteProfileId} className='flex items-center justify-between gap-2'>
            <span>{athlete.athleteName}</span>
            <span className='text-sm text-muted-foreground'>{t('registeredHere')}</span>
          </div>
        ))}

        {interaction.registeredElsewhere.map((athlete) => (
          <div key={athlete.athleteProfileId} className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <span>{athlete.athleteName}</span>
              <span className='ml-2 text-sm text-muted-foreground'>{t('registeredElsewhere', { course: athlete.courseLabel })}</span>
            </div>
            <form action={changeRaceRegistrationCourseAction}>
              <input type='hidden' name='registrationId' value={athlete.registrationId} />
              <input type='hidden' name='raceCourseId' value={course.id} />
              <button type='submit' className='rounded-md border px-2 py-1 text-xs font-medium'>
                {t('changeCourse')}
              </button>
            </form>
          </div>
        ))}

        {interaction.eligible.length > 0 && (
          <ConfirmActionDialog
            variant='primary'
            title={t('confirmTitle')}
            description={t('confirmDescription', { edition: edition.label, course: course.label, athletes: selectedAthletes.map((athlete) => athlete.athleteName).join(', ') })}
            confirmLabel={t('confirm')}
            cancelLabel={tCatalog('cancel')}
            onConfirm={() => formRef.current?.requestSubmit()}
            trigger={(openDialog) => (
              <button type='button' disabled={selectedAthleteIds.length === 0} onClick={openDialog} className='rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50'>
                {t('submitSelected')}
              </button>
            )}
          />
        )}
      </form>

      {result && (
        <div className='mt-4 rounded-md border p-3 text-sm' role='status'>
          <p>{t('requested', { count: result.requested })} · {t('succeeded', { count: result.succeeded })} · {t('failed', { count: result.failed })}</p>
          {result.failures.map((failure) => (
            <p key={failure.athleteProfileId} className='mt-1 text-muted-foreground'>{t('alreadyRegistered', { athlete: failure.athleteProfileId, course: failure.existingCourseLabel })}</p>
          ))}
        </div>
      )}
    </section>
  )
}

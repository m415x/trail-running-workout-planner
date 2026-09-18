'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { changeRaceRegistrationCourseFormAction } from '@/app/actions/race-registration-actions'
import { ConfirmActionDialog } from '@/components/ui/custom/confirm-dialog'
import { Button } from '@ui/button'

export function RaceRegistrationCourseChange({
  locale,
  registrationId,
  currentRaceCourseId,
  courses,
  label,
}: {
  locale: string
  registrationId: string
  currentRaceCourseId: string
  courses: Array<{ id: string; label: string }>
  label: string
}) {
  const t = useTranslations('RaceCatalog.registrations')
  const formRef = useRef<HTMLFormElement>(null)
  const [raceCourseId, setRaceCourseId] = useState(currentRaceCourseId)
  const changed = raceCourseId !== currentRaceCourseId
  const currentCourse = courses.find((course) => course.id === currentRaceCourseId)?.label ?? currentRaceCourseId
  const newCourse = courses.find((course) => course.id === raceCourseId)?.label ?? raceCourseId

  return (
    <div className='flex min-w-[18rem] flex-1 gap-2'>
      <form ref={formRef} action={changeRaceRegistrationCourseFormAction} className='contents'>
        <input type='hidden' name='locale' value={locale} />
        <input type='hidden' name='registrationId' value={registrationId} />
        <select
          name='raceCourseId'
          value={raceCourseId}
          onChange={(event) => setRaceCourseId(event.target.value)}
          className='h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3'
        >
          {courses.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}
        </select>
      </form>

      {changed && (
        <ConfirmActionDialog
          variant='primary'
          title={t('changeCourseConfirmTitle')}
          description={t('changeCourseConfirmDescription', { currentCourse, newCourse })}
          confirmLabel={t('changeCourseConfirmAction')}
          cancelLabel={t('changeCourseConfirmKeep')}
          onConfirm={() => formRef.current?.requestSubmit()}
          trigger={(openDialog) => (
            <Button type='button' size='sm' variant='outline' onClick={openDialog}>{label}</Button>
          )}
        />
      )}
    </div>
  )
}

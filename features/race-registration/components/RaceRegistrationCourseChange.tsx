'use client'

import { useState } from 'react'

import { changeRaceRegistrationCourseFormAction } from '@/app/actions/race-registration-actions'
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
  const [raceCourseId, setRaceCourseId] = useState(currentRaceCourseId)
  const changed = raceCourseId !== currentRaceCourseId

  return (
    <form action={changeRaceRegistrationCourseFormAction} className='flex min-w-[18rem] flex-1 gap-2'>
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
      {changed && <Button type='submit' size='sm' variant='outline'>{label}</Button>}
    </form>
  )
}

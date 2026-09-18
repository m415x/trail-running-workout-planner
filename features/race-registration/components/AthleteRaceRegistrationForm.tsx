'use client'

import { useState } from 'react'

import { registerAthleteForRaceCourseFormAction } from '@/app/actions/race-registration-actions'
import { buttonVariants } from '@ui/button'

type EditionOption = { id: string; label: string }
type CourseOption = { id: string; label: string; raceEditionId: string }

export function AthleteRaceRegistrationForm({ athleteProfileId, locale, editions, courses }: {
  athleteProfileId: string
  locale: string
  editions: EditionOption[]
  courses: CourseOption[]
}) {
  const [raceEditionId, setRaceEditionId] = useState(editions[0]?.id ?? '')
  const availableCourses = courses.filter((course) => course.raceEditionId === raceEditionId)
  const es = locale === 'es'

  return (
    <form action={registerAthleteForRaceCourseFormAction} className='grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end'>
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='athleteProfileId' value={athleteProfileId} />
      <label className='grid gap-1'>
        <span className='text-xs text-muted-foreground'>{es ? 'Edición' : 'Edition'}</span>
        <select name='raceEditionId' value={raceEditionId} onChange={(event) => setRaceEditionId(event.target.value)} className='h-9 rounded-md border border-input bg-background px-3'>
          {editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.label}</option>)}
        </select>
      </label>
      <label className='grid gap-1'>
        <span className='text-xs text-muted-foreground'>{es ? 'Recorrido' : 'Course'}</span>
        <select name='raceCourseId' className='h-9 rounded-md border border-input bg-background px-3'>
          {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}
        </select>
      </label>
      <button type='submit' disabled={availableCourses.length === 0} className={buttonVariants({ size: 'sm' })}>{es ? 'Registrar' : 'Register'}</button>
    </form>
  )
}

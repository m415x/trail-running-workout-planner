'use client'

import { useEffect, useState } from 'react'

import { updateRaceParticipationFormAction } from '@/app/actions/race-registration-actions'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

type ParticipationStatus = 'unknown' | 'started' | 'finished' | 'dnf' | 'dns'

export function RaceParticipationEditor({
  locale,
  registrationId,
  participationStatus: initialStatus,
  actualDistanceKm: initialDistance,
  elapsedTimeSeconds: initialTime,
  labels,
}: {
  locale: string
  registrationId: string
  participationStatus: ParticipationStatus
  actualDistanceKm: number | null
  elapsedTimeSeconds: number | null
  labels: {
    participation: string
    actualDistance: string
    elapsedTime: string
    saveResult: string
    statuses: Record<ParticipationStatus, string>
  }
}) {
  const [participationStatus, setParticipationStatus] = useState<ParticipationStatus>(initialStatus)
  const [actualDistanceKm, setActualDistanceKm] = useState(initialDistance?.toString() ?? '')
  const [elapsedTimeSeconds, setElapsedTimeSeconds] = useState(initialTime?.toString() ?? '')
  useEffect(() => {
    setParticipationStatus(initialStatus)
    setActualDistanceKm(initialDistance?.toString() ?? '')
    setElapsedTimeSeconds(initialTime?.toString() ?? '')
  }, [initialStatus, initialDistance, initialTime])
  const changed =
    participationStatus !== initialStatus ||
    actualDistanceKm !== (initialDistance?.toString() ?? '') ||
    elapsedTimeSeconds !== (initialTime?.toString() ?? '')

  return (
    <form action={updateRaceParticipationFormAction} className='grid min-w-0 gap-2 sm:grid-cols-[minmax(9rem,1.2fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_auto] sm:items-end'>
      <input type='hidden' name='locale' value={locale} />
      <input type='hidden' name='registrationId' value={registrationId} />
      <label className='grid min-w-0 gap-1'>
        <span className='text-xs text-muted-foreground'>{labels.participation}</span>
        <select name='participationStatus' value={participationStatus} onChange={(event) => setParticipationStatus(event.target.value as ParticipationStatus)} className='h-9 rounded-md border border-input bg-background px-3'>
          {(Object.keys(labels.statuses) as ParticipationStatus[]).map((status) => <option key={status} value={status}>{labels.statuses[status]}</option>)}
        </select>
      </label>
      <label className='grid gap-1'>
        <span className='text-xs text-muted-foreground'>{labels.actualDistance}</span>
        <Input name='actualDistanceKm' type='number' min='0' step='any' value={actualDistanceKm} onChange={(event) => setActualDistanceKm(event.target.value)} />
      </label>
      <label className='grid gap-1'>
        <span className='text-xs text-muted-foreground'>{labels.elapsedTime}</span>
        <Input name='elapsedTimeSeconds' type='number' min='0' step='1' value={elapsedTimeSeconds} onChange={(event) => setElapsedTimeSeconds(event.target.value)} />
      </label>
      <div className='flex items-end'>
        {changed && <Button type='submit' size='sm'>{labels.saveResult}</Button>}
      </div>
    </form>
  )
}

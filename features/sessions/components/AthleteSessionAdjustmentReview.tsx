'use client'

import { useActionState } from 'react'

import {
  saveAthleteSessionAdjustment,
  type SessionAthleteAdjustmentReviewItem,
} from '@/app/actions/athlete-session-adjustment-actions'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

export function AthleteSessionAdjustmentReview({
  sessionId,
  items,
}: {
  sessionId: string
  items: SessionAthleteAdjustmentReviewItem[]
}) {
  return (
    <div className='space-y-4'>
      {items.map((item) => (
        <AthleteAdjustmentForm key={item.athleteId} sessionId={sessionId} item={item} />
      ))}
    </div>
  )
}

function AthleteAdjustmentForm({
  sessionId,
  item,
}: {
  sessionId: string
  item: SessionAthleteAdjustmentReviewItem
}) {
  const [state, action, pending] = useActionState(saveAthleteSessionAdjustment, {})

  return (
    <form action={action} className='space-y-3 rounded-lg border p-4'>
      <input type='hidden' name='sessionId' value={sessionId} />
      <input type='hidden' name='athleteId' value={item.athleteId} />
      <input type='hidden' name='sourcePrescriptionId' value={item.sourcePrescriptionId} />

      <div className='flex items-center justify-between gap-3'>
        <strong>{item.athleteName}</strong>
        {item.omitted && <span className='text-xs text-muted-foreground'>omitted</span>}
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <Input name='distanceKm' type='number' step='0.1' min='0' defaultValue={item.distanceKm ?? ''} />
        <Input name='durationMin' type='number' step='1' min='0' defaultValue={item.durationMin ?? ''} />
        <Input name='elevationGain' type='number' step='1' min='0' defaultValue={item.elevationGain ?? ''} />
      </div>

      <Input name='intensity' defaultValue={item.intensity ?? ''} />
      <Input name='rescheduled' type='date' defaultValue={item.rescheduled ?? ''} />
      <Input name='stimulus' defaultValue={item.stimulus ?? ''} />

      <label className='flex items-center gap-2 text-sm'>
        <input name='omitted' type='checkbox' defaultChecked={item.omitted} />
        omitted
      </label>

      <input type='hidden' name='mode' value='dose' />
      {state.error && <p className='text-sm text-destructive'>{state.error}</p>}
      <Button type='submit' disabled={pending}>Guardar ajuste individual</Button>
    </form>
  )
}
'use client'

import { useActionState } from 'react'

import {
  updateMicrocycleDates,
  type MicrocycleDatesFormState,
} from '@/app/actions/planning-actions'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

interface MicrocycleDatesFormProps {
  microcycleId: string
  planId: string
  locale: string
  startDate: string
  endDate: string
}

const initialState: MicrocycleDatesFormState = {}

export function MicrocycleDatesForm({
  microcycleId,
  planId,
  locale,
  startDate,
  endDate,
}: MicrocycleDatesFormProps) {
  const [state, formAction, pending] = useActionState(updateMicrocycleDates, initialState)

  return (
    <form action={formAction} className='flex min-w-72 flex-col gap-1.5'>
      <input type='hidden' name='microcycleId' value={microcycleId} />
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />

      <div className='flex flex-wrap items-center gap-2'>
        <Input
          name='startDate'
          type='date'
          defaultValue={startDate}
          required
          aria-label='Fecha inicial del microciclo'
          aria-invalid={Boolean(state.error)}
          className='w-36'
        />
        <span className='text-muted-foreground'>–</span>
        <Input
          name='endDate'
          type='date'
          defaultValue={endDate}
          required
          aria-label='Fecha final del microciclo'
          aria-invalid={Boolean(state.error)}
          className='w-36'
        />
        <Button type='submit' size='sm' variant='outline' disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar fechas'}
        </Button>
      </div>

      {state.error && <p role='alert' className='text-xs text-destructive'>{state.error}</p>}
    </form>
  )
}

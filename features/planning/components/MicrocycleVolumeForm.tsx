'use client'

import { useActionState } from 'react'

import {
  updateMicrocycleVolume,
  type MicrocycleVolumeFormState,
} from '@/app/actions/planning-actions'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

interface MicrocycleVolumeFormProps {
  microcycleId: string
  planId: string
  locale: string
  currentVolumeKm: number | null
}

const initialState: MicrocycleVolumeFormState = {}

export function MicrocycleVolumeForm({
  microcycleId,
  planId,
  locale,
  currentVolumeKm,
}: MicrocycleVolumeFormProps) {
  const [state, formAction, pending] = useActionState(updateMicrocycleVolume, initialState)

  return (
    <form action={formAction} className='flex min-w-52 flex-col items-end gap-1.5'>
      <input type='hidden' name='microcycleId' value={microcycleId} />
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />

      <div className='flex items-center gap-2'>
        <div className='relative'>
          <Input
            name='targetVolumeKm'
            type='number'
            min='0.1'
            max='1000'
            step='0.1'
            defaultValue={currentVolumeKm ?? ''}
            required
            aria-label='Volumen objetivo en kilómetros'
            aria-invalid={Boolean(state.error)}
            className='w-24 pr-8'
          />
          <span className='pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground'>km</span>
        </div>
        <Button type='submit' size='sm' disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      {state.error && <p role='alert' className='text-xs text-destructive'>{state.error}</p>}
    </form>
  )
}

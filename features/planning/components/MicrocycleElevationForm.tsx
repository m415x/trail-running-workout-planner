'use client'

import { useActionState } from 'react'

import {
  updateMicrocycleElevation,
  type MicrocycleElevationFormState,
} from '@/app/actions/planning-actions'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Input } from '@ui/input'

import type { TargetElevationSource } from '@/types'

interface MicrocycleElevationFormProps {
  microcycleId: string
  planId: string
  locale: string
  currentElevationGain: number | null
  currentSource: TargetElevationSource
}

const initialState: MicrocycleElevationFormState = {}

export function MicrocycleElevationForm({
  microcycleId,
  planId,
  locale,
  currentElevationGain,
  currentSource,
}: MicrocycleElevationFormProps) {
  const [state, formAction, pending] = useActionState(updateMicrocycleElevation, initialState)

  return (
    <form action={formAction} className='flex min-w-56 flex-col gap-1.5'>
      <input type='hidden' name='microcycleId' value={microcycleId} />
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />

      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <Input
            name='targetElevationGain'
            type='number'
            min='0'
            max='100000'
            step='1'
            defaultValue={currentElevationGain ?? ''}
            placeholder='Sin D+'
            aria-label='Desnivel positivo objetivo en metros'
            aria-invalid={Boolean(state.error)}
            className='w-28 pr-7'
          />
          <span className='pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground'>m</span>
        </div>
        <Button type='submit' size='sm' disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Badge variant='outline'>{currentSource === 'manual' ? 'Manual' : 'Generado'}</Badge>
      </div>

      {state.error && <p role='alert' className='text-xs text-destructive'>{state.error}</p>}
    </form>
  )
}

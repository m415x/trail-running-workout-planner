'use client'

import { useActionState } from 'react'

import {
  updateMicrocycleType,
  type MicrocycleTypeFormState,
} from '@/app/actions/planning-actions'
import { Button } from '@ui/button'

import type { MicrocycleType } from '@/types'

interface MicrocycleTypeFormProps {
  microcycleId: string
  planId: string
  locale: string
  currentType: MicrocycleType
}

const typeOptions: Array<{ value: MicrocycleType; label: string }> = [
  { value: 'base', label: 'Base' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'shock', label: 'Choque' },
  { value: 'deload', label: 'Descarga' },
  { value: 'tapering', label: 'Tapering' },
  { value: 'race', label: 'Competencia' },
]

const initialState: MicrocycleTypeFormState = {}

export function MicrocycleTypeForm({
  microcycleId,
  planId,
  locale,
  currentType,
}: MicrocycleTypeFormProps) {
  const [state, formAction, pending] = useActionState(updateMicrocycleType, initialState)

  return (
    <form action={formAction} className='flex min-w-48 flex-col gap-1.5'>
      <input type='hidden' name='microcycleId' value={microcycleId} />
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />

      <div className='flex items-center gap-2'>
        <select
          name='type'
          defaultValue={currentType}
          required
          aria-label='Tipo de microciclo'
          aria-invalid={Boolean(state.error)}
          className='h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <Button type='submit' size='sm' variant='outline' disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar tipo'}
        </Button>
      </div>

      {state.error && <p role='alert' className='text-xs text-destructive'>{state.error}</p>}
    </form>
  )
}

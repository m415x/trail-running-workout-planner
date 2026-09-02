'use client'

import { useActionState } from 'react'

import {
  updateMicrocycleNotes,
  type MicrocycleNotesFormState,
} from '@/app/actions/planning-actions'
import { Button } from '@ui/button'

interface MicrocycleNotesFormProps {
  microcycleId: string
  planId: string
  locale: string
  currentNotes: string | null
}

const initialState: MicrocycleNotesFormState = {}

export function MicrocycleNotesForm({
  microcycleId,
  planId,
  locale,
  currentNotes,
}: MicrocycleNotesFormProps) {
  const [state, formAction, pending] = useActionState(updateMicrocycleNotes, initialState)

  return (
    <form action={formAction} className='flex min-w-72 flex-col gap-1.5'>
      <input type='hidden' name='microcycleId' value={microcycleId} />
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />

      <textarea
        name='notes'
        rows={3}
        maxLength={2000}
        defaultValue={currentNotes ?? ''}
        placeholder='Agregá indicaciones u observaciones para esta semana.'
        aria-label='Notas del microciclo'
        aria-invalid={Boolean(state.error)}
        className='w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'
      />

      <div className='flex items-start justify-between gap-2'>
        <div>
          {state.error && <p role='alert' className='text-xs text-destructive'>{state.error}</p>}
          {!state.error && <p className='text-xs text-muted-foreground'>Dejá el campo vacío para eliminar la nota.</p>}
        </div>
        <Button type='submit' size='sm' variant='outline' disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar notas'}
        </Button>
      </div>
    </form>
  )
}

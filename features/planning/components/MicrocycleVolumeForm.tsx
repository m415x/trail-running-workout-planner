'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  updateMicrocycleVolume,
  type MicrocycleVolumeFormState,
} from '@/app/actions/planning-actions'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { normalizeMicrocyclePlanningDraft } from '@/lib/numeric/microcycle-planning-draft'

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
  const t = useTranslations('CoachPlanning')
  const [clientError, setClientError] = useState(false)
  const [state, formAction, pending] = useActionState(updateMicrocycleVolume, initialState)

  return (
    <form action={(formData: FormData) => {
      const raw = String(formData.get('targetVolumeKm') ?? '')
      const normalized = normalizeMicrocyclePlanningDraft(raw, 'volumeKm')
      if (normalized.status !== 'valid') {
        setClientError(true)
        return
      }
      setClientError(false)
      formData.set('targetVolumeKm', normalized.status === 'valid' ? normalized.value : '')
      formAction(formData)
    }} className='flex min-w-52 flex-col items-end gap-1.5'>
      <input type='hidden' name='microcycleId' value={microcycleId} />
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />

      <div className='flex items-center gap-2'>
        <div className='relative'>
          <Input
            name='targetVolumeKm'
            type='text'
            inputMode='decimal'
            min='0.1'
            max='1000'
            step='0.1'
            defaultValue={currentVolumeKm ?? ''}
            required
            aria-label={t('targetVolumeKm')}
            aria-invalid={Boolean(state.error) || clientError}
            className='w-24 pr-8'
          />
          <span className='pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground'>km</span>
        </div>
        <Button type='submit' size='sm' disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
      </div>

      {clientError && <p role='alert' className='text-xs text-destructive'>{locale === 'es' ? 'Ingresá un número válido.' : 'Enter a valid number.'}</p>}
      {state.error && <p role='alert' className='text-xs text-destructive'>{state.error}</p>}
    </form>
  )
}

'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  updateMicrocycleElevation,
  type MicrocycleElevationFormState,
} from '@/app/actions/planning-actions'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { normalizeMicrocyclePlanningDraft } from '@/lib/numeric/microcycle-planning-draft'

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
  const t = useTranslations('CoachPlanning')
  const [clientError, setClientError] = useState(false)
  const [state, formAction, pending] = useActionState(updateMicrocycleElevation, initialState)

  return (
    <form action={(formData: FormData) => {
      const raw = String(formData.get('targetElevationGain') ?? '')
      const normalized = normalizeMicrocyclePlanningDraft(raw, 'elevationGainM')
      if (normalized.status === 'invalid') {
        setClientError(true)
        return
      }
      setClientError(false)
      formData.set('targetElevationGain', normalized.status === 'valid' ? normalized.value : '')
      formAction(formData)
    }} className='flex min-w-56 flex-col gap-1.5'>
      <input type='hidden' name='microcycleId' value={microcycleId} />
      <input type='hidden' name='planId' value={planId} />
      <input type='hidden' name='locale' value={locale} />

      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <Input
            name='targetElevationGain'
            type='text'
            inputMode='numeric'
            min='0'
            max='100000'
            step='1'
            defaultValue={currentElevationGain ?? ''}
            placeholder={t('microcycleEditor.elevationPlaceholder')}
            aria-label={t('microcycleEditor.elevationAria')}
            aria-invalid={Boolean(state.error) || clientError}
            className='w-28 pr-7'
          />
          <span className='pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground'>m</span>
        </div>
        <Button type='submit' size='sm' disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
        <Badge variant='outline'>{currentSource === 'manual' ? t('microcycleEditor.sourceManual') : t('microcycleEditor.sourceGenerated')}</Badge>
      </div>

      {clientError && <p role='alert' className='text-xs text-destructive'>{locale === 'es' ? 'Ingresá un número válido.' : 'Enter a valid number.'}</p>}
      {state.error && <p role='alert' className='text-xs text-destructive'>{state.error}</p>}
    </form>
  )
}

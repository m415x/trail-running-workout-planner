'use client'

import { useState, useTransition } from 'react'

import {
  applyInitialAthleteBillingTermsAction,
  changeAthleteBillingTermsAction,
} from '@/app/actions/membership-actions'
import { submitAthleteBillingTermsForm } from '@/lib/memberships/athlete-billing-terms-form-submit'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { Label } from '@ui/label'

type AthleteBillingTermsFormModel =
  | {
      mode: 'initial'
      title: string
      submitLabel: string
      effectiveFromHelp: string
    }
  | {
      mode: 'replacement'
      title: string
      submitLabel: string
      effectiveFromHelp: string
      monthlyAmount: string
      currency: string
    }

export function AthleteBillingTermsForm({
  athleteId,
  locale,
  model,
}: {
  athleteId: string
  locale: 'es' | 'en'
  model: AthleteBillingTermsFormModel
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const copy = locale === 'en'
    ? {
        effectiveFrom: 'Effective from',
        monthlyAmount: 'Monthly amount',
        currency: 'Currency',
        pending: 'Saving…',
        genericError: 'The economic terms could not be saved.',
      }
    : {
        effectiveFrom: 'Vigente desde',
        monthlyAmount: 'Importe mensual',
        currency: 'Moneda',
        pending: 'Guardando…',
        genericError: 'No se pudieron guardar las condiciones económicas.',
      }

  function handleSubmit(formData: FormData) {
    setError(null)

    startTransition(async () => {
      const common = {
        athleteId,
        locale,
        effectiveFrom: String(formData.get('effectiveFrom') ?? ''),
        applyInitial: applyInitialAthleteBillingTermsAction,
        changeTerms: changeAthleteBillingTermsAction,
      }

      const result = model.mode === 'replacement'
        ? await submitAthleteBillingTermsForm({
            ...common,
            mode: 'replacement',
            monthlyAmount: String(formData.get('monthlyAmount') ?? ''),
            currency: String(formData.get('currency') ?? ''),
          })
        : await submitAthleteBillingTermsForm({
            ...common,
            mode: 'initial',
          })

      if (!result.success) {
        setError(copy.genericError)
      }
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{model.title}</h3>
      <form action={handleSubmit} className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          {model.mode === 'replacement' && (
            <>
              <div className='space-y-2'>
                <Label htmlFor='monthlyAmount'>{copy.monthlyAmount}</Label>
                <Input
                  id='monthlyAmount'
                  name='monthlyAmount'
                  type='number'
                  min='1'
                  step='1'
                  defaultValue={model.monthlyAmount}
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='currency'>{copy.currency}</Label>
                <Input
                  id='currency'
                  name='currency'
                  value={model.currency}
                  readOnly
                />
              </div>
            </>
          )}

          <div className='space-y-2'>
            <Label htmlFor='effectiveFrom'>{copy.effectiveFrom}</Label>
            <Input
              id='effectiveFrom'
              name='effectiveFrom'
              type='date'
              required
            />
            <p className='text-sm text-muted-foreground'>{model.effectiveFromHelp}</p>
          </div>
        </div>

        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}

        <Button type='submit' disabled={isPending}>
          {isPending ? copy.pending : model.submitLabel}
        </Button>
      </form>
    </section>
  )
}

'use client'

import { useState, useTransition } from 'react'

import {
  applyInitialAthleteBillingTermsAction,
  changeAthleteBillingTermsAction,
  applyMonthlyChargeReductionAction,
  applyMonthlyChargeExtensionAction,
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

function MonthlyChargeReductionForm({
  athleteId,
  locale,
}: {
  athleteId: string
  locale: 'es' | 'en'
}) {
  const es = locale === 'es'
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    const period = String(formData.get('reductionPeriod') ?? '')
    const [year, month] = period.split('-').map(Number)
    const amount = Number(formData.get('reductionAmount'))

    startTransition(async () => {
      const result = await applyMonthlyChargeReductionAction({
        monthlyChargeId: String(formData.get('reductionChargeId') ?? ''),
        athleteId,
        year,
        month,
        reductionAmountMinor: Math.round(amount * 100),
        reason: String(formData.get('reductionReason') ?? ''),
        locale,
      })
      if (!result.success) {
        setError(es ? 'No se pudo aplicar la reducción.' : 'Could not apply the reduction.')
      }
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{es ? 'Reducción o beca' : 'Reduction or scholarship'}</h3>
      <form action={handleSubmit} className='grid gap-4 sm:grid-cols-2'>
        <Input name='reductionChargeId' placeholder={es ? 'ID del cargo' : 'Charge ID'} required />
        <Input name='reductionPeriod' type='month' required />
        <Input name='reductionAmount' type='number' min='0.01' step='0.01' placeholder={es ? 'Importe' : 'Amount'} required />
        <Input name='reductionReason' placeholder={es ? 'Motivo' : 'Reason'} required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? (es ? 'Aplicando…' : 'Applying…') : (es ? 'Aplicar reducción' : 'Apply reduction')}
        </Button>
      </form>
      <MonthlyChargeReductionForm athleteId={athleteId} locale={locale} />
      <MonthlyChargeExtensionForm athleteId={athleteId} locale={locale} />
    </section>
  )
}

function MonthlyChargeExtensionForm({
  athleteId,
  locale,
}: {
  athleteId: string
  locale: 'es' | 'en'
}) {
  const es = locale === 'es'
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    const period = String(formData.get('extensionPeriod') ?? '')
    const [year, month] = period.split('-').map(Number)

    startTransition(async () => {
      const result = await applyMonthlyChargeExtensionAction({
        monthlyChargeId: String(formData.get('extensionChargeId') ?? ''),
        athleteId,
        year,
        month,
        extendedDueDate: String(formData.get('extendedDueDate') ?? ''),
        reason: String(formData.get('extensionReason') ?? ''),
        locale,
      })
      if (!result.success) {
        setError(es ? 'No se pudo aplicar la prórroga.' : 'Could not apply the extension.')
      }
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{es ? 'Prórroga individual' : 'Individual extension'}</h3>
      <form action={handleSubmit} className='grid gap-4 sm:grid-cols-2'>
        <Input name='extensionChargeId' placeholder={es ? 'ID del cargo' : 'Charge ID'} required />
        <Input name='extensionPeriod' type='month' required />
        <Input name='extendedDueDate' type='date' required />
        <Input name='extensionReason' placeholder={es ? 'Motivo' : 'Reason'} required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? (es ? 'Aplicando…' : 'Applying…') : (es ? 'Aplicar prórroga' : 'Apply extension')}
        </Button>
      </form>
    </section>
  )
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

'use client'

import { useState, useTransition } from 'react'

import {
  applyInitialAthleteBillingTermsAction,
  changeAthleteBillingTermsAction,
  applyMonthlyChargeReductionAction,
  applyMonthlyChargeExtensionAction,
  registerManualPaymentAction,
  correctManualPaymentAction,
  voidManualPaymentAction,
} from '@/app/actions/membership-actions'
import { submitAthleteBillingTermsForm } from '@/lib/memberships/athlete-billing-terms-form-submit'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { Label } from '@ui/label'

type MonthlyChargeOption = {
  id: string
  year: number
  month: number
  currency: string
  amountDueMinor: number
  paidAmountMinor?: number
  remainingAmountMinor?: number
}

type PaymentRevisionHistory = {
  revisionId: string
  paymentId: string
  monthlyChargeId: string
  amountMinor: number
  paymentMethod: 'cash' | 'bank_transfer'
  paidAt: string
  voided: boolean
  isCurrent: boolean
}

type ReductionRevisionHistory = {
  id: string
  monthlyChargeId: string
  reductionAmountMinor: number
  reason: string
  isCurrent: boolean
}

type ExtensionRevisionHistory = {
  id: string
  monthlyChargeId: string
  extendedDueDate: string | null
  reason: string
  isCurrent: boolean
}

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

function formatAuditAmount(amountMinor: number, currency: string, locale: 'es' | 'en') {
  return new Intl.NumberFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100)
}

function formatAuditDate(value: string, locale: 'es' | 'en') {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function MonthlyChargeReductionForm({
  athleteId,
  locale,
  monthlyCharges,
  reductionHistory,
}: {
  athleteId: string
  locale: 'es' | 'en'
  monthlyCharges: MonthlyChargeOption[]
  reductionHistory: ReductionRevisionHistory[]
}) {
  const es = locale === 'es'
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submitReduction(formData: FormData, withdraw = false) {
    setError(null)
    setSuccess(null)
    const monthlyChargeId = String(formData.get('reductionChargeId') ?? '')
    const selectedCharge = monthlyCharges.find((charge) => charge.id === monthlyChargeId)
    const amount = Number(formData.get('reductionAmount'))

    if (!selectedCharge) {
      setError(es ? 'Seleccioná una cuota válida.' : 'Select a valid charge.')
      return
    }

    startTransition(async () => {
      const result = await applyMonthlyChargeReductionAction({
        monthlyChargeId,
        athleteId,
        year: selectedCharge.year,
        month: selectedCharge.month,
        reductionAmountMinor: withdraw ? 0 : Math.round(amount * 100),
        reason: String(formData.get('reductionReason') ?? ''),
        locale,
      })
      if (!result.success) {
        setError(es ? 'No se pudo aplicar la reducción.' : 'Could not apply the reduction.')
        return
      }
      setSuccess(withdraw
        ? (es ? 'Reducción retirada.' : 'Reduction withdrawn.')
        : (es ? 'Reducción aplicada.' : 'Reduction applied.'))
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{es ? 'Reducción o beca' : 'Reduction or scholarship'}</h3>
      <form action={submitReduction} className='grid gap-4 sm:grid-cols-2'>
        <select name='reductionChargeId' required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value=''>{es ? 'Seleccionar cargo' : 'Select charge'}</option>
          {monthlyCharges.map((charge) => (
            <option key={charge.id} value={charge.id}>
              {`${charge.year}-${String(charge.month).padStart(2, '0')} · ${charge.currency} ${(charge.amountDueMinor / 100).toFixed(2)}`}
            </option>
          ))}
        </select>
        <Input name='reductionAmount' type='number' min='0.01' step='0.01' placeholder={es ? 'Importe' : 'Amount'} required />
        <Input name='reductionReason' placeholder={es ? 'Motivo' : 'Reason'} required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        {success && <p role='status' className='text-sm text-muted-foreground'>{success}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? (es ? 'Aplicando…' : 'Applying…') : (es ? 'Aplicar reducción' : 'Apply reduction')}
        </Button>
        <Button type='submit' variant='outline' disabled={isPending} formNoValidate formAction={(formData) => submitReduction(formData, true)}>
          {es ? 'Retirar reducción' : 'Withdraw reduction'}
        </Button>
      </form>
      {reductionHistory.length > 0 && (
        <ul className='text-sm text-muted-foreground'>
          {reductionHistory.map((revision) => (
            <li key={revision.id}>
              {revision.reason} · {(() => {
                const currency = monthlyCharges.find(
                  (charge) => charge.id === revision.monthlyChargeId,
                )?.currency
                return currency
                  ? formatAuditAmount(revision.reductionAmountMinor, currency, locale)
                  : String(revision.reductionAmountMinor / 100)
              })()}
              {revision.reductionAmountMinor === 0 ? ` · ${es ? 'Retiro' : 'Withdrawn'}` : ''}
              {revision.isCurrent ? ` · ${es ? 'vigente' : 'current'}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MonthlyChargeExtensionForm({
  athleteId,
  locale,
  monthlyCharges,
  extensionHistory,
}: {
  athleteId: string
  locale: 'es' | 'en'
  monthlyCharges: MonthlyChargeOption[]
  extensionHistory: ExtensionRevisionHistory[]
}) {
  const es = locale === 'es'
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submitExtension(formData: FormData, withdraw = false) {
    setError(null)
    setSuccess(null)
    const monthlyChargeId = String(formData.get('extensionChargeId') ?? '')
    const selectedCharge = monthlyCharges.find((charge) => charge.id === monthlyChargeId)

    if (!selectedCharge) {
      setError(es ? 'Seleccioná una cuota válida.' : 'Select a valid charge.')
      return
    }

    startTransition(async () => {
      const result = await applyMonthlyChargeExtensionAction({
        monthlyChargeId,
        athleteId,
        year: selectedCharge.year,
        month: selectedCharge.month,
        extendedDueDate: withdraw ? null : String(formData.get('extendedDueDate') ?? ''),
        reason: String(formData.get('extensionReason') ?? ''),
        locale,
      })
      if (!result.success) {
        setError(es ? 'No se pudo aplicar la prórroga.' : 'Could not apply the extension.')
        return
      }
      setSuccess(withdraw
        ? (es ? 'Prórroga retirada.' : 'Extension withdrawn.')
        : (es ? 'Prórroga aplicada.' : 'Extension applied.'))
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{es ? 'Prórroga individual' : 'Individual extension'}</h3>
      <form action={submitExtension} className='grid gap-4 sm:grid-cols-2'>
        <select name='extensionChargeId' required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value=''>{es ? 'Seleccionar cargo' : 'Select charge'}</option>
          {monthlyCharges.map((charge) => (
            <option key={charge.id} value={charge.id}>
              {`${charge.year}-${String(charge.month).padStart(2, '0')} · ${charge.currency} ${(charge.amountDueMinor / 100).toFixed(2)}`}
            </option>
          ))}
        </select>
        <Input name='extendedDueDate' type='date' required />
        <Input name='extensionReason' placeholder={es ? 'Motivo' : 'Reason'} required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        {success && <p role='status' className='text-sm text-muted-foreground'>{success}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? (es ? 'Aplicando…' : 'Applying…') : (es ? 'Aplicar prórroga' : 'Apply extension')}
        </Button>
        <Button type='submit' variant='outline' disabled={isPending} formNoValidate formAction={(formData) => submitExtension(formData, true)}>
          {es ? 'Retirar prórroga' : 'Withdraw extension'}
        </Button>
      </form>
      {extensionHistory.length > 0 && (
        <ul className='text-sm text-muted-foreground'>
          {extensionHistory.map((revision) => (
            <li key={revision.id}>
              {revision.reason} · {revision.extendedDueDate
                ? formatAuditDate(revision.extendedDueDate, locale)
                : (es ? 'Retiro' : 'Withdrawn')}
              {revision.isCurrent ? ` · ${es ? 'vigente' : 'current'}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}


function ManualPaymentSection({
  athleteId,
  locale,
  monthlyCharges,
  paymentHistory,
}: {
  athleteId: string
  locale: 'es' | 'en'
  monthlyCharges: MonthlyChargeOption[]
  paymentHistory: PaymentRevisionHistory[]
}) {
  const es = locale === 'es'
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submitPayment(formData: FormData) {
    setError(null)
    setSuccess(null)
    const monthlyChargeId = String(formData.get('paymentChargeId') ?? '')
    const selectedCharge = monthlyCharges.find((charge) => charge.id === monthlyChargeId)
    const amount = Number(formData.get('paymentAmount'))
    const paymentMethod = String(formData.get('paymentMethod')) as 'cash' | 'bank_transfer'

    if (!selectedCharge || !Number.isFinite(amount) || amount <= 0) {
      setError(es ? 'Completá un pago válido.' : 'Enter a valid payment.')
      return
    }

    startTransition(async () => {
      const result = await registerManualPaymentAction({
        athleteId,
        monthlyChargeId,
        amountMinor: Math.round(amount * 100),
        paymentMethod,
        paidAt: String(formData.get('paidAt') ?? ''),
        locale,
      })
      if (!result.success) {
        setError(es ? 'No se pudo registrar el pago.' : 'Could not register the payment.')
        return
      }
      setSuccess(es ? 'Pago registrado.' : 'Payment registered.')
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{es ? 'Pagos' : 'Payments'}</h3>
      <div className='grid gap-3 sm:grid-cols-2'>
        {monthlyCharges.map((charge) => (
          <div key={charge.id} className='rounded-lg border p-4 text-sm'>
            <div className='font-medium'>{charge.year}-{String(charge.month).padStart(2, '0')}</div>
            <div>{es ? 'Pagado' : 'Paid'}: {formatAuditAmount(charge.paidAmountMinor ?? 0, charge.currency, locale)}</div>
            <div>{es ? 'Restante' : 'Remaining'}: {formatAuditAmount(charge.remainingAmountMinor ?? charge.amountDueMinor, charge.currency, locale)}</div>
          </div>
        ))}
      </div>
      <form action={submitPayment} className='grid gap-4 sm:grid-cols-2'>
        <select name='paymentChargeId' required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value=''>{es ? 'Seleccionar cuota' : 'Select charge'}</option>
          {monthlyCharges.map((charge) => (
            <option key={charge.id} value={charge.id}>
              {charge.year}-{String(charge.month).padStart(2, '0')}
            </option>
          ))}
        </select>
        <Input name='paymentAmount' type='number' min='0.01' step='0.01' placeholder={es ? 'Importe' : 'Amount'} required />
        <select name='paymentMethod' required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value='cash'>{es ? 'Efectivo' : 'Cash'}</option>
          <option value='bank_transfer'>{es ? 'Transferencia bancaria' : 'Bank transfer'}</option>
        </select>
        <Input name='paidAt' type='date' required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        {success && <p role='status' className='text-sm text-muted-foreground'>{success}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? (es ? 'Registrando…' : 'Registering…') : (es ? 'Registrar pago' : 'Register payment')}
        </Button>
      </form>

      {paymentHistory.length > 0 && (
        <div className='space-y-3'>
          <h4 className='text-sm font-medium'>{es ? 'Historial de pagos' : 'Payment history'}</h4>
          <ul className='space-y-3 text-sm text-muted-foreground'>
            {paymentHistory.map((revision) => {
              const currency = monthlyCharges.find((charge) => charge.id === revision.monthlyChargeId)?.currency
              return (
                <li key={revision.revisionId} className='rounded-lg border p-3'>
                  <div>
                    {formatAuditDate(revision.paidAt, locale)} · {currency ? formatAuditAmount(revision.amountMinor, currency, locale) : revision.amountMinor / 100}
                    {' · '}{revision.paymentMethod === 'cash' ? (es ? 'Efectivo' : 'Cash') : (es ? 'Transferencia bancaria' : 'Bank transfer')}
                    {revision.voided ? ` · ${es ? 'Anulado' : 'Voided'}` : ''}
                    {revision.isCurrent ? ` · ${es ? 'vigente' : 'current'}` : ''}
                  </div>
                  {revision.isCurrent && !revision.voided && (
                    <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                      <form
                        action={(formData) => {
                          setError(null)
                          setSuccess(null)
                          startTransition(async () => {
                            const amount = Number(formData.get('correctedPaymentAmount'))
                            const paymentMethod = String(formData.get('correctedPaymentMethod')) as 'cash' | 'bank_transfer'
                            const result = await correctManualPaymentAction({
                              athleteId,
                              monthlyChargeId: revision.monthlyChargeId,
                              paymentId: revision.paymentId,
                              amountMinor: Math.round(amount * 100),
                              paymentMethod,
                              paidAt: String(formData.get('correctedPaidAt') ?? ''),
                              locale,
                            })
                            if (!result.success) {
                              setError(es ? 'No se pudo corregir el pago.' : 'Could not correct the payment.')
                              return
                            }
                            setSuccess(es ? 'Pago corregido.' : 'Payment corrected.')
                          })
                        }}
                        className='grid gap-2'
                      >
                        <Input
                          name='correctedPaymentAmount'
                          type='number'
                          min='0.01'
                          step='0.01'
                          defaultValue={(revision.amountMinor / 100).toFixed(2)}
                          required
                        />
                        <select
                          name='correctedPaymentMethod'
                          defaultValue={revision.paymentMethod}
                          className='h-10 rounded-md border border-input bg-background px-3'
                        >
                          <option value='cash'>{es ? 'Efectivo' : 'Cash'}</option>
                          <option value='bank_transfer'>{es ? 'Transferencia bancaria' : 'Bank transfer'}</option>
                        </select>
                        <Input name='correctedPaidAt' type='date' defaultValue={revision.paidAt} required />
                        <Button type='submit' variant='outline' disabled={isPending}>
                          {es ? 'Corregir pago' : 'Correct payment'}
                        </Button>
                      </form>
                      <form
                        action={() => {
                          setError(null)
                          setSuccess(null)
                          startTransition(async () => {
                            const result = await voidManualPaymentAction({
                              athleteId,
                              monthlyChargeId: revision.monthlyChargeId,
                              paymentId: revision.paymentId,
                              locale,
                            })
                            if (!result.success) {
                              setError(es ? 'No se pudo anular el pago.' : 'Could not void the payment.')
                              return
                            }
                            setSuccess(es ? 'Pago anulado.' : 'Payment voided.')
                          })
                        }}
                      >
                        <Button type='submit' variant='outline' disabled={isPending}>
                          {es ? 'Anular pago' : 'Void payment'}
                        </Button>
                      </form>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

export function AthleteBillingTermsForm({
  athleteId,
  locale,
  model,
  monthlyCharges = [],
  reductionHistory = [],
  extensionHistory = [],
  paymentHistory = [],
}: {
  athleteId: string
  locale: 'es' | 'en'
  model: AthleteBillingTermsFormModel
  monthlyCharges?: MonthlyChargeOption[]
  reductionHistory?: ReductionRevisionHistory[]
  extensionHistory?: ExtensionRevisionHistory[]
  paymentHistory?: PaymentRevisionHistory[]
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
      {monthlyCharges.length > 0 && (
        <div className='space-y-6 border-t pt-6'>
          <MonthlyChargeReductionForm
            athleteId={athleteId}
            locale={locale}
            monthlyCharges={monthlyCharges}
            reductionHistory={reductionHistory}
          />
          <MonthlyChargeExtensionForm
            athleteId={athleteId}
            locale={locale}
            monthlyCharges={monthlyCharges}
            extensionHistory={extensionHistory}
          />
          <ManualPaymentSection
            athleteId={athleteId}
            locale={locale}
            monthlyCharges={monthlyCharges}
            paymentHistory={paymentHistory}
          />
        </div>
      )}
    </section>
  )
}

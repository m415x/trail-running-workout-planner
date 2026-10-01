'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'

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
import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
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

function formatAuditAmount(amountMinor: number, currency: string, presentationLocale: string) {
  return new Intl.NumberFormat(presentationLocale, {
    style: 'currency',
    currency,
  }).format(amountMinor / 100)
}

function formatAuditDate(value: string, presentationLocale: string) {
  return new Intl.DateTimeFormat(presentationLocale, {
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
  const t = useTranslations('Membership.athleteBilling')
  const presentationLocale = resolveApplicationRegionalContext({ language: locale }).presentationLocale
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
      setError(t('reduction.invalidCharge'))
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
        setError(t('reduction.error'))
        return
      }
      setSuccess(withdraw ? t('reduction.withdrawnSuccess') : t('reduction.appliedSuccess'))
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{t('reduction.title')}</h3>
      <form action={submitReduction} className='grid gap-4 sm:grid-cols-2'>
        <select name='reductionChargeId' required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value=''>{t('common.selectCharge')}</option>
          {monthlyCharges.map((charge) => (
            <option key={charge.id} value={charge.id}>
              {`${charge.year}-${String(charge.month).padStart(2, '0')} · ${charge.currency} ${(charge.amountDueMinor / 100).toFixed(2)}`}
            </option>
          ))}
        </select>
        <Input name='reductionAmount' type='number' min='0.01' step='0.01' placeholder={t('common.amount')} required />
        <Input name='reductionReason' placeholder={t('common.reason')} required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        {success && <p role='status' className='text-sm text-muted-foreground'>{success}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? t('common.applying') : t('reduction.apply')}
        </Button>
        <Button type='submit' variant='outline' disabled={isPending} formNoValidate formAction={(formData) => submitReduction(formData, true)}>
          {t('reduction.withdraw')}
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
                  ? formatAuditAmount(revision.reductionAmountMinor, currency, presentationLocale)
                  : String(revision.reductionAmountMinor / 100)
              })()}
              {revision.reductionAmountMinor === 0 ? ` · ${t('common.withdrawn')}` : ''}
              {revision.isCurrent ? ` · ${t('common.current')}` : ''}
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
  const t = useTranslations('Membership.athleteBilling')
  const presentationLocale = resolveApplicationRegionalContext({ language: locale }).presentationLocale
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submitExtension(formData: FormData, withdraw = false) {
    setError(null)
    setSuccess(null)
    const monthlyChargeId = String(formData.get('extensionChargeId') ?? '')
    const selectedCharge = monthlyCharges.find((charge) => charge.id === monthlyChargeId)

    if (!selectedCharge) {
      setError(t('extension.invalidCharge'))
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
        setError(t('extension.error'))
        return
      }
      setSuccess(withdraw ? t('extension.withdrawnSuccess') : t('extension.appliedSuccess'))
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{t('extension.title')}</h3>
      <form action={submitExtension} className='grid gap-4 sm:grid-cols-2'>
        <select name='extensionChargeId' required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value=''>{t('common.selectCharge')}</option>
          {monthlyCharges.map((charge) => (
            <option key={charge.id} value={charge.id}>
              {`${charge.year}-${String(charge.month).padStart(2, '0')} · ${charge.currency} ${(charge.amountDueMinor / 100).toFixed(2)}`}
            </option>
          ))}
        </select>
        <Input name='extendedDueDate' type='date' required />
        <Input name='extensionReason' placeholder={t('common.reason')} required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        {success && <p role='status' className='text-sm text-muted-foreground'>{success}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? t('common.applying') : t('extension.apply')}
        </Button>
        <Button type='submit' variant='outline' disabled={isPending} formNoValidate formAction={(formData) => submitExtension(formData, true)}>
          {t('extension.withdraw')}
        </Button>
      </form>
      {extensionHistory.length > 0 && (
        <ul className='text-sm text-muted-foreground'>
          {extensionHistory.map((revision) => (
            <li key={revision.id}>
              {revision.reason} · {revision.extendedDueDate
                ? formatAuditDate(revision.extendedDueDate, presentationLocale)
                : t('common.withdrawn')}
              {revision.isCurrent ? ` · ${t('common.current')}` : ''}
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
  const t = useTranslations('Membership.athleteBilling')
  const presentationLocale = resolveApplicationRegionalContext({ language: locale }).presentationLocale
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
      setError(t('payments.invalid'))
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
        setError(t('payments.registerError'))
        return
      }
      setSuccess(t('payments.registered'))
    })
  }

  return (
    <section className='space-y-4'>
      <h3 className='font-medium'>{t('payments.title')}</h3>
      <div className='grid gap-3 sm:grid-cols-2'>
        {monthlyCharges.map((charge) => (
          <div key={charge.id} className='rounded-lg border p-4 text-sm'>
            <div className='font-medium'>{charge.year}-{String(charge.month).padStart(2, '0')}</div>
            <div>{t('payments.paid')}: {formatAuditAmount(charge.paidAmountMinor ?? 0, charge.currency, presentationLocale)}</div>
            <div>{t('payments.remaining')}: {formatAuditAmount(charge.remainingAmountMinor ?? charge.amountDueMinor, charge.currency, presentationLocale)}</div>
          </div>
        ))}
      </div>
      <form action={submitPayment} className='grid gap-4 sm:grid-cols-2'>
        <select name='paymentChargeId' aria-label={t('common.selectCharge')} required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value=''>{t('common.selectCharge')}</option>
          {monthlyCharges.map((charge) => (
            <option key={charge.id} value={charge.id}>
              {charge.year}-{String(charge.month).padStart(2, '0')}
            </option>
          ))}
        </select>
        <Input name='paymentAmount' aria-label={t('common.amount')} type='number' min='0.01' step='0.01' placeholder={t('common.amount')} required />
        <select name='paymentMethod' aria-label={t('payments.method')} required className='h-10 rounded-md border border-input bg-background px-3'>
          <option value='cash'>{t('payments.cash')}</option>
          <option value='bank_transfer'>{t('payments.bankTransfer')}</option>
        </select>
        <Input name='paidAt' aria-label={t('payments.date')} type='date' required />
        {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
        {success && <p role='status' className='text-sm text-muted-foreground'>{success}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? t('payments.registering') : t('payments.register')}
        </Button>
      </form>

      {paymentHistory.length > 0 && (
        <div className='space-y-3'>
          <h4 className='text-sm font-medium'>{t('payments.history')}</h4>
          <ul className='space-y-3 text-sm text-muted-foreground'>
            {paymentHistory.map((revision) => {
              const currency = monthlyCharges.find((charge) => charge.id === revision.monthlyChargeId)?.currency
              return (
                <li key={revision.revisionId} className='rounded-lg border p-3'>
                  <div>
                    {formatAuditDate(revision.paidAt, presentationLocale)} · {currency ? formatAuditAmount(revision.amountMinor, currency, presentationLocale) : revision.amountMinor / 100}
                    {' · '}{revision.paymentMethod === 'cash' ? t('payments.cash') : t('payments.bankTransfer')}
                    {revision.voided ? ` · ${t('payments.voided')}` : ''}
                    {revision.isCurrent ? ` · ${t('common.current')}` : ''}
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
                              setError(t('payments.correctError'))
                              return
                            }
                            setSuccess(t('payments.corrected'))
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
                          <option value='cash'>{t('payments.cash')}</option>
                          <option value='bank_transfer'>{t('payments.bankTransfer')}</option>
                        </select>
                        <Input name='correctedPaidAt' type='date' defaultValue={revision.paidAt} required />
                        <Button type='submit' variant='outline' disabled={isPending}>
                          {t('payments.correct')}
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
                              setError(t('payments.voidError'))
                              return
                            }
                            setSuccess(t('payments.voidedSuccess'))
                          })
                        }}
                      >
                        <Button type='submit' variant='outline' disabled={isPending}>
                          {t('payments.void')}
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
  const t = useTranslations('Membership.athleteBilling')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
        setError(t('genericError'))
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
                <Label htmlFor='monthlyAmount'>{t('monthlyAmount')}</Label>
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
                <Label htmlFor='currency'>{t('currency')}</Label>
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
            <Label htmlFor='effectiveFrom'>{t('effectiveFrom')}</Label>
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
          {isPending ? t('saving') : model.submitLabel}
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

'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { registerManualPaymentAction } from '@/app/actions/membership-actions'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
import { prepareQuickPaymentDraft, validateQuickPaymentDraft } from '@/lib/memberships/quick-payment-draft'
import type { QuickPaymentCharge, QuickPaymentSource } from '@/lib/memberships/quick-payment-selection'

type QuickPaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  athleteId: string
  displayName: string
  charges: readonly QuickPaymentCharge[]
  blockedForPriorDebt: boolean
  currentPeriod: { year: number; month: number }
  operationalDate: string
  source: QuickPaymentSource
  locale: 'es' | 'en'
  onRegistered?: () => void
}

function amountInput(minor: number | null) {
  return minor === null ? '' : (minor / 100).toFixed(2)
}

function parseMinor(value: string): number {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return NaN
  const [units, cents = ''] = value.replace(',', '.').split('.')
  return Number(units) * 100 + Number(cents.padEnd(2, '0'))
}

/** Controlled by either Coach entry point; the existing H3 action remains the write authority. */
export function QuickPaymentDialog({
  open, onOpenChange, athleteId, displayName, charges, blockedForPriorDebt,
  currentPeriod, operationalDate, source, locale, onRegistered,
}: QuickPaymentDialogProps) {
  const initial = prepareQuickPaymentDraft({ charges, currentPeriod, operationalDate, source, blockedForPriorDebt })
  const [monthlyChargeId, setMonthlyChargeId] = useState(initial.monthlyChargeId ?? '')
  const [amount, setAmount] = useState(amountInput(initial.amountMinor))
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [paidAt, setPaidAt] = useState(operationalDate)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const pendingRef = useRef(false)
  useEffect(() => {
    if (!open) return
    const draft = prepareQuickPaymentDraft({ charges, currentPeriod, operationalDate, source, blockedForPriorDebt })
    setMonthlyChargeId(draft.monthlyChargeId ?? '')
    setAmount(amountInput(draft.amountMinor))
    setPaymentMethod('cash')
    setPaidAt(draft.paidAt)
    setError(null)
    setSuccess(null)
  // Reset when parent opens an instance; changing a selected period stays local.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const regional = resolveApplicationRegionalContext({ language: locale })
  const isEn = locale === 'en'
  const eligible = charges.filter(charge => Number.isSafeInteger(charge.remainingMinor) && charge.remainingMinor > 0)
  const chosen = eligible.find(charge => charge.id === monthlyChargeId)
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat(regional.presentationLocale, { style: 'currency', currency }).format(minor / 100)

  function changeCharge(id: string) {
    const next = eligible.find(charge => charge.id === id)
    setMonthlyChargeId(next?.id ?? '')
    setAmount(amountInput(next?.remainingMinor ?? null))
    setError(null)
    setSuccess(null)
  }

  function changeOpen(next: boolean) {
    if (pendingRef.current) return
    if (next) {
      const draft = prepareQuickPaymentDraft({ charges, currentPeriod, operationalDate, source, blockedForPriorDebt })
      setMonthlyChargeId(draft.monthlyChargeId ?? '')
      setAmount(amountInput(draft.amountMinor))
      setPaymentMethod('cash')
      setPaidAt(draft.paidAt)
      setError(null)
      setSuccess(null)
    }
    onOpenChange(next)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current) return
    setError(null)
    setSuccess(null)
    const checked = validateQuickPaymentDraft({
      charges, athleteId, monthlyChargeId, amountMinor: parseMinor(amount),
      paymentMethod, paidAt, locale,
    })
    if (!checked.ok) {
      setError(isEn ? 'Check the period, amount, method and payment date.' : 'Revisá el período, importe, método y fecha del pago.')
      return
    }
    pendingRef.current = true
    setIsPending(true)
    try {
      const result = await registerManualPaymentAction(checked.value)
      if (!result.success) {
        setError(isEn ? 'The payment could not be recorded. Refresh the balance and try again.' : 'No se pudo registrar el pago. Actualizá el saldo e intentá nuevamente.')
        return
      }
      setSuccess(isEn ? 'Payment recorded.' : 'Pago registrado.')
      onRegistered?.()
    } catch {
      setError(isEn ? 'The payment could not be recorded.' : 'No se pudo registrar el pago.')
    } finally {
      pendingRef.current = false
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className='max-h-[min(90dvh,44rem)] overflow-y-auto sm:max-w-md' aria-busy={isPending}>
        <DialogHeader>
          <DialogTitle>{isEn ? 'Record membership payment' : 'Registrar pago de membresía'}</DialogTitle>
          <DialogDescription>
            {displayName}. {isEn ? 'Choose a charge and confirm its remaining balance.' : 'Elegí una cuota y confirmá su saldo pendiente.'}
          </DialogDescription>
        </DialogHeader>
        {initial.hasPriorOverdueDebt && (
          <p role='status' className='rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm'>
            {isEn ? 'Attention: this athlete has overdue debt from a previous month.' : 'Atención: este atleta tiene deuda vencida de un mes anterior.'}
          </p>
        )}
        {eligible.length === 0 ? (
          <p role='status' className='text-sm text-muted-foreground'>
            {isEn ? 'No eligible unpaid charges. No payment can be recorded.' : 'No hay cuotas pendientes elegibles. No se puede registrar un pago.'}
          </p>
        ) : (
          <form onSubmit={submit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='quick-payment-period'>{isEn ? 'Period' : 'Período'}</Label>
              <select id='quick-payment-period' value={monthlyChargeId} onChange={event => changeCharge(event.target.value)}
                disabled={isPending} required className='flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm'>
                <option value=''>{isEn ? 'Select a period' : 'Seleccioná un período'}</option>
                {eligible.map(charge => (
                  <option value={charge.id} key={charge.id}>
                    {charge.year}-{String(charge.month).padStart(2, '0')} · {money(charge.remainingMinor, charge.currency)}
                  </option>
                ))}
              </select>
            </div>
            <div className='space-y-1 text-sm'>
              <span>{isEn ? 'Currency' : 'Moneda'}: {chosen?.currency ?? '—'}</span>
              <p>{isEn ? 'Outstanding balance' : 'Saldo pendiente'}: {chosen ? money(chosen.remainingMinor, chosen.currency) : '—'}</p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='quick-payment-amount'>{isEn ? 'Amount' : 'Importe'}</Label>
              <Input id='quick-payment-amount' value={amount} onChange={event => setAmount(event.target.value)}
                inputMode='decimal' type='text' required disabled={isPending || !chosen} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='quick-payment-method'>{isEn ? 'Payment method' : 'Método de pago'}</Label>
              <select id='quick-payment-method' value={paymentMethod}
                onChange={event => setPaymentMethod(event.target.value as 'cash' | 'bank_transfer')}
                disabled={isPending} className='flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm'>
                <option value='cash'>{isEn ? 'Cash' : 'Efectivo'}</option>
                <option value='bank_transfer'>{isEn ? 'Bank transfer' : 'Transferencia bancaria'}</option>
              </select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='quick-payment-date'>{isEn ? 'Payment date' : 'Fecha del pago'}</Label>
              <Input id='quick-payment-date' type='date' value={paidAt}
                onChange={event => setPaidAt(event.target.value)} disabled={isPending} required />
            </div>
            {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
            {success && <p role='status' className='text-sm'>{success}</p>}
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => changeOpen(false)} disabled={isPending}>
                {isEn ? 'Cancel' : 'Cancelar'}
              </Button>
              <Button type='submit' disabled={isPending || !chosen}>
                {isPending ? (isEn ? 'Recording…' : 'Registrando…') : (isEn ? 'Record payment' : 'Registrar pago')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useTransition } from 'react'

import { configureTeamEconomicPolicyAction } from '@/app/actions/membership-actions'
import { createTeamEconomicPolicyFormController } from '@/lib/memberships/membership-policy-form-controller'
import {
  getTeamEconomicPolicyFormFeedback,
  type MembershipLocale,
} from '@/lib/memberships/membership-policy-form-feedback'
import { Button } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { Input } from '@ui/input'
import { Label } from '@ui/label'

type TeamEconomicPolicyFormModel = {
  mode: 'initial' | 'replacement'
  title: string
  submitLabel: string
  monthlyAmountLabel: string
  currencyLabel: string
  dueDayLabel: string
  effectiveFromLabel: string
  effectiveFromHelp: string
  monthlyAmountMinor: number | null
  currency: string
  ordinaryDueDay: number
}

export function TeamEconomicPolicyForm({
  model,
  locale,
}: {
  model: TeamEconomicPolicyFormModel
  locale: MembershipLocale
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const feedback = getTeamEconomicPolicyFormFeedback(locale)
  const controller = createTeamEconomicPolicyFormController({
    submitAction: configureTeamEconomicPolicyAction,
  })
  const monthlyAmount = model.monthlyAmountMinor == null
    ? undefined
    : model.monthlyAmountMinor / 100

  function handleSubmit(formData: FormData) {
    setError(null)

    startTransition(async () => {
      const result = await controller.submit({
        monthlyAmount: String(formData.get('monthlyAmount') ?? ''),
        currency: String(formData.get('currency') ?? ''),
        ordinaryDueDay: String(formData.get('ordinaryDueDay') ?? ''),
        effectiveFrom: String(formData.get('effectiveFrom') ?? ''),
      })

      if (!result.success) {
        setError(feedback.genericError)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{model.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='monthlyAmount'>{model.monthlyAmountLabel}</Label>
              <Input
                id='monthlyAmount'
                name='monthlyAmount'
                type='number'
                min='1'
                step='1'
                defaultValue={monthlyAmount}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='currency'>{model.currencyLabel}</Label>
              <Input
                id='currency'
                name='currency'
                value={model.currency}
                readOnly
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='ordinaryDueDay'>{model.dueDayLabel}</Label>
              <Input
                id='ordinaryDueDay'
                name='ordinaryDueDay'
                type='number'
                min='1'
                max='31'
                defaultValue={model.ordinaryDueDay}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='effectiveFrom'>{model.effectiveFromLabel}</Label>
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
            {isPending ? feedback.pendingLabel : model.submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

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
}: {
  model: TeamEconomicPolicyFormModel
}) {
  const monthlyAmount = model.monthlyAmountMinor == null
    ? undefined
    : model.monthlyAmountMinor / 100

  return (
    <Card>
      <CardHeader>
        <CardTitle>{model.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className='space-y-4'>
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

          <Button type='submit'>{model.submitLabel}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

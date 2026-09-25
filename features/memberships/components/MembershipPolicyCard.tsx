import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

type MembershipPolicyCardModel = {
  title: string
  policyTitle: string
  monthlyAmountLabel: string
  monthlyAmount: string | null
  currencyLabel: string
  currency: string | null
  dueDayLabel: string
  dueDay: string | null
  effectiveFromLabel: string
  effectiveFrom: string | null
  emptyState: string
}

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-sm text-muted-foreground'>{label}</dt>
      <dd className='mt-1 font-medium'>{value}</dd>
    </div>
  )
}

export function MembershipPolicyCard({
  model,
}: {
  model: MembershipPolicyCardModel
}) {
  const hasPolicy = (
    model.monthlyAmount !== null
    && model.currency !== null
    && model.dueDay !== null
    && model.effectiveFrom !== null
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{model.policyTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasPolicy ? (
          <p className='text-sm text-muted-foreground'>{model.emptyState}</p>
        ) : (
          <dl className='grid gap-4 sm:grid-cols-2'>
            <PolicyItem label={model.monthlyAmountLabel} value={model.monthlyAmount!} />
            <PolicyItem label={model.currencyLabel} value={model.currency!} />
            <PolicyItem label={model.dueDayLabel} value={model.dueDay!} />
            <PolicyItem label={model.effectiveFromLabel} value={model.effectiveFrom!} />
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

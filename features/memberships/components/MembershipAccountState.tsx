import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@ui/accordion'
import { Badge } from '@ui/badge'
import type { deriveMembershipAccountState, deriveMembershipDebtExperience, explainMonthlyChargeEconomics } from '@/lib/memberships/billing'

type AccountState = ReturnType<typeof deriveMembershipAccountState>
type EconomicHistory = Array<ReturnType<typeof explainMonthlyChargeEconomics>>
type DebtExperience = ReturnType<typeof deriveMembershipDebtExperience>

export function MembershipAccountState({
  locale,
  labels,
  accountState,
  economicHistory,
  debtExperience,
}: {
  locale: 'es' | 'en'
  labels: {
    title: string
    totalBalance: string
    period: string
    status: string
    amountDue: string
    paid: string
    remaining: string
    dueDate: string
    history: string
    condition: string
    globalException: string
    reduction: string
    extension: string
    payments: string
    result: string
    settled: string
    pending: string
    overdue: string
    noHistory: string
    priorDebtBlocked: string
  }
  accountState: AccountState
  economicHistory: EconomicHistory
  debtExperience: DebtExperience
}) {
  const formatMoney = (minor: number, currency: string) => {
    const formatted = new Intl.NumberFormat(locale === 'es' ? 'es-AR' : 'en-US', {
      style: 'currency',
      currency,
    }).format(minor / 100)

    return `${formatted} ${currency}`
  }

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`))

  const statusLabel = (status: 'settled' | 'pending' | 'overdue') =>
    status === 'settled'
      ? labels.settled
      : status === 'pending'
        ? labels.pending
        : labels.overdue

  return (
    <section className='space-y-4'>
      {debtExperience.blockedForPriorDebt && (
        <p
          role='alert'
          data-membership-blocked='true'
          className='rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'
        >
          {labels.priorDebtBlocked}
        </p>
      )}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h3 className='font-medium'>{labels.title}</h3>
        <div className='flex flex-wrap gap-2'>
          {accountState.balanceByCurrency.map((balance) => (
            <Badge key={balance.currency} variant='outline'>
              {labels.totalBalance}: {formatMoney(balance.remainingMinor, balance.currency)}
            </Badge>
          ))}
        </div>
      </div>

      <div className='space-y-3'>
        {accountState.charges.map((charge) => {
          const detail = economicHistory.find((item) => item.charge.monthlyChargeId === charge.id)

          return (
            <div key={charge.id} className='rounded-lg border p-4'>
              <dl className='grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6'>
                <div>
                  <dt className='text-muted-foreground'>{labels.period}</dt>
                  <dd className='mt-1 font-medium'>
                    {detail ? `${detail.charge.year}-${String(detail.charge.month).padStart(2, '0')}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{labels.status}</dt>
                  <dd className='mt-1'><Badge variant='secondary'>{statusLabel(charge.status)}</Badge></dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{labels.amountDue}</dt>
                  <dd className='mt-1 font-medium'>{formatMoney(charge.amountDueMinor, charge.currency)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{labels.paid}</dt>
                  <dd className='mt-1 font-medium'>{formatMoney(charge.paidMinor, charge.currency)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{labels.remaining}</dt>
                  <dd className='mt-1 font-medium'>{formatMoney(charge.remainingMinor, charge.currency)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{labels.dueDate}</dt>
                  <dd className='mt-1 font-medium'>{formatDate(charge.effectiveDueDate)}</dd>
                </div>
              </dl>

              {detail && (
                <Accordion className='mt-3' defaultValue={[`history-${charge.id}`]}>
                  <AccordionItem value={`history-${charge.id}`} className='border-0'>
                    <AccordionTrigger className='py-2 text-sm hover:no-underline'>
                      {labels.history}
                    </AccordionTrigger>
                    <AccordionContent className='space-y-3 pt-1 text-sm'>
                      <div>
                        <p className='font-medium'>{labels.condition}</p>
                        <p className='text-muted-foreground'>
                          {formatMoney(detail.condition.monthlyAmountMinor, detail.condition.currency)}
                        </p>
                      </div>

                      <div>
                        <p className='font-medium'>{labels.globalException}</p>
                        {detail.globalDueDateHistory.length === 0
                          ? <p className='text-muted-foreground'>{labels.noHistory}</p>
                          : detail.globalDueDateHistory.map((item) => (
                              <p key={item.id} className='text-muted-foreground'>
                                {formatDate(item.dueDate)} · {item.reason}
                              </p>
                            ))}
                      </div>

                      <div>
                        <p className='font-medium'>{labels.reduction}</p>
                        {detail.reductionHistory.length === 0
                          ? <p className='text-muted-foreground'>{labels.noHistory}</p>
                          : detail.reductionHistory.map((item) => (
                              <p key={item.id} className='text-muted-foreground'>
                                {formatMoney(item.reductionAmountMinor, detail.charge.currency)} · {item.reason}
                              </p>
                            ))}
                      </div>

                      <div>
                        <p className='font-medium'>{labels.extension}</p>
                        {detail.extensionHistory.length === 0
                          ? <p className='text-muted-foreground'>{labels.noHistory}</p>
                          : detail.extensionHistory.map((item) => (
                              <p key={item.id} className='text-muted-foreground'>
                                {item.extendedDueDate ? formatDate(item.extendedDueDate) : '—'} · {item.reason}
                              </p>
                            ))}
                      </div>

                      <div>
                        <p className='font-medium'>{labels.payments}</p>
                        {detail.paymentHistory.length === 0
                          ? <p className='text-muted-foreground'>{labels.noHistory}</p>
                          : detail.paymentHistory.map((item) => (
                              <p key={item.revisionId} className='text-muted-foreground'>
                                {formatDate(item.paidAt)} · {formatMoney(item.amountMinor, detail.charge.currency)} · {item.state}
                              </p>
                            ))}
                      </div>

                      <div>
                        <p className='font-medium'>{labels.result}</p>
                        <p className='text-muted-foreground'>
                          {statusLabel(detail.result.status)} · {formatMoney(detail.result.remainingMinor, detail.result.currency)}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

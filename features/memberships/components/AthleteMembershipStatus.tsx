import type { deriveMembershipDebtExperience } from '@/lib/memberships/billing'

type DebtExperience = ReturnType<typeof deriveMembershipDebtExperience>

const copy = {
  es: {
    title: 'Estado de membresía',
    overdue: 'Cuota vencida',
    pending: 'Pendiente',
    settled: 'Al día',
    blocked: 'Tu acceso está bloqueado por deuda vencida de un mes anterior.',
    period: 'Período',
    remaining: 'Saldo',
  },
  en: {
    title: 'Membership status',
    overdue: 'Overdue',
    pending: 'Pending',
    settled: 'Up to date',
    blocked: 'Your access is blocked because of overdue debt from a previous month.',
    period: 'Period',
    remaining: 'Balance',
  },
} as const

function statusClass(status: 'settled' | 'pending' | 'overdue') {
  if (status === 'overdue') {
    return 'border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'
  }

  if (status === 'pending') {
    return 'border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100'
  }

  return 'border-border bg-background text-foreground'
}

export function AthleteMembershipStatus({
  locale,
  debtExperience,
}: {
  locale: 'es' | 'en'
  debtExperience: DebtExperience
}) {
  const labels = copy[locale]
  const numberLocale = locale === 'es' ? 'es-AR' : 'en-US'

  const formatMoney = (minor: number, currency: string) =>
    `${new Intl.NumberFormat(numberLocale, {
      style: 'currency',
      currency,
    }).format(minor / 100)} ${currency}`

  const statusLabel = (status: 'settled' | 'pending' | 'overdue') =>
    status === 'overdue'
      ? labels.overdue
      : status === 'pending'
        ? labels.pending
        : labels.settled

  return (
    <section className='space-y-3'>
      <h2 className='text-base font-semibold'>{labels.title}</h2>

      {debtExperience.blockedForPriorDebt && (
        <p
          role='alert'
          className='rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'
        >
          {labels.blocked}
        </p>
      )}

      <div className='space-y-2'>
        {debtExperience.charges.map((charge) => (
          <article
            key={charge.id}
            data-status={charge.status}
            className={`rounded-lg border p-3 ${statusClass(charge.status)}`}
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-sm font-semibold'>{statusLabel(charge.status)}</p>
                <p className='text-xs opacity-80'>
                  {labels.period}: {charge.year}-{String(charge.month).padStart(2, '0')}
                </p>
              </div>
              <p className='text-sm font-medium'>
                {labels.remaining}: {formatMoney(charge.remainingMinor, charge.currency)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

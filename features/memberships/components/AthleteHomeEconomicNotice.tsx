import type { AthleteEconomicVisualState } from '@/lib/memberships/athlete-home-economic-visual'
import { Link } from '@/i18n/routing'

const copy = {
  es: {
    current_settled: 'Cuota al día.',
    current_pending: 'Cuota pendiente. Revisá el vencimiento en tu estado de cuenta.',
    current_overdue: 'Cuota vencida. Consultá el saldo en tu estado de cuenta.',
    prior_overdue_debt: 'Tenés deuda vencida de un mes anterior. Contactá a tu entrenador para regularizarla.',
    account_unknown: 'No hay información económica disponible. Consultá tu estado de cuenta.',
    link: 'Ver estado de cuenta',
    title: 'Estado económico',
  },
  en: {
    current_settled: 'Membership payment up to date.',
    current_pending: 'Membership payment pending. Check your account for the due date.',
    current_overdue: 'Overdue membership payment. Check your account for the balance.',
    prior_overdue_debt: 'You have overdue debt from a previous month. Contact your coach to resolve it.',
    account_unknown: 'Membership information unavailable. Check your account status.',
    link: 'View account status',
    title: 'Membership account',
  },
} as const

const toneClass: Record<AthleteEconomicVisualState['tone'], string> = {
  normal: 'border-border bg-background text-foreground',
  warning: 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-100',
  danger: 'border-red-400 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/35 dark:text-red-100',
  neutral: 'border-border bg-muted/50 text-foreground',
}

/**
 * Text is authoritative. Color only reinforces the existing H4/H5 snapshot.
 * Prior debt is a disclosure, not an access guard (reserved for KAN-298).
 */
export function AthleteHomeEconomicNotice({
  locale,
  state,
}: {
  locale: 'es' | 'en'
  state: AthleteEconomicVisualState
}) {
  const labels = copy[locale]
  const urgent = state.tone === 'danger'

  return (
    <aside
      aria-label={labels.title}
      role={urgent ? 'alert' : 'status'}
      data-economic-tone={state.tone}
      className={`min-w-0 rounded-lg border p-3 text-sm ${toneClass[state.tone]}`}
    >
      <p className='font-medium'>{labels[state.message]}</p>
      <Link
        href='/profile'
        locale={locale}
        className='mt-2 inline-flex min-h-10 items-center rounded-md underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
      >
        {labels.link}
      </Link>
    </aside>
  )
}

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type {
  AthletePlanRealComparison,
  PlanRealMetricOperand,
} from '@/types'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'
import { cn } from '@/lib/utils'

interface PlanRealComparisonProps {
  comparison: AthletePlanRealComparison
  locale: string
  weekHref: string
  monthHref: string
}

const stateStyles = {
  matched: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  deviation: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  known_not_completed: 'border-destructive/40 text-destructive',
  unplanned_realized: 'border-violet-500/40 text-violet-700 dark:text-violet-300',
  unknown: 'text-muted-foreground',
} as const

function formatOperand(
  operand: PlanRealMetricOperand,
  locale: string,
  unknownLabel: string,
) {
  if (operand.state === 'unknown') return unknownLabel
  const value = typeof operand.value === 'number'
    ? new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
        maximumFractionDigits: 2,
      }).format(operand.value)
    : operand.value
  return `${value} ${operand.unit}`
}

function formatDelta(value: number | null, unit: string | null, locale: string) {
  if (value === null || unit === null) return '—'
  const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(value)
  return `${formatted} ${unit}`
}

export function PlanRealComparison({
  comparison,
  locale,
  weekHref,
  monthHref,
}: PlanRealComparisonProps) {
  const t = useTranslations('PlanRealComparison')
  const plannedItems = comparison.items.filter(item => item.kind === 'planned_session')
  const unplannedItems = comparison.items.filter(item => item.kind === 'unplanned_realized')

  return (
    <Card>
      <CardHeader className='gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>{t('description')}</p>
        </div>
        <div className='flex gap-2'>
          <Link
            href={weekHref}
            className={buttonVariants({
              variant: comparison.window.kind === 'week' ? 'default' : 'outline',
              size: 'sm',
            })}
          >
            {t('window.week')}
          </Link>
          <Link
            href={monthHref}
            className={buttonVariants({
              variant: comparison.window.kind === 'month' ? 'default' : 'outline',
              size: 'sm',
            })}
          >
            {t('window.month')}
          </Link>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {comparison.planningLimitations.length > 0 && (
          <div role='alert' className='rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm'>
            {t('planningLimitations', { count: comparison.planningLimitations.length })}
          </div>
        )}

        {plannedItems.length === 0 && unplannedItems.length === 0 ? (
          <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
            {t('empty')}
          </p>
        ) : (
          <div className='space-y-3'>
            {plannedItems.map(item => (
              <article key={item.sessionId} className='rounded-lg border p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <p className='font-medium'>{item.sessionTitle}</p>
                    <p className='text-sm text-muted-foreground'>{item.date}</p>
                  </div>
                  <Badge variant='outline' className={stateStyles[item.state]}>
                    {t(`state.${item.state}`)}
                  </Badge>
                </div>

                <div className='mt-4 grid gap-2 md:grid-cols-2'>
                  {item.metrics.map(metric => {
                    const evaluation = metric.evaluation
                    const unit = evaluation.planned.unit ?? evaluation.realized.unit
                    return (
                      <div key={metric.name} className='rounded-md bg-muted/40 p-3 text-sm'>
                        <div className='flex items-center justify-between gap-2'>
                          <p className='font-medium'>{t(`metric.${metric.name}`)}</p>
                          <span className={cn(
                            'text-xs',
                            evaluation.state === 'deviation' && 'text-amber-700 dark:text-amber-300',
                            evaluation.state === 'not_evaluated' && 'text-muted-foreground',
                          )}>
                            {t(`evaluation.${evaluation.state}`)}
                          </span>
                        </div>
                        <dl className='mt-2 grid grid-cols-3 gap-2 text-xs'>
                          <div>
                            <dt className='text-muted-foreground'>{t('planned')}</dt>
                            <dd className='mt-0.5 font-medium'>
                              {formatOperand(evaluation.planned, locale, t('unknown'))}
                            </dd>
                          </div>
                          <div>
                            <dt className='text-muted-foreground'>{t('realized')}</dt>
                            <dd className='mt-0.5 font-medium'>
                              {formatOperand(evaluation.realized, locale, t('unknown'))}
                            </dd>
                          </div>
                          <div>
                            <dt className='text-muted-foreground'>{t('difference')}</dt>
                            <dd className='mt-0.5 font-medium'>
                              {formatDelta(evaluation.absoluteDelta, unit, locale)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}

            {unplannedItems.map(item => (
              <article key={item.realized.recordId} className='rounded-lg border border-violet-500/30 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <p className='font-medium'>{t('unplannedTitle')}</p>
                    <p className='text-sm text-muted-foreground'>{item.date}</p>
                  </div>
                  <Badge variant='outline' className={stateStyles.unplanned_realized}>
                    {t('state.unplanned_realized')}
                  </Badge>
                </div>
                <p className='mt-2 text-sm text-muted-foreground'>{t('unplannedDescription')}</p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

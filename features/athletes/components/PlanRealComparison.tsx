'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type {
  AthletePlanRealComparison,
  PlanRealMetricOperand,
  PlanRealMetricUnit,
} from '@/types'
import { cn } from '@/lib/utils'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@ui/accordion'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card } from '@ui/card'

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

function formatUnit(unit: PlanRealMetricUnit, locale: string) {
  const labels: Record<PlanRealMetricUnit, string> = locale === 'en'
    ? {
        km: 'km',
        min: 'min',
        m: 'm',
        bpm: 'bpm',
        rpe: 'RPE',
        hr_zone: 'HR zone',
        reference_percent: '% of reference',
      }
    : {
        km: 'km',
        min: 'min',
        m: 'm',
        bpm: 'ppm',
        rpe: 'RPE',
        hr_zone: 'Zona FC',
        reference_percent: '% de referencia',
      }

  return labels[unit]
}

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
  return `${value} ${formatUnit(operand.unit, locale)}`
}

function formatDelta(value: number | null, unit: PlanRealMetricUnit | null, locale: string) {
  if (value === null || unit === null) return '—'
  const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(value)
  return `${formatted} ${formatUnit(unit, locale)}`
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
  const stateCounts = {
    matched: plannedItems.filter(item => item.state === 'matched').length,
    deviation: plannedItems.filter(item => item.state === 'deviation').length,
    known_not_completed: plannedItems.filter(item => item.state === 'known_not_completed').length,
    unknown: plannedItems.filter(item => item.state === 'unknown').length,
  }

  return (
    <Card className='py-0'>
      <Accordion className='w-full'>
        <AccordionItem value='plan-real-comparison' className='border-none'>
          <AccordionTrigger className='px-6 py-5 hover:no-underline'>
            <div className='min-w-0 space-y-3 pr-4'>
              <div>
                <h3 className='text-base font-semibold'>{t('title')}</h3>
                <p className='mt-1 text-sm font-normal text-muted-foreground'>{t('description')}</p>
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {(['matched', 'deviation', 'known_not_completed', 'unknown'] as const).map(state => (
                  stateCounts[state] > 0 && (
                    <Badge key={state} variant='outline' className={cn('font-normal', stateStyles[state])}>
                      {stateCounts[state]} · {t(`state.${state}`)}
                    </Badge>
                  )
                ))}
                {unplannedItems.length > 0 && (
                  <Badge variant='outline' className={cn('font-normal', stateStyles.unplanned_realized)}>
                    {unplannedItems.length} · {t('state.unplanned_realized')}
                  </Badge>
                )}
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className='px-6 pb-6 [&_a]:no-underline'>
            <div className='mb-4 flex justify-end gap-2'>
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

            <div className='space-y-4'>
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}

import { Activity, CircleHelp, Gauge, TrendingDown, TrendingUp, Minus } from 'lucide-react'

import type {
  AthleteAdherence,
  AthleteAdherenceTrend,
  TrainingComparisonMetricName,
} from '@/types'
import { Badge } from '@ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface AdherenceSummaryProps {
  adherence: AthleteAdherence
  trend: AthleteAdherenceTrend
  locale: string
}

const metricLabels: Record<'es' | 'en', Record<TrainingComparisonMetricName, string>> = {
  es: {
    distanceKm: 'Distancia',
    durationMin: 'Duración',
    elevationGainM: 'D+',
    intensity: 'Intensidad / esfuerzo',
  },
  en: {
    distanceKm: 'Distance',
    durationMin: 'Duration',
    elevationGainM: 'Elevation gain',
    intensity: 'Intensity / effort',
  },
}

function percent(value: number | null, locale: 'es' | 'en') {
  if (value === null) return '—'
  return `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    maximumFractionDigits: 0,
  }).format(value)}%`
}

export function AdherenceSummary({ adherence, trend, locale }: AdherenceSummaryProps) {
  const language: 'es' | 'en' = locale === 'en' ? 'en' : 'es'
  const labels = language === 'en'
    ? {
        title: 'Plan adherence',
        description: 'Confirmed adherence to the applicable plan, shown together with evidence coverage.',
        frequency: 'Frequency adherence',
        insufficient: 'Insufficient evidence',
        coverage: 'Evidence coverage',
        denominator: 'Confirmed outcomes',
        unknown: 'Unknown planned sessions',
        extra: 'Unplanned realized sessions',
        dimensions: 'Comparable dimensions',
        trend: '4-week trend',
        improving: 'Improving',
        stable: 'Stable',
        declining: 'Declining',
        trendInsufficient: 'Not enough comparable weeks',
        rule: 'Rule',
      }
    : {
        title: 'Adherencia al plan',
        description: 'Cumplimiento confirmado del plan aplicable, mostrado junto con la cobertura de evidencia.',
        frequency: 'Adherencia por frecuencia',
        insufficient: 'Evidencia insuficiente',
        coverage: 'Cobertura de evidencia',
        denominator: 'Resultados confirmados',
        unknown: 'Sesiones planificadas desconocidas',
        extra: 'Entrenamientos extra',
        dimensions: 'Dimensiones comparables',
        trend: 'Tendencia de 4 semanas',
        improving: 'Mejorando',
        stable: 'Estable',
        declining: 'Descendiendo',
        trendInsufficient: 'No hay suficientes semanas comparables',
        rule: 'Regla',
      }

  const trendIcon = trend.state === 'available'
    ? trend.direction === 'improving'
      ? <TrendingUp className='size-4' />
      : trend.direction === 'declining'
        ? <TrendingDown className='size-4' />
        : <Minus className='size-4' />
    : <CircleHelp className='size-4' />

  const trendLabel = trend.state === 'available'
    ? labels[trend.direction]
    : labels.trendInsufficient

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Activity className='size-5' />
              {labels.title}
            </CardTitle>
            <p className='mt-1 text-sm text-muted-foreground'>{labels.description}</p>
          </div>
          <Badge variant='outline'>
            {labels.rule}: {adherence.rule.ruleId} v{adherence.rule.version}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-4'>
          <div className='rounded-lg border p-4 md:col-span-1'>
            <p className='text-xs text-muted-foreground'>{labels.frequency}</p>
            <p className='mt-1 text-3xl font-bold'>
              {adherence.frequency.state === 'available'
                ? percent(adherence.frequency.adherencePercent, language)
                : '—'}
            </p>
            {adherence.frequency.state === 'insufficient_data' && (
              <p className='mt-1 text-xs text-amber-700 dark:text-amber-300'>{labels.insufficient}</p>
            )}
          </div>

          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>{labels.coverage}</p>
            <p className='mt-1 text-xl font-semibold'>{percent(adherence.coverage.coveragePercent, language)}</p>
          </div>

          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>{labels.denominator}</p>
            <p className='mt-1 text-xl font-semibold'>
              {adherence.frequency.counts.denominator} / {adherence.coverage.eligiblePlannedSessions}
            </p>
          </div>

          <div className='rounded-lg border p-4'>
            <p className='flex items-center gap-1 text-xs text-muted-foreground'>
              {trendIcon}
              {labels.trend}
            </p>
            <p className='mt-1 text-sm font-semibold'>{trendLabel}</p>
            {trend.state === 'available' && (
              <p className='text-xs text-muted-foreground'>
                {trend.changePercentagePoints > 0 ? '+' : ''}{trend.changePercentagePoints.toFixed(0)} pp
              </p>
            )}
          </div>
        </div>

        <div className='flex flex-wrap gap-2 text-xs'>
          <Badge variant='outline'>{labels.unknown}: {adherence.coverage.unknownSessions}</Badge>
          <Badge variant='outline'>{labels.extra}: {adherence.coverage.unplannedRealizedSessions}</Badge>
        </div>

        <div>
          <p className='mb-2 flex items-center gap-2 text-sm font-medium'>
            <Gauge className='size-4' />
            {labels.dimensions}
          </p>
          <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
            {adherence.dimensions.map(dimension => (
              <div key={dimension.metric} className='rounded-md bg-muted/40 p-3'>
                <p className='text-xs text-muted-foreground'>{metricLabels[language][dimension.metric]}</p>
                <p className='mt-1 font-semibold'>
                  {dimension.state === 'available'
                    ? percent(dimension.adherencePercent, language)
                    : labels.insufficient}
                </p>
                <p className='mt-1 text-[11px] text-muted-foreground'>
                  {dimension.counts.comparableSessions} / {adherence.coverage.eligiblePlannedSessions}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

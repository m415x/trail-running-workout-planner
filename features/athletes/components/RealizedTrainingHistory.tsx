import { Activity, Clock3, Gauge, HeartPulse, Mountain, Route } from 'lucide-react'

import { Badge } from '@ui/badge'
import type {
  RealizedMetric,
  RealizedMetricUnknownReason,
  RealizedTrainingRecord,
} from '@/types/training/readiness.types'

interface RealizedTrainingHistoryProps {
  records: readonly RealizedTrainingRecord[]
  locale: string
}

const copy = {
  es: {
    empty: 'Todavía no hay entrenamientos realizados registrados para este atleta.',
    completed: 'Completado',
    partial: 'Parcial',
    missed: 'No realizado',
    pending: 'Pendiente',
    rest: 'Descanso',
    manual: 'Carga manual',
    imported: 'Importado',
    linked: 'Vinculado a sesión planificada',
    free: 'Entrenamiento libre',
    performedAt: 'Realizado',
    loggedAt: 'Registrado',
    distance: 'Distancia',
    duration: 'Duración',
    elevation: 'D+',
    heartRate: 'FC media',
    rpe: 'RPE',
    unknown: 'Sin dato',
    sourceActivity: 'ID de origen',
    limitations: 'Limitaciones de los datos',
    unknownReasons: {
      not_recorded: 'no registrado',
      legacy_zero_ambiguous: 'cero legacy ambiguo',
      invalid_value: 'valor inválido',
    } satisfies Record<RealizedMetricUnknownReason, string>,
  },
  en: {
    empty: 'No realized training has been recorded for this athlete yet.',
    completed: 'Completed',
    partial: 'Partial',
    missed: 'Not performed',
    pending: 'Pending',
    rest: 'Rest',
    manual: 'Manual entry',
    imported: 'Imported',
    linked: 'Linked to planned session',
    free: 'Free workout',
    performedAt: 'Performed',
    loggedAt: 'Logged',
    distance: 'Distance',
    duration: 'Duration',
    elevation: 'D+',
    heartRate: 'Avg HR',
    rpe: 'RPE',
    unknown: 'Unknown',
    sourceActivity: 'Source ID',
    limitations: 'Data limitations',
    unknownReasons: {
      not_recorded: 'not recorded',
      legacy_zero_ambiguous: 'ambiguous legacy zero',
      invalid_value: 'invalid value',
    } satisfies Record<RealizedMetricUnknownReason, string>,
  },
} as const

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-AR', { timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function metricValue(
  metric: RealizedMetric,
  unit: string,
  locale: 'es' | 'en',
) {
  const labels = copy[locale]
  if (metric.state === 'unknown') {
    return `${labels.unknown} · ${labels.unknownReasons[metric.reason]}`
  }

  return `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    maximumFractionDigits: 2,
  }).format(metric.value)}${unit}`
}

export function RealizedTrainingHistory({ records, locale }: RealizedTrainingHistoryProps) {
  const language: 'es' | 'en' = locale === 'en' ? 'en' : 'es'
  const labels = copy[language]

  if (records.length === 0) {
    return (
      <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
        {labels.empty}
      </p>
    )
  }

  return (
    <div className='space-y-3'>
      {records.map((record) => {
        const statusLabel = labels[record.status]

        return (
          <article key={record.id} className='rounded-lg border p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='font-medium'>{formatDate(record.date, language)}</p>
                  <Badge variant={record.status === 'completed' ? 'secondary' : 'outline'}>
                    {statusLabel}
                  </Badge>
                  <Badge variant='outline'>
                    {record.sessionId ? labels.linked : labels.free}
                  </Badge>
                </div>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {record.provenance.source === 'manual' ? labels.manual : labels.imported}
                </p>
              </div>

              <dl className='grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:text-right'>
                <div>
                  <dt className='text-muted-foreground'>{labels.performedAt}</dt>
                  <dd className='font-medium'>{formatDateTime(record.performedAt, language)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{labels.loggedAt}</dt>
                  <dd className='font-medium'>{formatDateTime(record.provenance.loggedAt, language)}</dd>
                </div>
              </dl>
            </div>

            <dl className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
              <Metric icon={<Route className='size-4' />} label={labels.distance} value={metricValue(record.metrics.distanceKm, ' km', language)} />
              <Metric icon={<Clock3 className='size-4' />} label={labels.duration} value={metricValue(record.metrics.durationMin, ' min', language)} />
              <Metric icon={<Mountain className='size-4' />} label={labels.elevation} value={metricValue(record.metrics.elevationGainM, ' m', language)} />
              <Metric icon={<HeartPulse className='size-4' />} label={labels.heartRate} value={metricValue(record.metrics.avgHrBpm, ' bpm', language)} />
              <Metric icon={<Gauge className='size-4' />} label={labels.rpe} value={metricValue(record.metrics.rpe, '', language)} />
            </dl>

            {(record.provenance.sourceActivityId || record.limitations.length > 0) && (
              <div className='mt-4 border-t pt-3 text-xs text-muted-foreground'>
                {record.provenance.sourceActivityId && (
                  <p>{labels.sourceActivity}: {record.provenance.sourceActivityId}</p>
                )}
                {record.limitations.length > 0 && (
                  <p className='mt-1'>{labels.limitations}: {record.limitations.join(' · ')}</p>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className='rounded-md bg-muted/40 p-3'>
      <dt className='flex items-center gap-2 text-xs text-muted-foreground'>
        {icon}
        {label}
      </dt>
      <dd className='mt-1 text-sm font-medium'>{value}</dd>
    </div>
  )
}

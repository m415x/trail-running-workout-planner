import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Clock3, Gauge, HeartPulse, Mountain, Route } from 'lucide-react'

import { formatDateTime24Hour } from '@/lib/date-time/format-date-time-24-hour'

import { Badge } from '@ui/badge'
import type { RealizedTrainingCorrectionRecord } from '@/types/training/realized-training-correction.types'
import type {
  RealizedMetric,
  RealizedTrainingRecord,
} from '@/types/training/readiness.types'

interface RealizedTrainingHistoryProps {
  records: readonly RealizedTrainingRecord[]
  correctionsByWorkoutLogId?: Readonly<Record<string, readonly RealizedTrainingCorrectionRecord[]>>
  locale: string
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`))
}

function metricValue(
  metric: RealizedMetric,
  unit: string,
  locale: 'es' | 'en',
  translate: (key: string) => string,
) {
  if (metric.state === 'unknown') {
    return `${translate('unknown')} · ${translate(`unknownReasons.${metric.reason}`)}`
  }

  return `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    maximumFractionDigits: 2,
  }).format(metric.value)}${unit}`
}

function durationValue(
  metric: RealizedMetric,
  translate: (key: string) => string,
) {
  if (metric.state === 'unknown') {
    return `${translate('unknown')} · ${translate(`unknownReasons.${metric.reason}`)}`
  }

  const totalSeconds = Math.round(metric.value * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (hours > 0) parts.push(`${hours} ${translate('durationUnits.hours')}`)
  if (minutes > 0 || hours > 0) parts.push(`${minutes} ${translate('durationUnits.minutes')}`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ${translate('durationUnits.seconds')}`)

  return parts.join(' ')
}

function correctionChangedFields(correction: RealizedTrainingCorrectionRecord) {
  const changed: Array<
    | 'sessionId'
    | 'workoutId'
    | 'date'
    | 'performedAt'
    | 'status'
    | 'distanceKm'
    | 'durationMin'
    | 'elevationGainM'
    | 'avgHrBpm'
    | 'rpe'
    | 'feeling'
    | 'athleteNotes'
  > = []
  const { before, after } = correction

  if (before.sessionId !== after.sessionId) changed.push('sessionId')
  if (before.workoutId !== after.workoutId) changed.push('workoutId')
  if (before.date !== after.date) changed.push('date')
  if (before.performedAt !== after.performedAt) changed.push('performedAt')
  if (before.status !== after.status) changed.push('status')
  if (JSON.stringify(before.metrics.distanceKm) !== JSON.stringify(after.metrics.distanceKm)) changed.push('distanceKm')
  if (JSON.stringify(before.metrics.durationMin) !== JSON.stringify(after.metrics.durationMin)) changed.push('durationMin')
  if (JSON.stringify(before.metrics.elevationGainM) !== JSON.stringify(after.metrics.elevationGainM)) changed.push('elevationGainM')
  if (JSON.stringify(before.metrics.avgHrBpm) !== JSON.stringify(after.metrics.avgHrBpm)) changed.push('avgHrBpm')
  if (JSON.stringify(before.metrics.rpe) !== JSON.stringify(after.metrics.rpe)) changed.push('rpe')
  if (before.feeling !== after.feeling) changed.push('feeling')
  if (before.athleteNotes !== after.athleteNotes) changed.push('athleteNotes')

  return changed
}

export function RealizedTrainingHistory({
  records,
  correctionsByWorkoutLogId = {},
  locale,
}: RealizedTrainingHistoryProps) {
  const language: 'es' | 'en' = locale === 'en' ? 'en' : 'es'
  const t = useTranslations('RealizedTrainingHistory')

  if (records.length === 0) {
    return (
      <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
        {t('empty')}
      </p>
    )
  }

  return (
    <div className='space-y-3'>
      {records.map((record) => {
        const statusLabel = t(`status.${record.status}`)
        const corrections = correctionsByWorkoutLogId[record.id] ?? []

        return (
          <article
            id={`realized-training-${record.id}`}
            key={record.id}
            className='scroll-mt-6 rounded-lg border p-4 transition-shadow target:border-primary target:ring-2 target:ring-primary/40'
          >
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='font-medium capitalize'>{formatDate(record.date, language)}</p>
                  <Badge variant={record.status === 'completed' ? 'secondary' : 'outline'}>
                    {statusLabel}
                  </Badge>
                  <Badge variant='outline'>
                    {record.sessionId ? t('linkage.linked') : t('linkage.free')}
                  </Badge>
                </div>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {record.provenance.source === 'manual' ? t('source.manual') : t('source.imported')}
                </p>
              </div>

              <dl className='grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:text-right'>
                <div>
                  <dt className='text-muted-foreground'>{t('performedAt')}</dt>
                  <dd className='font-medium'>{formatDateTime24Hour(record.performedAt, language)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>{t('loggedAt')}</dt>
                  <dd className='font-medium'>{formatDateTime24Hour(record.provenance.loggedAt, language)}</dd>
                </div>
              </dl>
            </div>

            <dl className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
              <Metric icon={<Route className='size-4' />} label={t('distance')} value={metricValue(record.metrics.distanceKm, ' km', language, t)} />
              <Metric icon={<Clock3 className='size-4' />} label={t('duration')} value={durationValue(record.metrics.durationMin, t)} />
              <Metric icon={<Mountain className='size-4' />} label={t('elevation')} value={metricValue(record.metrics.elevationGainM, ' m', language, t)} />
              <Metric icon={<HeartPulse className='size-4' />} label={t('heartRate')} value={metricValue(record.metrics.avgHrBpm, ' bpm', language, t)} />
              <Metric icon={<Gauge className='size-4' />} label={t('rpe')} value={metricValue(record.metrics.rpe, '', language, t)} />
            </dl>

            {(record.provenance.sourceActivityId || record.limitations.length > 0) && (
              <div className='mt-4 border-t pt-3 text-xs text-muted-foreground'>
                {record.provenance.sourceActivityId && (
                  <p>{t('sourceActivity')}: {record.provenance.sourceActivityId}</p>
                )}
                {record.limitations.length > 0 && (
                  <p className='mt-1'>
                    {t('limitations')}: {record.limitations
                      .map((limitation) => t.has(`limitationLabels.${limitation}`) ? t(`limitationLabels.${limitation}`) : limitation)
                      .join(' · ')}
                  </p>
                )}
              </div>
            )}

            {corrections.length > 0 && (
              <div className='mt-4 border-t pt-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  {t('corrections')} ({corrections.length})
                </p>
                <ol className='mt-2 space-y-2'>
                  {corrections.map((correction) => {
                    const changedFields = correctionChangedFields(correction)
                    return (
                      <li key={correction.id} className='rounded-md bg-muted/40 p-3 text-xs'>
                        <div className='flex flex-wrap gap-x-4 gap-y-1'>
                          <span><span className='text-muted-foreground'>{t('correctedAt')}:</span> {formatDateTime24Hour(correction.correctedAt, language)}</span>
                          <span><span className='text-muted-foreground'>{t('correctedBy')}:</span> {correction.correctedByUserId}</span>
                        </div>
                        <p className='mt-1'>
                          <span className='text-muted-foreground'>{t('correctionReason')}:</span>{' '}
                          {correction.reason ?? t('noCorrectionReason')}
                        </p>
                        {changedFields.length > 0 && (
                          <p className='mt-1'>
                            <span className='text-muted-foreground'>{t('changedFields')}:</span>{' '}
                            {changedFields.map((field) => t(`correctionFields.${field}`)).join(' · ')}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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

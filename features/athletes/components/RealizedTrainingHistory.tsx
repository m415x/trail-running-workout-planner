import type { ReactNode } from 'react'
import { Clock3, Gauge, HeartPulse, Mountain, Route } from 'lucide-react'

import { formatDurationMinutes } from '@/lib/formatters'
import { Badge } from '@ui/badge'
import type { RealizedTrainingCorrectionRecord } from '@/types/training/realized-training-correction.types'
import type {
  RealizedMetric,
  RealizedMetricUnknownReason,
  RealizedTrainingRecord,
} from '@/types/training/readiness.types'

interface RealizedTrainingHistoryProps {
  records: readonly RealizedTrainingRecord[]
  correctionsByWorkoutLogId?: Readonly<Record<string, readonly RealizedTrainingCorrectionRecord[]>>
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
    limitations: 'Calidad de los datos',
    corrections: 'Historial de correcciones',
    correctedAt: 'Corregido',
    correctedBy: 'Usuario',
    correctionReason: 'Motivo',
    noCorrectionReason: 'Sin motivo registrado',
    changedFields: 'Campos corregidos',
    limitationLabels: {
      no_authoritative_session_link: 'entrenamiento libre, sin sesión planificada vinculada',
      partial_metric_coverage: 'faltan algunas métricas del entrenamiento',
      legacy_record_without_metric_evidence: 'registro histórico sin evidencia de métricas campo por campo',
    } as Record<string, string>,
    correctionFields: {
      sessionId: 'sesión vinculada',
      workoutId: 'entrenamiento vinculado',
      date: 'fecha',
      performedAt: 'fecha/hora realizada',
      status: 'estado',
      distanceKm: 'distancia',
      durationMin: 'duración',
      elevationGainM: 'D+',
      avgHrBpm: 'FC media',
      rpe: 'RPE',
      feeling: 'sensación',
      athleteNotes: 'notas',
    },
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
    limitations: 'Data quality',
    corrections: 'Correction history',
    correctedAt: 'Corrected',
    correctedBy: 'User',
    correctionReason: 'Reason',
    noCorrectionReason: 'No reason recorded',
    changedFields: 'Corrected fields',
    limitationLabels: {
      no_authoritative_session_link: 'free workout with no linked planned session',
      partial_metric_coverage: 'some training metrics were not recorded',
      legacy_record_without_metric_evidence: 'historical record without field-level metric evidence',
    } as Record<string, string>,
    correctionFields: {
      sessionId: 'linked session',
      workoutId: 'linked workout',
      date: 'date',
      performedAt: 'performed date/time',
      status: 'status',
      distanceKm: 'distance',
      durationMin: 'duration',
      elevationGainM: 'elevation gain',
      avgHrBpm: 'avg HR',
      rpe: 'RPE',
      feeling: 'feeling',
      athleteNotes: 'notes',
    },
    unknownReasons: {
      not_recorded: 'not recorded',
      legacy_zero_ambiguous: 'ambiguous legacy zero',
      invalid_value: 'invalid value',
    } satisfies Record<RealizedMetricUnknownReason, string>,
  },
} as const

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-AR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`))
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

function durationValue(metric: RealizedMetric, locale: 'es' | 'en') {
  const labels = copy[locale]
  if (metric.state === 'unknown') {
    return `${labels.unknown} · ${labels.unknownReasons[metric.reason]}`
  }

  return formatDurationMinutes(metric.value)
}

function correctionChangedFields(correction: RealizedTrainingCorrectionRecord) {
  const changed: Array<keyof typeof copy.es.correctionFields> = []
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
        const corrections = correctionsByWorkoutLogId[record.id] ?? []

        return (
          <article key={record.id} className='rounded-lg border p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='font-medium capitalize'>{formatDate(record.date, language)}</p>
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
              <Metric icon={<Clock3 className='size-4' />} label={labels.duration} value={durationValue(record.metrics.durationMin, language)} />
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
                  <p className='mt-1'>
                    {labels.limitations}: {record.limitations
                      .map((limitation) => labels.limitationLabels[limitation] ?? limitation)
                      .join(' · ')}
                  </p>
                )}
              </div>
            )}

            {corrections.length > 0 && (
              <div className='mt-4 border-t pt-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  {labels.corrections} ({corrections.length})
                </p>
                <ol className='mt-2 space-y-2'>
                  {corrections.map((correction) => {
                    const changedFields = correctionChangedFields(correction)
                    return (
                      <li key={correction.id} className='rounded-md bg-muted/40 p-3 text-xs'>
                        <div className='flex flex-wrap gap-x-4 gap-y-1'>
                          <span><span className='text-muted-foreground'>{labels.correctedAt}:</span> {formatDateTime(correction.correctedAt, language)}</span>
                          <span><span className='text-muted-foreground'>{labels.correctedBy}:</span> {correction.correctedByUserId}</span>
                        </div>
                        <p className='mt-1'>
                          <span className='text-muted-foreground'>{labels.correctionReason}:</span>{' '}
                          {correction.reason ?? labels.noCorrectionReason}
                        </p>
                        {changedFields.length > 0 && (
                          <p className='mt-1'>
                            <span className='text-muted-foreground'>{labels.changedFields}:</span>{' '}
                            {changedFields.map((field) => labels.correctionFields[field]).join(' · ')}
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

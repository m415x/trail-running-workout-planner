import { AlertTriangle, CheckCircle2, ClipboardCheck, Info } from 'lucide-react'

import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import type { ReadinessAssessment, ReadinessCoachReview } from '@/types'

interface ReadinessReviewPanelProps {
  assessmentId: string
  assessment: ReadinessAssessment
  review?: ReadinessCoachReview | null
  reviewAction?: (formData: FormData) => void | Promise<void>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)
}

const ALERT_LABELS: Record<string, string> = {
  continuity_gap: 'Discontinuidad reciente',
  competition_distance_exposure_gap: 'Exposición reciente de distancia',
  competition_elevation_exposure_gap: 'Exposición reciente de desnivel',
  planned_realized_deviation: 'Diferencia entre planificado y realizado',
  predicted_session_jump: 'Salto en una sesión prevista',
  long_run_concentration: 'Concentración en la tirada larga',
}

export function ReadinessReviewPanel({
  assessmentId,
  assessment,
  review = null,
  reviewAction,
}: ReadinessReviewPanelProps) {
  const insufficient = assessment.status === 'insufficient_data'

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <ClipboardCheck className='size-5' />
              Preparación reciente vs. demanda competitiva
            </CardTitle>
            <CardDescription className='mt-1'>
              {assessment.target.name} · {assessment.target.distanceKm} km · {assessment.target.priority}
            </CardDescription>
          </div>
          <Badge variant={insufficient ? 'outline' : assessment.alerts.length > 0 ? 'destructive' : 'secondary'}>
            {insufficient
              ? 'Información insuficiente'
              : assessment.alerts.length > 0
                ? `${assessment.alerts.length} alerta${assessment.alerts.length === 1 ? '' : 's'}`
                : 'Sin desajustes detectados'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-5'>
        <div className='rounded-lg border bg-muted/30 p-4 text-sm'>
          <div className='flex gap-2'>
            <Info className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
            <p>
              Esta evaluación es orientativa. No constituye diagnóstico, autorización para competir ni
              certificación de preparación. Reconocer una alerta no modifica automáticamente la planificación.
            </p>
          </div>
        </div>

        <dl className='grid gap-3 text-sm sm:grid-cols-3'>
          <div>
            <dt className='text-muted-foreground'>Período analizado</dt>
            <dd className='font-medium'>{assessment.summary.window.startDate} → {assessment.summary.window.endDate}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Fase</dt>
            <dd className='font-medium'>{assessment.phase.phase}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Reglas</dt>
            <dd className='font-medium'>{assessment.policyVersion} ({assessment.policyStatus})</dd>
          </div>
        </dl>

        {insufficient ? (
          <div role='status' className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-4'>
            <div className='flex gap-2'>
              <AlertTriangle className='mt-0.5 size-4 shrink-0' />
              <div>
                <p className='font-medium'>No hay evidencia suficiente para evaluar esta preparación.</p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  La falta de registros no se interpreta como falta de entrenamiento.
                </p>
              </div>
            </div>
          </div>
        ) : assessment.alerts.length === 0 ? (
          <div role='status' className='rounded-lg border p-4'>
            <div className='flex gap-2'>
              <CheckCircle2 className='mt-0.5 size-4 shrink-0' />
              <p className='text-sm'>No se detectaron desajustes con las reglas y datos disponibles.</p>
            </div>
          </div>
        ) : (
          <div className='space-y-3'>
            {assessment.alerts.map((alert, index) => (
              <article key={`${alert.code}-${alert.dimension}-${index}`} className='rounded-lg border p-4'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='font-medium'>{ALERT_LABELS[alert.code] ?? alert.code}</h3>
                  <Badge variant='outline'>{alert.dimension}</Badge>
                </div>
                <p className='mt-2 text-sm text-muted-foreground'>{alert.cause}</p>
                <dl className='mt-3 grid gap-2 text-sm sm:grid-cols-3'>
                  <div>
                    <dt className='text-muted-foreground'>Observado</dt>
                    <dd>{formatNumber(alert.evidence.observedValue)} {alert.evidence.unit}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Referencia</dt>
                    <dd>{formatNumber(alert.evidence.referenceValue)} {alert.evidence.unit}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Criterio</dt>
                    <dd>{alert.rule.criterion} · {formatNumber(alert.rule.threshold)}</dd>
                  </div>
                </dl>
                <p className='mt-3 text-xs text-muted-foreground'>
                  Período: {alert.period.startDate} → {alert.period.endDate}
                </p>
              </article>
            ))}
          </div>
        )}

        {assessment.limitations.length > 0 && (
          <div className='text-xs text-muted-foreground'>
            Limitaciones: {assessment.limitations.join(' · ')}
          </div>
        )}

        {review ? (
          <div className='rounded-lg border p-4 text-sm'>
            <p className='font-medium'>Revisión registrada: {review.decision}</p>
            <p className='mt-1 text-muted-foreground'>{review.note ?? 'Sin nota adicional.'}</p>
          </div>
        ) : reviewAction ? (
          <form action={reviewAction} className='space-y-3 rounded-lg border p-4'>
            <input type='hidden' name='assessmentId' value={assessmentId} />
            <fieldset className='space-y-2'>
              <legend className='text-sm font-medium'>Decisión del profesor</legend>
              <label className='flex items-center gap-2 text-sm'>
                <input type='radio' name='decision' value='acknowledged' defaultChecked />
                Revisada / reconocida
              </label>
              <label className='flex items-center gap-2 text-sm'>
                <input type='radio' name='decision' value='needs_planning_review' />
                Requiere revisar la planificación
              </label>
            </fieldset>
            <label className='block text-sm'>
              <span className='font-medium'>Nota</span>
              <textarea
                name='note'
                rows={3}
                className='mt-1 w-full rounded-md border bg-background p-2'
                placeholder='Contexto o decisión del profesor'
              />
            </label>
            <Button type='submit'>Registrar revisión</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}

'use client'

import { useActionState } from 'react'
import { AlertTriangle, CalendarClock, MapPin, Mountain, Route } from 'lucide-react'

import { persistGeneratedSessions } from '@/app/actions/session-generation-actions'
import type { MicrocycleType } from '@/types/training/periodization.types'
import type {
  SharedSessionEventProposal,
  SharedSessionGenerationResult,
} from '@/types/training/session-generation.types'
import { Badge } from '@ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Button } from '@ui/button'

export interface SessionGenerationPreviewWeek {
  microcycleId: string
  weekNumber: number
  type: MicrocycleType
  startDate: string
  endDate: string
  events: SharedSessionEventProposal[]
  warnings: string[]
}

interface SessionGenerationPreviewProps {
  weeks: SessionGenerationPreviewWeek[]
  warnings: string[]
  isAvailable: boolean
  planId: string
  locale: string
  proposal: SharedSessionGenerationResult
}

const microcycleLabels: Record<MicrocycleType, string> = {
  base: 'Base',
  development: 'Desarrollo',
  shock: 'Carga',
  deload: 'Descarga',
  tapering: 'Taper',
  race: 'Carrera',
}

/** Displays generated, non-persisted sessions grouped by source microcycle. */
export function SessionGenerationPreview({
  weeks,
  warnings,
  isAvailable,
  planId,
  locale,
  proposal,
}: SessionGenerationPreviewProps) {
  const [state, formAction, isPending] = useActionState(persistGeneratedSessions, {})
  const sessionCount = weeks.reduce((total, week) => total + week.events.length, 0)

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>Vista previa de sesiones</CardTitle>
            <CardDescription>
              Propuesta calculada desde cada microciclo. Revisala antes de guardarla.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>{state.success ? 'Guardado' : 'No guardado'}</Badge>
            {isAvailable && <Badge variant='outline'>{sessionCount} sesiones</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!isAvailable ? (
          <p className='text-sm text-muted-foreground'>
            Completá la estrategia de carga, intensidad y configuración semanal para generar la vista previa.
          </p>
        ) : weeks.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No hay microciclos disponibles para generar sesiones.</p>
        ) : (
          <div className='space-y-3'>
            {weeks.map((week, index) => (
              <details
                key={week.microcycleId}
                className='group rounded-lg border bg-card open:bg-muted/20'
                open={index === 0}
              >
                <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4'>
                  <div>
                    <p className='font-medium'>Semana {week.weekNumber} · {microcycleLabels[week.type]}</p>
                    <p className='text-sm text-muted-foreground'>
                      {formatDate(week.startDate)} – {formatDate(week.endDate)}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    {week.warnings.length > 0 && (
                      <Badge variant='destructive'>{week.warnings.length} avisos</Badge>
                    )}
                    <Badge variant='outline'>{week.events.length} sesiones</Badge>
                  </div>
                </summary>

                <div className='grid gap-3 border-t p-4 lg:grid-cols-2 xl:grid-cols-3'>
                  {week.events.map((event) => {
                    const prescriptions = event.prescriptions.filter(({ prescription }) => (
                      prescription.microcycleId === week.microcycleId
                    ))
                    const isCompetition = event.prescriptions.some(({ role }) => role === 'competition')

                    return (
                      <article key={event.sharedEventKey} className='space-y-3 rounded-lg border bg-background p-4'>
                        <div className='flex items-start justify-between gap-2'>
                          <div>
                            <p className='font-semibold'>{event.session.title}</p>
                            <p className='text-sm text-muted-foreground'>{formatDate(event.session.date)}</p>
                          </div>
                          <Badge variant='outline'>{event.session.type}</Badge>
                        </div>

                        {prescriptions.map(({ generationKey, prescription }) => (
                          <div key={generationKey} className='space-y-2 text-sm'>
                            <div className='flex flex-wrap gap-x-4 gap-y-2'>
                              <span className='inline-flex items-center gap-1.5'>
                                <Route className='size-4 text-muted-foreground' />
                                {formatNumber(prescription.distanceKm)} km
                              </span>
                              <span className='inline-flex items-center gap-1.5'>
                                <Mountain className='size-4 text-muted-foreground' />
                                {formatNumber(prescription.elevationGain)} m D+
                              </span>
                              <span className='inline-flex items-center gap-1.5'>
                                <CalendarClock className='size-4 text-muted-foreground' />
                                {formatIntensity(prescription)}
                              </span>
                            </div>
                          </div>
                        ))}

                        {isCompetition && (
                          <p className='text-xs font-medium text-muted-foreground'>
                            Competencia · no incluida en el volumen de entrenamiento del taper.
                          </p>
                        )}

                        {event.session.locationKey && (
                          <p className='inline-flex items-center gap-1.5 text-sm text-muted-foreground'>
                            <MapPin className='size-4' /> {event.session.locationKey}
                          </p>
                        )}
                        {event.warnings.length > 0 && (
                          <div className='space-y-1 text-sm text-destructive'>
                            {event.warnings.map((warning) => (
                              <p key={warning} className='flex gap-1.5'>
                                <AlertTriangle className='mt-0.5 size-4 shrink-0' /> {warning}
                              </p>
                            ))}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className='rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm'>
            <p className='mb-2 font-medium text-destructive'>Revisá la propuesta</p>
            <ul className='space-y-1 text-muted-foreground'>
              {warnings.map((warning) => <li key={warning}>• {warning}</li>)}
            </ul>
          </div>
        )}
        {isAvailable && sessionCount > 0 && (
          <form action={formAction} className='flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
            <input type='hidden' name='planId' value={planId} />
            <input type='hidden' name='locale' value={locale} />
            <input type='hidden' name='proposal' value={JSON.stringify(proposal)} />
            <div className='text-sm'>
              {state.error && <p className='text-destructive'>{state.error}</p>}
              {state.success && <p className='text-emerald-600'>{state.success}</p>}
              {!state.error && !state.success && (
                <p className='text-muted-foreground'>Guardá esta propuesta para publicarla en el calendario.</p>
              )}
            </div>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar sesiones'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('es-AR')
}

function formatIntensity(
  prescription: SharedSessionEventProposal['prescriptions'][number]['prescription'],
) {
  return prescription.intensityMethod === 'pam_percentage'
    ? `${prescription.pamPercentage ?? 0}% PAM`
    : prescription.zone ?? 'Sin zona'
}

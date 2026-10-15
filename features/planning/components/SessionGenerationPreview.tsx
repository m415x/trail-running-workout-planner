'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CalendarClock, MapPin, Mountain, Route } from 'lucide-react'

import { createCoachSessionReviewSnapshot, confirmCoachSessionReviewSnapshot } from '@/app/actions/coach-session-review-snapshot-actions'
import type { SnapshotRow } from '@/lib/session-generation/review-snapshot-postgres-repository'
import type { GenerationExplanation } from '@/lib/session-generation/generation-explanation'
import { GenerationExplanationView } from '@/features/planning/components/GenerationExplanationView'
import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
import { parseMissingTemplateWarning } from '@/lib/session-generation/missing-template-warning'
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
  generationExplanations: Record<string, GenerationExplanation>
  reviewedSnapshot?: SnapshotRow | null
}

/** Displays generated, non-persisted sessions grouped by source microcycle. */
export function SessionGenerationPreview({
  weeks,
  warnings,
  isAvailable,
  planId,
  locale,
  generationExplanations,
  reviewedSnapshot,
}: SessionGenerationPreviewProps) {
  const language = locale === 'en' ? 'en' : 'es'
  const t = useTranslations('CoachPlanning')
  const workoutTypeT = useTranslations('Workouts')
  const regionalContext = resolveApplicationRegionalContext({ language })
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // A review is authoritative only if a current H2/H3/H4A GET returned it.
  // Never use the page-rendered preview as the CONFIRM source.
  const reviewedProposal = reviewedSnapshot?.proposal as SharedSessionGenerationResult | undefined
  const reviewEvents = reviewedProposal && Array.isArray(reviewedProposal.events)
    ? reviewedProposal.events : null
  const reviewedExplanations = reviewedSnapshot?.generationExplanations as
    Record<string, GenerationExplanation> | undefined
  const displayedWeeks = reviewedSnapshot && reviewEvents
    ? weeks.map(week => ({
        ...week,
        events: reviewEvents.filter(event => event.prescriptions.some(
          item => item.prescription.microcycleId === week.microcycleId,
        )),
      }))
    : weeks
  const displayedExplanations = reviewedSnapshot ? (reviewedExplanations ?? {}) : generationExplanations
  const sessionCount = reviewedSnapshot && reviewEvents
    ? reviewEvents.length : weeks.reduce((total, week) => total + week.events.length, 0)
  const formatWarning = (warning: string) => {
    const parsed = parseMissingTemplateWarning(warning)
    if (!parsed) return warning

    return t('sessionPreview.missingTemplate', {
      role: t(`roles.${parsed.role}`),
      period: t(`sessionPreview.periods.${parsed.period}`),
      microcycleType: t(`microcycleType.types.${parsed.microcycleType}`),
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>{t('sessionPreview.title')}</CardTitle>
            <CardDescription>
              {t('sessionPreview.description')}
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>{t('sessionPreview.notSaved')}</Badge>
            {isAvailable && <Badge variant='outline'>{t('sessionPreview.sessions', { count: sessionCount })}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!isAvailable ? (
          <p className='text-sm text-muted-foreground'>
            {t('sessionPreview.ready')}
          </p>
        ) : displayedWeeks.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('sessionPreview.empty')}</p>
        ) : (
          <div className='space-y-3'>
            {displayedWeeks.map((week, index) => (
              <details
                key={week.microcycleId}
                className='group rounded-lg border bg-card open:bg-muted/20'
                open={index === 0}
              >
                <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4'>
                  <div>
                    <p className='font-medium'>{t('sessionPreview.week', { count: week.weekNumber })} · {t(`microcycleType.types.${week.type}`)}</p>
                    <p className='text-sm text-muted-foreground'>
                      {formatDate(week.startDate, regionalContext.presentationLocale)} – {formatDate(week.endDate, regionalContext.presentationLocale)}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    {week.warnings.length > 0 && (
                      <Badge variant='destructive'>{t('sessionPreview.warnings', { count: week.warnings.length })}</Badge>
                    )}
                    <Badge variant='outline'>{t('sessionPreview.sessions', { count: week.events.length })}</Badge>
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
                            <p className='text-sm text-muted-foreground'>{formatDate(event.session.date, regionalContext.presentationLocale)}</p>
                          </div>
                          <Badge variant='outline'>{workoutTypeT(`types.${event.session.type}`)}</Badge>
                        </div>

                        {prescriptions.map(({ generationKey, prescription }) => {
                          const generationExplanation = displayedExplanations[generationKey]

                          return (
                            <div key={generationKey} className='space-y-2 text-sm'>
                              <div className='flex flex-wrap gap-x-4 gap-y-2'>
                                <span className='inline-flex items-center gap-1.5'>
                                  <Route className='size-4 text-muted-foreground' />
                                  {formatNumber(prescription.distanceKm, regionalContext.presentationLocale)} km
                                </span>
                                <span className='inline-flex items-center gap-1.5'>
                                  <Mountain className='size-4 text-muted-foreground' />
                                  {formatNumber(prescription.elevationGain, regionalContext.presentationLocale)} m D+
                                </span>
                                <span className='inline-flex items-center gap-1.5'>
                                  <CalendarClock className='size-4 text-muted-foreground' />
                                  {formatIntensity(prescription, t('sessionPreview.referencePercentage'), t('sessionPreview.noZone'))}
                                </span>
                              </div>

                              {generationExplanation && (
                                <details className='rounded-md border bg-muted/20'>
                                  <summary className='cursor-pointer px-3 py-2 font-medium'>
                                    {t('whyGenerated')}
                                  </summary>
                                  <div className='border-t px-3 py-3'>
                                    <GenerationExplanationView
                                      generationExplanation={generationExplanation}
                                      locale={locale}
                                    />
                                  </div>
                                </details>
                              )}
                            </div>
                          )
                        })}

                        {isCompetition && (
                          <p className='text-xs font-medium text-muted-foreground'>
                            {t('sessionPreview.competitionNote')}
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
                                <AlertTriangle className='mt-0.5 size-4 shrink-0' /> {formatWarning(warning)}
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
            <p className='mb-2 font-medium text-destructive'>{t('sessionPreview.review')}</p>
            <ul className='space-y-1 text-muted-foreground'>
              {warnings.map((warning) => <li key={warning}>• {formatWarning(warning)}</li>)}
            </ul>
          </div>
        )}
        {isAvailable && sessionCount > 0 && (
          <form
            action={formData => {
              setFeedback(null)
              startTransition(async () => {
                try {
                  const result = reviewedSnapshot
                    ? await confirmCoachSessionReviewSnapshot(formData)
                    : await createCoachSessionReviewSnapshot(formData)
                  if (result.kind === 'denied') setFeedback('No autorizado')
                  else if (result.kind === 'unavailable') setFeedback('La revisión ya no está disponible.')
                } catch {
                  setFeedback('No se pudo completar la operación.')
                }
              })
            }}
            className='flex flex-wrap items-center justify-between gap-3 border-t pt-4'
          >
            <input type='hidden' name='planId' value={planId} />
            <input type='hidden' name='locale' value={locale} />
            {reviewedSnapshot && <input type='hidden' name='snapshotId' value={reviewedSnapshot.id} />}
            <div className='text-sm'>
              {feedback && <p className='text-destructive'>{feedback}</p>}
              {!feedback && (
                <p className='text-muted-foreground'>
                  {reviewedSnapshot
                    ? 'Confirmar la revisión autorizada y guardar las sesiones.'
                    : 'Crear una revisión autorizada antes de confirmar las sesiones.'}
                </p>
              )}
            </div>
            <Button type='submit' disabled={isPending}>
              {isPending ? t('saving') : reviewedSnapshot ? t('saveSessions') : 'Crear revisión'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function formatDate(value: string, presentationLocale: string) {
  return new Intl.DateTimeFormat(presentationLocale, {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function formatNumber(value: number | null | undefined, presentationLocale: string) {
  return new Intl.NumberFormat(presentationLocale).format(value ?? 0)
}

function formatIntensity(
  prescription: SharedSessionEventProposal['prescriptions'][number]['prescription'],
  referenceLabel: string,
  noZoneLabel: string,
) {
  return prescription.intensityMethod === 'reference_percentage'
    ? `${prescription.referencePercentage ?? 0}% ${referenceLabel}`
    : prescription.zone ?? noZoneLabel
}


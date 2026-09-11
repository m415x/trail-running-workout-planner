import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'

import { getCompetitionCalendarAction } from '@/app/actions/competition-calendar-actions'
import { getGroupTrainingPlanById } from '@/app/actions/planning-actions'
import { getSessionGenerationPreferencesForPlan } from '@/app/actions/session-generation-preferences-actions'
import { getWorkoutTemplates } from '@/app/actions/workout-template-actions'
import { CompetitionCalendarSummary } from '@/features/planning/components/CompetitionCalendarSummary'
import { MicrocycleDatesForm } from '@/features/planning/components/MicrocycleDatesForm'
import { MicrocycleElevationForm } from '@/features/planning/components/MicrocycleElevationForm'
import { MicrocycleNotesForm } from '@/features/planning/components/MicrocycleNotesForm'
import { MicrocycleTypeForm } from '@/features/planning/components/MicrocycleTypeForm'
import { MicrocycleVolumeForm } from '@/features/planning/components/MicrocycleVolumeForm'
import { SessionGenerationPreferencesForm } from '@/features/planning/components/SessionGenerationPreferencesForm'
import {
  SessionGenerationPreview,
  type SessionGenerationPreviewWeek,
} from '@/features/planning/components/SessionGenerationPreview'
import {
  IntensityDistribution,
  type IntensityDistributionPoint,
} from '@/features/planning/components/IntensityDistribution'
import {
  LoadProgressionPreview,
  type LoadProgressionPoint,
} from '@/features/planning/components/LoadProgressionPreview'
import { deriveCompetitionContext } from '@/lib/periodization/competition-context'
import {
  buildLoadProgressionPreview,
  determineTrainingProgressionEndDate,
} from '@/lib/periodization/load-progression-preview'
import { determineMicrocycleLoadFocus } from '@/lib/periodization/microcycle-load-focus'
import { generateWeeklySessionProposals } from '@/lib/session-generation/session-proposal-generator'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import type { AthleteGroupCode, LoadStrategyDraft } from '@/types'
import type { SessionGenerationResult } from '@/types/training/session-generation.types'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table'

interface PlanningDetailPageProps {
  params: Promise<{ locale: string; planId: string }>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export default async function PlanningDetailPage({ params }: PlanningDetailPageProps) {
  const { locale, planId } = await params
  const plan = await getGroupTrainingPlanById(planId)

  if (!plan) {
    notFound()
  }

  const [generationPreferences, templateCatalogue, competitionCalendarResult] = await Promise.all([
    getSessionGenerationPreferencesForPlan(planId),
    getWorkoutTemplates({ archive: 'active' }),
    getCompetitionCalendarAction({ planId, locale: locale === 'en' ? 'en' : 'es' }),
  ])
  const competitions = competitionCalendarResult.ok ? competitionCalendarResult.value : []
  const competitionContextResult = deriveCompetitionContext(competitions)
  const primaryCompetitionId = competitionContextResult.valid
    ? competitionContextResult.context.primaryCompetition?.id ?? null
    : null
  const planningPath = locale === 'es' ? '/dashboard/planning' : `/${locale}/dashboard/planning`
  const groupCode = `${plan.group.categoryCode}${plan.group.levelCode}`
  const previewMacrocycle = plan.macrocycles[0]
  const loadStrategy: LoadStrategyDraft | null = plan.loadStrategy
    ? {
        context: {
          athleteGroup: groupCode as AthleteGroupCode,
          goalType: plan.loadStrategy.goalType,
        },
        values: {
          initialWeeklyVolumeKm: plan.loadStrategy.initialWeeklyVolumeKm,
          maximumWeeklyVolumeKm: plan.loadStrategy.maximumWeeklyVolumeKm,
          maximumWeeklyIncreasePercentage: plan.loadStrategy.maximumWeeklyIncreasePercentage,
          deloadPercentage: plan.loadStrategy.deloadPercentage,
          initialWeeklyElevationGain: plan.loadStrategy.initialWeeklyElevationGain,
          maximumWeeklyElevationGain: plan.loadStrategy.maximumWeeklyElevationGain,
        },
        fieldSources: plan.loadStrategy.fieldSources,
      }
    : null
  const protectedMesocycles = previewMacrocycle?.mesocycles.filter((mesocycle) => (
    mesocycle.period === 'competitive' || mesocycle.period === 'transition'
  )) ?? []
  const trainingEndDate = previewMacrocycle
    ? determineTrainingProgressionEndDate(
        previewMacrocycle.endDate,
        protectedMesocycles.flatMap((mesocycle) => (
          mesocycle.microcycles.map((microcycle) => microcycle.startDate)
        )),
      )
    : null
  const existingMicrocycles = previewMacrocycle
    ? previewMacrocycle.mesocycles
      .filter((mesocycle) => !protectedMesocycles.includes(mesocycle))
      .flatMap((mesocycle) =>
      mesocycle.microcycles.map((microcycle) => ({
        id: microcycle.id,
        weekNumber: microcycle.weekNumber,
        targetVolumeKm: microcycle.targetVolumeKm,
        targetVolumeSource: microcycle.targetVolumeSource,
        targetElevationGain: microcycle.targetElevationGain,
        targetElevationSource: microcycle.targetElevationSource,
      })),
    )
    : []
  const preview = loadStrategy && previewMacrocycle && trainingEndDate
    ? buildLoadProgressionPreview({
        title: previewMacrocycle.title,
        startDate: previewMacrocycle.startDate,
        endDate: trainingEndDate,
        loadStrategy,
        finishesBeforeTaper: protectedMesocycles.length > 0,
        competitionContext: protectedMesocycles.length === 0 && competitionContextResult.valid
          ? competitionContextResult.context
          : undefined,
        existingMicrocycles,
      })
    : null
  const generatedPreviewPoints: LoadProgressionPoint[] = preview
    ? preview.planning.mesocycles.flatMap((mesocycle) =>
        mesocycle.microcycles.map((microcycle) => ({
          weekNumber: microcycle.weekNumber,
          volumeKm: microcycle.targetVolumeKm,
          elevationGain: microcycle.targetElevationGain,
          type: microcycle.type,
          loadFocus: microcycle.loadFocus,
          volumeSource: microcycle.targetVolumeSource,
          elevationSource: microcycle.targetElevationSource,
        })),
      )
    : []
  const protectedPreviewPoints: LoadProgressionPoint[] = protectedMesocycles.flatMap((mesocycle) =>
    mesocycle.microcycles.flatMap((microcycle) => (
      microcycle.targetVolumeKm === null
        ? []
        : [{
            weekNumber: microcycle.weekNumber,
            volumeKm: microcycle.targetVolumeKm,
            elevationGain: microcycle.targetElevationGain,
            type: microcycle.type,
            loadFocus: determineMicrocycleLoadFocus(microcycle.type),
            volumeSource: microcycle.targetVolumeSource,
            elevationSource: microcycle.targetElevationSource,
          }]
    )),
  )
  const previewPoints = [...generatedPreviewPoints, ...protectedPreviewPoints]
    .sort((first, second) => first.weekNumber - second.weekNumber)
  const intensityTargetsByMicrocycle = new Map(
    plan.intensityTargets.map((target) => [target.microcycleId, target]),
  )
  const intensityPoints: IntensityDistributionPoint[] = plan.macrocycles
    .flatMap((macrocycle) => macrocycle.mesocycles)
    .flatMap((mesocycle) => mesocycle.microcycles)
    .flatMap((microcycle) => {
      const target = intensityTargetsByMicrocycle.get(microcycle.id)

      return target
        ? [{
            microcycleId: microcycle.id,
            weekNumber: microcycle.weekNumber,
            type: microcycle.type,
            emphasis: target.emphasis,
            intenseSessionsTarget: target.intenseSessionsTarget,
            predominantZone: target.predominantZone,
            pamPercentageTarget: target.pamPercentageTarget,
            minimumRecoveryDaysBetweenIntenseSessions:
              target.minimumRecoveryDaysBetweenIntenseSessions,
            fieldSources: target.fieldSources,
          }]
        : []
    })
    .sort((first, second) => first.weekNumber - second.weekNumber)
  const canGenerateSessions = Boolean(
    plan.loadStrategy && plan.intensityStrategy && generationPreferences,
  )
  const generationResults: SessionGenerationResult[] = []
  const sessionPreviewWarnings: string[] = []

  if (plan.loadStrategy && plan.intensityStrategy && generationPreferences) {
    for (const macrocycle of plan.macrocycles) {
      for (const mesocycle of macrocycle.mesocycles) {
        for (const microcycle of mesocycle.microcycles) {
          const intensityTarget = intensityTargetsByMicrocycle.get(microcycle.id)
          if (microcycle.targetVolumeKm === null || !intensityTarget) {
            sessionPreviewWarnings.push(
              `Semana ${microcycle.weekNumber}: falta un objetivo de volumen o intensidad.`,
            )
            continue
          }

          try {
            generationResults.push(generateWeeklySessionProposals({
              context: {
                teamId: plan.group.teamId,
                groupTrainingPlanId: plan.id,
                groupId: plan.groupId,
                microcycleId: microcycle.id,
                period: mesocycle.period,
                microcycleType: microcycle.type,
                startDate: microcycle.startDate,
                endDate: microcycle.endDate,
                load: {
                  targetVolumeKm: microcycle.targetVolumeKm,
                  targetElevationGain: microcycle.targetElevationGain,
                  targetDurationMin: microcycle.targetDurationMin,
                  maximumWeeklyVolumeKm: plan.loadStrategy.maximumWeeklyVolumeKm,
                },
              intensity: {
                  defaultMethod: plan.intensityStrategy.defaultMethod,
                  emphasis: intensityTarget.emphasis,
                  intenseSessionsTarget: intensityTarget.intenseSessionsTarget,
                  predominantZone: intensityTarget.predominantZone,
                  pamPercentageTarget: intensityTarget.pamPercentageTarget,
                minimumRecoveryDaysBetweenIntenseSessions:
                  intensityTarget.minimumRecoveryDaysBetweenIntenseSessions,
              },
              competition: microcycle.type === 'race'
                && macrocycle.targetRaceName
                && macrocycle.targetRaceDistanceKm
                ? {
                    name: macrocycle.targetRaceName,
                    date: macrocycle.endDate,
                    distanceKm: macrocycle.targetRaceDistanceKm,
                    elevationGain: macrocycle.targetRaceElevationGain,
                  }
                : null,
              frequency: generationPreferences.frequency,
                pattern: generationPreferences.pattern,
              },
              templates: templateCatalogue.templates,
            }))
          } catch (error) {
            sessionPreviewWarnings.push(
              `Semana ${microcycle.weekNumber}: ${error instanceof Error ? error.message : 'no se pudo generar la propuesta'}.`,
            )
          }
        }
      }
    }
  }

  const sharedPreview = groupSharedSessionEvents(generationResults)
  const sessionPreviewWeeks: SessionGenerationPreviewWeek[] = plan.macrocycles
    .flatMap((macrocycle) => macrocycle.mesocycles)
    .flatMap((mesocycle) => mesocycle.microcycles)
    .map((microcycle) => {
      const events = sharedPreview.events.filter((event) => (
        event.prescriptions.some(({ prescription }) => (
          prescription.microcycleId === microcycle.id
        ))
      ))
      const warnings = uniqueStrings([
        ...events.flatMap((event) => event.warnings),
        ...sessionPreviewWarnings.filter((warning) => (
          warning.startsWith(`Semana ${microcycle.weekNumber}:`)
        )),
      ])

      return {
        microcycleId: microcycle.id,
        weekNumber: microcycle.weekNumber,
        type: microcycle.type,
        startDate: microcycle.startDate,
        endDate: microcycle.endDate,
        events,
        warnings,
      }
    })
    .sort((first, second) => first.weekNumber - second.weekNumber)

  return (
    <div className='space-y-6'>
      <div className='flex items-start gap-3'>
        <Link
          href={planningPath}
          aria-label='Volver a planificaciones'
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft />
        </Link>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-3xl font-bold tracking-tight'>{plan.title}</h2>
            <Badge variant='secondary'>Grupo {groupCode}</Badge>
          </div>
          <p className='text-muted-foreground'>Editá el volumen y el desnivel objetivo de cada semana sin regenerar la planificación.</p>
        </div>
      </div>

      <CompetitionCalendarSummary
        competitions={competitions}
        primaryCompetitionId={primaryCompetitionId}
        locale={locale}
        hasPrimaryConflict={!competitionContextResult.valid}
      />

      {preview && loadStrategy ? (
        <LoadProgressionPreview
          points={previewPoints}
          initialVolumeKm={loadStrategy.values.initialWeeklyVolumeKm}
          maximumVolumeKm={loadStrategy.values.maximumWeeklyVolumeKm}
          warnings={preview.planning.generationWarnings}
          conflicts={preview.conflicts.map((conflict) => conflict.message)}
          planId={plan.id}
          macrocycleId={previewMacrocycle.id}
          locale={locale}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Vista previa no disponible</CardTitle>
            <CardDescription>
              Esta planificación fue creada antes de incorporar estrategias de carga.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {plan.intensityStrategy && (
        <IntensityDistribution
          points={intensityPoints}
          defaultMethod={plan.intensityStrategy.defaultMethod}
          maximumIntenseSessionsPerWeek={
            plan.intensityStrategy.maximumIntenseSessionsPerWeek
          }
          minimumRecoveryDaysBetweenIntenseSessions={
            plan.intensityStrategy.minimumRecoveryDaysBetweenIntenseSessions
          }
          strategySources={plan.intensityStrategy.fieldSources}
        />
      )}

      {generationPreferences && (
        <SessionGenerationPreferencesForm
          planId={plan.id}
          locale={locale}
          frequency={generationPreferences.frequency}
          pattern={generationPreferences.pattern}
        />
      )}

      <SessionGenerationPreview
        weeks={sessionPreviewWeeks}
        warnings={uniqueStrings([
          ...sessionPreviewWarnings,
          ...sharedPreview.warnings,
        ])}
        isAvailable={canGenerateSessions}
        planId={plan.id}
        locale={locale}
        proposal={sharedPreview}
      />

      {plan.macrocycles.map((macrocycle) => (
        <div key={macrocycle.id} className='space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <CalendarDays className='size-5 text-muted-foreground' />
            <h3 className='text-xl font-semibold'>{macrocycle.title}</h3>
            <span className='text-sm text-muted-foreground'>
              {formatDate(macrocycle.startDate)} – {formatDate(macrocycle.endDate)}
            </span>
          </div>

          {macrocycle.mesocycles.map((mesocycle) => (
            <Card key={mesocycle.id}>
              <CardHeader>
                <CardTitle>{mesocycle.title}</CardTitle>
                <CardDescription>{mesocycle.objective}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='overflow-hidden rounded-lg border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Semana</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fechas</TableHead>
                        <TableHead>Desnivel</TableHead>
                        <TableHead>Notas</TableHead>
                        <TableHead className='text-right'>Volumen objetivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mesocycle.microcycles.map((microcycle) => (
                        <TableRow key={microcycle.id}>
                          <TableCell className='font-medium'>{microcycle.weekNumber}</TableCell>
                          <TableCell>
                            <MicrocycleTypeForm
                              microcycleId={microcycle.id}
                              planId={plan.id}
                              locale={locale}
                              currentType={microcycle.type}
                            />
                          </TableCell>
                          <TableCell>
                            <MicrocycleDatesForm
                              microcycleId={microcycle.id}
                              planId={plan.id}
                              locale={locale}
                              startDate={microcycle.startDate}
                              endDate={microcycle.endDate}
                            />
                          </TableCell>
                          <TableCell>
                            <MicrocycleElevationForm
                              microcycleId={microcycle.id}
                              planId={plan.id}
                              locale={locale}
                              currentElevationGain={microcycle.targetElevationGain}
                              currentSource={microcycle.targetElevationSource}
                            />
                          </TableCell>
                          <TableCell>
                            <MicrocycleNotesForm
                              microcycleId={microcycle.id}
                              planId={plan.id}
                              locale={locale}
                              currentNotes={microcycle.notes}
                            />
                          </TableCell>
                          <TableCell>
                            <div className='flex justify-end'>
                              <MicrocycleVolumeForm
                                microcycleId={microcycle.id}
                                planId={plan.id}
                                locale={locale}
                                currentVolumeKm={microcycle.targetVolumeKm}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}

          {macrocycle.mesocycles.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Horizonte configurado</CardTitle>
                <CardDescription>
                  La estrategia y las fechas están guardadas. La progresión semanal se generará en el siguiente paso.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      ))}
    </div>
  )
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}
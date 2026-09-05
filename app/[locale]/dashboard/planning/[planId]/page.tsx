import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'

import { getGroupTrainingPlanById } from '@/app/actions/planning-actions'
import { MicrocycleDatesForm } from '@/features/planning/components/MicrocycleDatesForm'
import { MicrocycleElevationForm } from '@/features/planning/components/MicrocycleElevationForm'
import { MicrocycleNotesForm } from '@/features/planning/components/MicrocycleNotesForm'
import { MicrocycleTypeForm } from '@/features/planning/components/MicrocycleTypeForm'
import { MicrocycleVolumeForm } from '@/features/planning/components/MicrocycleVolumeForm'
import {
  IntensityDistribution,
  type IntensityDistributionPoint,
} from '@/features/planning/components/IntensityDistribution'
import {
  LoadProgressionPreview,
  type LoadProgressionPoint,
} from '@/features/planning/components/LoadProgressionPreview'
import {
  buildLoadProgressionPreview,
  determineTrainingProgressionEndDate,
} from '@/lib/periodization/load-progression-preview'
import type { AthleteGroupCode, LoadStrategyDraft } from '@/types'
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
          sessionsPerWeek: plan.loadStrategy.sessionsPerWeek,
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
        targetRace: previewMacrocycle.targetRaceName && previewMacrocycle.targetRaceDistanceKm
          ? {
              name: previewMacrocycle.targetRaceName,
              distanceKm: previewMacrocycle.targetRaceDistanceKm,
              ...(previewMacrocycle.targetRaceElevationGain === null
                ? {}
                : { elevationGain: previewMacrocycle.targetRaceElevationGain }),
            }
          : null,
        existingMicrocycles,
      })
    : null
  const previewPoints: LoadProgressionPoint[] = preview
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
          {previewMacrocycle?.targetRaceName && previewMacrocycle.targetRaceDistanceKm && (
            <p className='text-sm text-muted-foreground'>
              Carrera objetivo: {previewMacrocycle.targetRaceName} · {previewMacrocycle.targetRaceDistanceKm.toLocaleString('es-AR')} km
              {previewMacrocycle.targetRaceElevationGain === null ? '' : ` · +${previewMacrocycle.targetRaceElevationGain.toLocaleString('es-AR')} m`}
            </p>
          )}
        </div>
      </div>

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

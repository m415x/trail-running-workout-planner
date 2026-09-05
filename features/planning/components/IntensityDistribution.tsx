import { Activity, HeartPulse, TimerReset } from 'lucide-react'

import type {
  IntensityEmphasis,
  IntensityMethod,
  IntensityStrategyValueSource,
  IntensityZone,
  MicrocycleIntensityTargetFieldSources,
  MicrocycleType,
} from '@/types'
import { Badge } from '@ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card'

export interface IntensityDistributionPoint {
  microcycleId: string
  weekNumber: number
  type: MicrocycleType
  emphasis: IntensityEmphasis
  intenseSessionsTarget: number
  predominantZone: IntensityZone
  pamPercentageTarget: number | null
  minimumRecoveryDaysBetweenIntenseSessions: number
  fieldSources: MicrocycleIntensityTargetFieldSources
}

interface IntensityDistributionProps {
  points: IntensityDistributionPoint[]
  defaultMethod: IntensityMethod
  maximumIntenseSessionsPerWeek: number
  minimumRecoveryDaysBetweenIntenseSessions: number
  strategySources: Record<
    | 'defaultMethod'
    | 'maximumIntenseSessionsPerWeek'
    | 'minimumRecoveryDaysBetweenIntenseSessions',
    IntensityStrategyValueSource
  >
}

const microcycleLabels: Record<MicrocycleType, string> = {
  base: 'Base',
  development: 'Desarrollo',
  shock: 'Carga',
  deload: 'Descarga',
  tapering: 'Taper',
  race: 'Carrera',
}

const emphasisLabels: Record<IntensityEmphasis, string> = {
  recovery: 'Recuperación',
  aerobic: 'Aeróbico',
  tempo: 'Tempo',
  threshold: 'Umbral',
  vo2max: 'VO₂ máx.',
  race_specific: 'Específico de carrera',
}

function hasManualValue(sources: MicrocycleIntensityTargetFieldSources) {
  return Object.values(sources).some((source) => source === 'manual')
}

export function IntensityDistribution({
  points,
  defaultMethod,
  maximumIntenseSessionsPerWeek,
  minimumRecoveryDaysBetweenIntenseSessions,
  strategySources,
}: IntensityDistributionProps) {
  const manualStrategy = Object.values(strategySources).some((source) => source === 'manual')

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>Distribución de intensidad</CardTitle>
            <CardDescription>
              Objetivo semanal generado según el período, el microciclo y el objetivo del grupo.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>
              Método: {defaultMethod === 'pam_percentage' ? '% PAM' : 'Zonas FC'}
            </Badge>
            <Badge variant='outline'>Máximo: {maximumIntenseSessionsPerWeek} intensas</Badge>
            <Badge variant='outline'>Recuperación: {minimumRecoveryDaysBetweenIntenseSessions} d</Badge>
            {manualStrategy && <Badge variant='secondary'>Estrategia manual</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Guardá la progresión para generar los objetivos semanales de intensidad.
          </p>
        ) : (
          <div className='flex gap-3 overflow-x-auto pb-2'>
            {points.map((point) => (
              <div key={point.microcycleId} className='min-w-48 space-y-3 rounded-lg border p-4'>
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <p className='font-semibold'>Semana {point.weekNumber}</p>
                    <p className='text-xs text-muted-foreground'>
                      {microcycleLabels[point.type]} · {emphasisLabels[point.emphasis]}
                    </p>
                  </div>
                  {hasManualValue(point.fieldSources) && <Badge variant='secondary'>Manual</Badge>}
                </div>
                <div className='space-y-2 text-sm'>
                  <p className='flex items-center gap-2'>
                    <HeartPulse className='size-4 text-muted-foreground' />
                    <span><strong>{point.predominantZone}</strong> predominante</span>
                  </p>
                  <p className='flex items-center gap-2'>
                    <Activity className='size-4 text-muted-foreground' />
                    <span>
                      {point.intenseSessionsTarget === 0
                        ? 'Sin sesiones intensas'
                        : `${point.intenseSessionsTarget} ${point.intenseSessionsTarget === 1 ? 'sesión intensa' : 'sesiones intensas'}`}
                    </span>
                  </p>
                  {defaultMethod === 'pam_percentage' && point.pamPercentageTarget !== null && (
                    <p className='font-medium'>{point.pamPercentageTarget}% PAM</p>
                  )}
                  <p className='flex items-center gap-2 text-muted-foreground'>
                    <TimerReset className='size-4' />
                    <span>{point.minimumRecoveryDaysBetweenIntenseSessions} d de recuperación</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

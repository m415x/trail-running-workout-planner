import { useTranslations } from 'next-intl'
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
  referencePercentageTarget: number | null
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

const emphasisLabelKeys: Record<IntensityEmphasis, 'recovery' | 'aerobic' | 'tempo' | 'threshold' | 'vo2max' | 'race_specific'> = {
  recovery: 'recovery',
  aerobic: 'aerobic',
  tempo: 'tempo',
  threshold: 'threshold',
  vo2max: 'vo2max',
  race_specific: 'race_specific',
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
  const t = useTranslations('CoachPlanning')
  const manualStrategy = Object.values(strategySources).some((source) => source === 'manual')

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>{t('intensityTitle')}</CardTitle>
            <CardDescription>
              {t('intensityDistribution.description')}
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>
              {t('intensityDistribution.method')}: {defaultMethod === 'reference_percentage' ? t('intensityDistribution.referencePercentage') : t('intensityDistribution.heartRateZones')}
            </Badge>
            <Badge variant='outline'>{t('intensityDistribution.maxIntense', { count: maximumIntenseSessionsPerWeek })}</Badge>
            <Badge variant='outline'>{t('recoveryLabel')}: {minimumRecoveryDaysBetweenIntenseSessions} d</Badge>
            {manualStrategy && <Badge variant='secondary'>{t('intensityDistribution.manualStrategy')}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            {t('intensityDistribution.empty')}
          </p>
        ) : (
          <div className='flex gap-3 overflow-x-auto pb-2'>
            {points.map((point) => (
              <div key={point.microcycleId} className='min-w-48 space-y-3 rounded-lg border p-4'>
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <p className='font-semibold'>{t('intensityDistribution.week', { count: point.weekNumber })}</p>
                    <p className='text-xs text-muted-foreground'>
                      {t(`microcycleType.types.${point.type}`)} · {t(`intensityEmphasis.${emphasisLabelKeys[point.emphasis]}`)}
                    </p>
                  </div>
                  {hasManualValue(point.fieldSources) && <Badge variant='secondary'>{t('intensityDistribution.manual')}</Badge>}
                </div>
                <div className='space-y-2 text-sm'>
                  <p className='flex items-center gap-2'>
                    <HeartPulse className='size-4 text-muted-foreground' />
                    <span>{t('intensityDistribution.predominant', { zone: point.predominantZone })}</span>
                  </p>
                  <p className='flex items-center gap-2'>
                    <Activity className='size-4 text-muted-foreground' />
                    <span>
                      {point.intenseSessionsTarget === 0
                        ? t('intensityDistribution.noIntense')
                        : t('intensityDistribution.intenseSessions', { count: point.intenseSessionsTarget })}
                    </span>
                  </p>
                  {defaultMethod === 'reference_percentage' && point.referencePercentageTarget !== null && (
                    <p className='font-medium'>{point.referencePercentageTarget}% {t('intensityDistribution.referencePercentage')}</p>
                  )}
                  <p className='flex items-center gap-2 text-muted-foreground'>
                    <TimerReset className='size-4' />
                    <span>{t('intensityDistribution.recoveryDays', { count: point.minimumRecoveryDaysBetweenIntenseSessions })}</span>
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

'use client'

import { Activity } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CustomCard } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import { MetricBox } from '@profile/components/MetricBox'
import type { RunningReference } from '@/lib/physiology/running-reference'

export interface AthleteSelfPerformance {
  readonly reference: RunningReference
}

/**
 * Only the athlete-safe 1000 m RunningReference is disclosed here.
 * No hardcoded clinical metrics, zones or unapproved raw physiology fields.
 */
export function AthleteTabContent({ performance }: { performance?: AthleteSelfPerformance | null }) {
  const t = useTranslations('AthleteProfile.physiology')
  const reference = performance?.reference

  return (
    <div className='space-y-3 mt-2'>
      <CustomCard>
        <CardHeader title={t('title')} icon={Activity} />
        {reference?.status === 'available' ? (
          <div className='grid grid-cols-2 gap-2'>
            <MetricBox label='1000 m' value={`${reference.source.elapsedTimeSec} s`} />
            <MetricBox label='Ritmo 1000 m' value={reference.derived.paceLabel} />
            <MetricBox label='Velocidad media' value={`${reference.derived.averageSpeedKmh} km/h`} />
            <MetricBox label='Fecha de evaluación' value={reference.source.performedAt} />
          </div>
        ) : (
          <p className='text-sm text-muted-foreground' role='status'>
            {reference?.status === 'unknown' ? 'Sin referencia 1000 m disponible' : 'Referencia 1000 m no disponible'}
          </p>
        )}
      </CustomCard>
    </div>
  )
}

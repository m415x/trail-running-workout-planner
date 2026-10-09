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
export function AthleteTabContent({ performance, performanceStatus = 'unknown' }: { performance?: AthleteSelfPerformance | null; performanceStatus?: 'loaded' | 'unknown' | 'denied' | 'error' }) {
  const t = useTranslations('AthleteProfile.physiology')
  const reference = performance?.reference

  return (
    <div className='space-y-3 mt-2'>
      <CustomCard>
        <CardHeader title={t('title')} icon={Activity} />
        {reference?.status === 'available' ? (
          <div className='grid grid-cols-2 gap-2'>
            <MetricBox label={t('track1000mTime')} value={`${reference.source.elapsedTimeSec} s`} />
            <MetricBox label={t('track1000mPace')} value={reference.derived.paceLabel} />
            <MetricBox label={t('track1000mSpeed')} value={`${reference.derived.averageSpeedKmh} km/h`} />
            <MetricBox label={t('track1000mDate')} value={reference.source.performedAt} />
          </div>
        ) : (
          <p className='text-sm text-muted-foreground' role='status'>
            {performanceStatus === 'denied' ? t('track1000mDenied') : performanceStatus === 'error' ? t('track1000mError') : reference?.status === 'unknown' ? t('track1000mUnknown') : t('track1000mUnknown')}
          </p>
        )}
      </CustomCard>
    </div>
  )
}

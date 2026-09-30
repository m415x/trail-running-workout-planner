'use client'

import { Heart, Activity } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CustomCard } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import { ZoneRow } from '@profile/components/ZoneRow'
import { MetricBox } from '@profile/components/MetricBox'

const HR_ZONES = [
  { zone: 'Z1', nameKey: 'zones.z1', range: '< 132 ppm', color: 'bg-hr-z1' },
  { zone: 'Z2', nameKey: 'zones.z2', range: '132 – 150 ppm', color: 'bg-hr-z2' },
  { zone: 'Z3', nameKey: 'zones.z3', range: '151 – 165 ppm', color: 'bg-hr-z3' },
  { zone: 'Z4', nameKey: 'zones.z4', range: '166 – 178 ppm', color: 'bg-hr-z4' },
  { zone: 'Z5', nameKey: 'zones.z5', range: '> 178 ppm', color: 'bg-hr-z5' },
] as const

export function AthleteTabContent() {
  const t = useTranslations('AthleteProfile.physiology')
  return (
    <div className='space-y-3 mt-2'>
      <CustomCard>
        <CardHeader title={t('title')} icon={Activity} />
        <div className='grid grid-cols-2 gap-2'>
          <MetricBox label={t('weight')} value='72 kg' />
          <MetricBox label={t('maxHr')} value='188 ppm' />
          <MetricBox label={t('vo2max')} value='54 ml/kg' />
          <MetricBox label={t('height')} value='1.75 m' />
          <MetricBox label={t('restingHr')} value='46 ppm' />
          <MetricBox label={t('lactateThreshold')} value='172 ppm' />
        </div>
      </CustomCard>

      <CustomCard>
        <CardHeader title={t('zonesTitle')} icon={Heart} />
        <div className='space-y-2'>
          {HR_ZONES.map((zone) => (
            <ZoneRow key={zone.zone} zone={zone.zone} name={t(zone.nameKey)} range={zone.range} color={zone.color} />
          ))}
        </div>
      </CustomCard>
    </div>
  )
}

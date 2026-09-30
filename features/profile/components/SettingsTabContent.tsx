'use client'

import { ShieldAlert, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CustomCard, CustomCardInside } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import { Button } from '@ui/button'
import { MetricBox } from '@profile/components/MetricBox'

export function SettingsTabContent() {
  const t = useTranslations('AthleteProfile.settings')
  return (
    <div className='space-y-3 mt-2'>
      <CustomCard>
        <CardHeader title={t('emergencyTitle')} icon={ShieldAlert} />
        <CustomCardInside className='space-y-2'>
          <MetricBox label={t('sos')} value='María Doe (+54 9 264 555-0192)' />
          <MetricBox label={t('bloodType')} value='A Positivo (A+)' />
          <MetricBox label={t('insurance')} value='Federación de Atletismo #8839' />
        </CustomCardInside>
      </CustomCard>

      <Button
        variant='outline'
        className='w-full text-xs font-semibold text-muted-foreground hover:text-foreground border-border/80 rounded-2xl h-11'
      >
        <Settings size={14} className='mr-1.5' />
        {t('accountPreferences')}
        {/* TODO Selector de idioma y metrico/imperial */}
      </Button>
    </div>
  )
}

'use client'

import { useOptionalAthleteTypography } from '@/components/layout/MobileShell'
import { Heart, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { StatPillProps } from '@/types'
import { HrZoneConfig } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { CustomCardInside } from '@ui/custom/card-containers'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/popover'
import { PillButton } from '@ui/custom/buttons'

export function StatPill({ icon: Icon, label, value, unit, className }: StatPillProps) {
  return (
    <CustomCardInside key={label} className={cn('p-3 flex flex-col items-center', className)}>
      <Icon size={14} className='text-primary/70 mb-1.5' />

      <p className='font-heading text-foreground font-bold leading-none text-[length:var(--athlete-text-body-compact,0.75rem)] text-center'>
        {value}
        <span className='text-muted-foreground font-normal text-[length:var(--athlete-text-body-compact,0.75rem)] ml-1 whitespace-pre-line'>{unit}</span>
      </p>

      <p className='text-muted-foreground text-[length:var(--athlete-text-caption,0.625rem)] uppercase mt-1'>{label}</p>
    </CustomCardInside>
  )
}

interface ZonePillProps {
  zoneInfo: HrZoneConfig
  bpmRange?: string
}

export function ZonePill({ zoneInfo, bpmRange }: ZonePillProps) {
  const preference = useOptionalAthleteTypography()?.preference
  const t = useTranslations('DomainGlossary.heartRateZones')
  const zoneKey = zoneInfo.code

  return (
    <Popover>
      <PopoverTrigger
        render={
          <PillButton
            icon={Heart}
            value={zoneInfo.code}
            subtitle={zoneInfo.pct}
            iconClassName={zoneInfo.styles.text}
            valueClassName={zoneInfo.styles.text}
            subtitleClassName={cn('whitespace-nowrap', zoneInfo.styles.textMuted)}
            className={cn('w-auto min-w-17', zoneInfo.styles.bg, zoneInfo.styles.border)}
          />
        }
      />

      <PopoverContent
        data-athlete-typography={preference}
        className={cn(preference && 'athlete-typography', 'w-auto sm:w-72 p-2 bg-popover/95 backdrop-blur-md border-border/50 rounded-[var(--radius-ept-overlay)] shadow-[var(--elevation-ept-overlay)]')}
        align='end'
      >
        <div className='space-y-2 p-1'>
          <div className='flex items-start gap-2'>
            <span
              className={cn(
                'size-7 rounded-lg font-heading font-bold text-[length:var(--athlete-text-title,0.75rem)] flex items-center justify-center',
                zoneInfo.styles.badgeBg,
                'text-primary-foreground',
              )}
            >
              {zoneInfo.code}
            </span>
            <div>
              <p className='font-heading font-bold text-[length:var(--athlete-text-title,0.75rem)] text-foreground leading-tight'>{t(`${zoneKey}.name`)}</p>
              <p className={cn('text-[length:var(--athlete-text-caption,0.75rem)] font-bold', zoneInfo.styles.text)}>{bpmRange}</p>
            </div>
          </div>
          <div className='p-2.5 rounded-lg bg-background/70 border border-border/40 text-[length:var(--athlete-text-body-compact)] space-y-1.5'>
            <p className='font-semibold text-foreground/90 text-[length:var(--athlete-text-caption)] flex items-center gap-1.5'>
              <Info size={12} className={cn('text-primary', zoneInfo.styles.text)} />
              {t('effortLabel')} (RPE {zoneInfo.rpe})
            </p>
            <p className='text-muted-foreground text-[length:var(--athlete-text-caption)]'>{t(`${zoneKey}.effortAndPerception`)}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

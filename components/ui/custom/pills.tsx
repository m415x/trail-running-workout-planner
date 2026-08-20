'use client'

import { Heart, Info } from 'lucide-react'
import { IntensityZone, StatPillProps } from '@/types'
import { HR_ZONES, HrZoneConfig } from '@/utils/constants'
import { getZoneBpmRange } from '@/lib/physiology/heart-rate'
import { cn } from '@/lib/utils'
import { CustomCardInside } from '@/components/ui/custom/card-containers'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PillButton } from '@/components/ui/custom/buttons'

export function StatPill({ icon: Icon, label, value, unit, className }: StatPillProps) {
  return (
    <CustomCardInside key={label} className={cn('p-3 flex flex-col items-center', className)}>
      <Icon size={14} className='text-primary/70 mb-1.5' />

      <p className='font-heading text-foreground font-bold leading-none text-base'>
        {value}
        <span className='text-muted-foreground font-normal text-xs ml-1'>{unit}</span>
      </p>

      <p className='text-muted-foreground text-[10px] mt-1'>{label}</p>
    </CustomCardInside>
  )
}

interface ZonePillProps {
  zoneInfo: HrZoneConfig
  bpmRange?: string
}

export function ZonePill({ zoneInfo, bpmRange }: ZonePillProps) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={
          <PillButton
            icon={Heart}
            value={zoneInfo.code}
            subtitle={zoneInfo.pct}
            iconClassName={zoneInfo.styles.text}
            valueClassName={zoneInfo.styles.text}
            subtitleClassName={zoneInfo.styles.textMuted}
            className={cn(zoneInfo.styles.bg, zoneInfo.styles.border)}
          />
        }
      />

      <PopoverContent className='mr-11  w-64 sm:w-72 p-3 bg-popover/95 backdrop-blur-md border-border/50 rounded-2xl shadow-xl'>
        <div className='space-y-2'>
          <div className='flex items-start gap-2'>
            <span
              className={cn(
                'size-7 rounded-lg font-heading font-bold text-xs flex items-center justify-center',
                zoneInfo.styles.badgeBg,
                'text-white',
              )}
            >
              {zoneInfo.code}
            </span>
            <div>
              <p className='font-heading font-bold text-xs text-foreground leading-tight'>{zoneInfo.name}</p>
              <p className={cn('text-xs font-bold', zoneInfo.styles.text)}>{bpmRange}</p>
            </div>
          </div>
          <div className='p-2.5 rounded-lg bg-background/70 border border-border/40 text-xs space-y-1.5'>
            <p className='font-semibold text-foreground/90 text-[11px] flex items-center gap-1.5'>
              <Info size={12} className={cn('text-primary', zoneInfo.styles.text)} />
              Sensación de Esfuerzo (RPE {zoneInfo.rpe})
            </p>
            <p className='text-muted-foreground text-[11px]'>{zoneInfo.effortAndPerception}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

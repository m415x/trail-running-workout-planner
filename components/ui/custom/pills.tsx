'use client'

import { Heart, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IntensityZone, StatPillProps } from '@/types'
import { CustomCardInside } from '@/components/ui/custom/card-containers'
import { HR_ZONES } from '@/utils/constants'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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

export function ZonePill({ zone, maxHr = 190 }: { zone: IntensityZone; maxHr?: number }) {
  // Fallback a Z1 si la zona no coincide
  const zoneInfo = HR_ZONES[zone] ?? HR_ZONES.Z1

  const calculateBpmRange = (pct: string, maxHr: number) => {
    const [minPct, maxPct] = pct.replace('%', '').split('-').map(Number)
    const minBpm = Math.round((minPct / 100) * maxHr)
    const maxBpm = Math.round((maxPct / 100) * maxHr)
    return `${minBpm} - ${maxBpm} bpm`
  }

  const bpmRange = calculateBpmRange(zoneInfo.pct, maxHr)

  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={
          <CustomCardInside
            className={cn(
              'flex flex-col items-center rounded-xl w-17 p-3 border shadow-none transition-all cursor-pointer hover:scale-105 active:scale-98',
              zoneInfo.styles.bg,
              zoneInfo.styles.border,
            )}
          >
            <Heart size={13} className={cn('mb-1', zoneInfo.styles.text)} />
            <span className={cn('font-heading text-2xl font-black leading-none', zoneInfo.styles.text)}>{zone}</span>
            <span className={cn('text-[9px] font-medium mt-0.5', zoneInfo.styles.textMuted)}>{zoneInfo.pct}</span>
          </CustomCardInside>
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
              {zone}
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

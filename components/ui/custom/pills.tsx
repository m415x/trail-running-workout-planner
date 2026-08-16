'use client'

import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hrZone } from '@/features/workouts/types/workout.types'
import { StatPillProps } from '@/types/ui.types'
import { CustomCardInside } from '@/components/ui/custom/card-containers'
import { HR_ZONES } from '@/utils/constants'

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

export function ZonePill({ zone }: { zone: hrZone }) {
  // Fallback a Z1 si la zona no coincide
  const zoneInfo = HR_ZONES[zone] ?? HR_ZONES.Z1

  return (
    <CustomCardInside
      className={cn(
        'flex flex-col items-center rounded-ml w-17 p-3 border shadow-none transition-colors',
        zoneInfo.styles.bg,
        zoneInfo.styles.border,
      )}
    >
      <Heart size={13} className={cn('mb-1', zoneInfo.styles.text)} />

      <span className={cn('font-heading text-2xl font-black leading-none', zoneInfo.styles.text)}>{zone}</span>

      <span className={cn('text-[9px] font-medium mt-0.5', zoneInfo.styles.textMuted)}>{zoneInfo.pct}</span>
    </CustomCardInside>
  )
}

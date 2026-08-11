'use client'

import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatPillProps } from '@/utils/interfaces'
import { CustomCardInside } from '@/components/ui/custom/card-containers'
import { ZONE_STYLES } from '@/utils/constants'

export function StatPill({ icon: Icon, label, value, unit }: StatPillProps) {
  return (
    <CustomCardInside key={label} className='font-barlow p-3 flex flex-col items-center'>
      <Icon size={14} className='text-primary/70 mb-1.5' />

      <p className='text-foreground font-bold leading-none text-base'>
        {value}
        <span className='text-muted-foreground font-normal text-[14px] ml-0.5'>{unit}</span>
      </p>

      <p className='text-muted-foreground text-[12px] mt-1'>{label}</p>
    </CustomCardInside>
  )
}

export function ZonePill({ zone, pct }: { zone: string; pct: string }) {
  // Fallback a Z1 si la zona no coincide
  const style = ZONE_STYLES[zone] ?? ZONE_STYLES.Z1

  return (
    <CustomCardInside
      className={cn(
        'flex flex-col items-center rounded-ml w-17 p-3 border shadow-none transition-colors',
        style.bg,
        style.border,
      )}
    >
      <Heart size={13} className={cn('mb-1', style.text)} />

      <span className={cn('font-barlow text-2xl font-black leading-none', style.text)}>{zone}</span>

      <span className={cn('text-[9px] font-medium mt-0.5', style.textMuted)}>{pct}</span>
    </CustomCardInside>
  )
}

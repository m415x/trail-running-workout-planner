'use client'

import { Heart } from 'lucide-react'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { ZONE_STYLES } from '@/utils/constants'
import { cn } from '@/lib/utils'

export function ZonePill({ zone, pct }: { zone: string; pct: string }) {
  // Fallback a Z1 si la zona no coincide
  const style = ZONE_STYLES[zone] ?? ZONE_STYLES.Z1

  return (
    <CustomCard
      className={cn(
        'flex flex-col items-center rounded-2xl w-19 px-4 py-3 border shadow-none transition-colors',
        style.bg,
        style.border,
      )}
    >
      <Heart size={13} className={cn('mb-1', style.text)} />

      <span className={cn('font-barlow text-xl font-black leading-none', style.text)}>{zone}</span>

      <span className={cn('text-[9px] font-medium mt-0.5', style.textMuted)}>{pct}</span>
    </CustomCard>
  )
}

'use client'

import { Heart } from 'lucide-react'
import { colors } from '@/utils/constants'

export function ZonePill({ zone, pct }: { zone: string; pct: string }) {
  const isSpeed = zone === 'Z4' || zone === 'Z5'
  const color = isSpeed ? '#FBBF24' : colors.EMERALD
  return (
    <div
      className='flex flex-col items-center rounded-2xl px-4 py-3 border'
      style={{
        background: `${color}18`,
        borderColor: `${color}30`,
      }}
    >
      <Heart size={13} style={{ color }} className='mb-1' />
      <span className='text-xl font-black leading-none' style={{ color, fontFamily: "'Barlow Condensed', sans-serif" }}>
        {zone}
      </span>
      <span className='text-[9px] font-medium mt-0.5' style={{ color: `${color}99` }}>
        {pct}
      </span>
    </div>
  )
}

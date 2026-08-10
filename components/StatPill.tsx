'use client'

import { StatPillProps } from '@/utils/interfaces'
import { CustomCard } from '@/components/ui/custom/card-containers'

export function StatPill({ icon: Icon, label, value, unit }: StatPillProps) {
  return (
    <CustomCard
      key={label}
      className='font-barlow rounded-2xl p-3 bg-secondary/50 border border-border/40 items-center flex flex-col'
    >
      <Icon size={14} className='text-muted-foreground mb-1.5' />

      <p className='text-foreground font-bold leading-none text-base'>
        {value}
        <span className='text-muted-foreground font-normal text-[14px] ml-0.5'>{unit}</span>
      </p>

      <p className='text-muted-foreground text-[12px] mt-1'>{label}</p>
    </CustomCard>
  )
}

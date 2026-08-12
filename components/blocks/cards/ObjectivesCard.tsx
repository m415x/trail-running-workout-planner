'use client'

import { CustomCard } from '@/components/ui/custom/card-containers'

export function ObjectivesCard() {
  return (
    <CustomCard className='flex-row items-center justify-between bg-linear-to-r from-primary/20 to-primary/10 border-primary/20'>
      <div>
        <p className='text-muted-foreground text-[11px] mb-1'>Objetivo del macrociclo</p>
        <p className='font-heading text-foreground font-bold text-[20px] leading-tight'>Carrera 10 km</p>
        <p className='text-muted-foreground text-[11px] mt-1'>El Parque Team · PAM 1.000 m</p>
      </div>
      <div className='text-right'>
        <p className='text-muted-foreground text-[11px] mb-1'>Vol. total ciclo</p>
        <p className='font-heading font-black text-primary text-[38px] leading-none'>170</p>
        <p className='text-muted-foreground text-xs'>km</p>
      </div>
    </CustomCard>
  )
}

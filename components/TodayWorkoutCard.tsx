'use client'

import { SportShoe, ChevronRight, Clock, TrendingUp, Zap } from 'lucide-react'
import { TodayWorkoutCardProps } from '@/utils/interfaces'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { Button } from '@/components/ui/button'
import { ZonePill } from '@/components/ZonePill'

export function TodayWorkoutCard({ workout, onViewMap }: TodayWorkoutCardProps) {
  const stats = [
    { icon: Clock, label: 'Tiempo est.', value: workout.time, unit: 'min' },
    { icon: TrendingUp, label: 'Desnivel+', value: workout.gain, unit: 'm' },
    { icon: Zap, label: 'Ritmo obj.', value: workout.pace, unit: '/km' },
  ]

  return (
    <CustomCard>
      <CardHeader
        title='Entrenamiento del Día'
        icon={SportShoe}
        action={
          <Button
            className='p-0 flex items-center gap-1 text-[11px] font-medium text-orange-500 hover:text-orange-400 transition-colors'
            variant='link'
            onClick={onViewMap}
          >
            Ver mapa
            <ChevronRight />
          </Button>
        }
      />

      {/* Main stat row */}

      <CustomCard className='rounded-2xl p-4 mb-3 flex items-center gap-3 bg-secondary/50 border border-border/40'>
        {/* <div className='rounded-2xl p-4 mb-3 flex items-center gap-3 bg-secondary/50 border border-border/40'> */}
        <div className='flex-1'>
          <div className='flex items-baseline gap-1.5'>
            <span className='font-barlow font-black text-foreground leading-none text-5xl tracking-tight'>
              {workout.km}
            </span>

            <span className='font-barlow text-xl font-semibold text-muted-foreground'>km</span>
          </div>

          <p className='text-muted-foreground text-xs mt-1'>{workout.title}</p>
        </div>

        <ZonePill zone={workout.zone} pct={workout.zonePct} />
      </CustomCard>

      {/* Stats row */}

      <div className='grid grid-cols-3 gap-2 mb-3'>
        {stats.map(({ icon: Icon, label, value, unit }) => (
          <div key={label} className='font-barlow rounded-2xl p-3 bg-secondary/50 border border-border/40'>
            <Icon size={13} className='text-muted-foreground mb-1.5' />
            <p className='text-foreground font-bold leading-none text-base'>
              {value}
              <span className='text-muted-foreground font-normal text-[12px] ml-0.5'>{unit}</span>
            </p>

            <p className='text-muted-foreground text-[10px] mt-1'>{label}</p>
          </div>
        ))}
      </div>

      {/* Coach note */}

      <div className='rounded-2xl p-3 bg-orange-500/10 border border-orange-500/20'>
        <p className='font-bold uppercase tracking-wider mb-1.5 text-[10px] text-orange-500'>Nota del Entrenador</p>

        <p className='text-foreground/80 text-xs leading-relaxed'>{workout.notes}</p>
      </div>
    </CustomCard>
  )
}

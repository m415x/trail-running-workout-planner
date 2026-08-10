'use client'

import { SportShoe, ChevronRight, Clock, TrendingUp, Zap } from 'lucide-react'
import { TodayWorkoutCardProps } from '@/utils/interfaces'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { Button } from '@/components/ui/button'
import { ZonePill } from '@/components/ZonePill'
import { StatPill } from '@/components/StatPill'

export function TodayWorkoutCard({ workout, onViewMap }: TodayWorkoutCardProps) {
  const stats = [
    { icon: Clock, label: 'Tiempo est.', value: workout.time, unit: 'min' },
    { icon: TrendingUp, label: 'Desnivel+', value: workout.gain, unit: 'm' },
    { icon: Zap, label: 'Ritmo obj.', value: workout.pace, unit: '/km' },
  ]

  return (
    <CustomCard>
      {/* Header */}
      <CardHeader title='Entrenamiento del Día' icon={SportShoe}>
        <Button
          className='p-0 flex items-center gap-1 text-[11px] font-medium hover:no-underline cursor-pointer text-orange-500 hover:text-orange-400 transition-colors'
          variant='link'
          onClick={onViewMap}
        >
          Ver mapa
          <ChevronRight />
        </Button>
      </CardHeader>

      {/* Main stat row */}
      <CustomCard className='rounded-2xl p-4 mb-3 flex items-center gap-3 bg-secondary/50 border border-border/40'>
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
          <StatPill key={label} icon={Icon} label={label} value={value} unit={unit} />
        ))}
      </div>

      {/* Coach note */}
      <CustomCard className='rounded-2xl p-3 bg-orange-500/10 border border-orange-500/20'>
        <p className='font-bold uppercase tracking-wider mb-1.5 text-[10px] text-orange-500'>Nota del Entrenador</p>

        <p className='text-foreground/80 text-xs leading-relaxed'>{workout.notes}</p>
      </CustomCard>
    </CustomCard>
  )
}

'use client'

import { SportShoe, ChevronRight, Clock, TrendingUp, Zap } from 'lucide-react'
import { TodayWorkoutCardProps } from '@/utils/interfaces'
import { CustomCard, CustomCardInside } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { LinkButton } from '@/components/ui/custom/buttons'
import { StatPill, ZonePill } from '@/components/ui/custom/pills'

export function TodayWorkoutCard({ workout, onViewMap }: TodayWorkoutCardProps) {
  const stats = [
    { icon: Clock, label: 'Tiempo est.', value: workout.time, unit: 'min' },
    { icon: TrendingUp, label: 'Desnivel+', value: workout.gain, unit: 'm' },
    { icon: Zap, label: 'Ritmo obj.', value: workout.pace, unit: '/km' },
  ]

  return (
    <CustomCard>
      {/* Header row */}
      <CardHeader title='Entrenamiento del Día' icon={SportShoe}>
        <LinkButton onClick={onViewMap}>
          Ver mapa
          <ChevronRight />
        </LinkButton>
      </CardHeader>

      {/* Main stat row */}
      <CustomCardInside className='flex items-center'>
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
      </CustomCardInside>

      {/* Stats row */}
      <div className='grid grid-cols-3 gap-3'>
        {stats.map(({ icon: Icon, label, value, unit }) => (
          <StatPill key={label} icon={Icon} label={label} value={value} unit={unit} />
        ))}
      </div>

      {/* Coach note */}
      <CustomCardInside className='p-3 bg-primary/10 border-primary/20'>
        <p className='font-bold uppercase tracking-wider mb-1.5 text-[10px] text-primary'>Nota del Entrenador</p>

        <p className='text-foreground/80 text-xs leading-relaxed'>{workout.notes}</p>
      </CustomCardInside>
    </CustomCard>
  )
}

'use client'

import { SportShoe, Clock, Gauge, Zap } from 'lucide-react'
import { TodayWorkoutCardProps } from '@/utils/interfaces'
import { CustomCard, CustomCardInside } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill, ZonePill } from '@/components/ui/custom/pills'
import { formatPace, paceToSpeed } from '@/utils/formatters'

export function TodayWorkoutCard({ workout, dateLabel }: TodayWorkoutCardProps) {
  const stats = [
    { icon: Clock, label: 'Tiempo est.', value: workout.time, unit: 'min' },
    { icon: Zap, label: 'Ritmo medio', value: formatPace(workout.pace), unit: '/km' },
    { icon: Gauge, label: 'Vel. media', value: paceToSpeed(workout.pace), unit: 'km/h' },
  ]

  return (
    <CustomCard>
      {/* Header row */}
      <CardHeader title='Entrenamiento del Día' icon={SportShoe}>
        <span className='font-mono text-muted-foreground text-xs'>{dateLabel}</span>
      </CardHeader>

      {/* Main stat row */}
      <CustomCardInside className='flex items-center'>
        <div className='flex-1'>
          <div className='flex items-baseline gap-1.5'>
            <span className='font-heading font-black text-foreground leading-none text-5xl tracking-tight'>
              {workout.km}
            </span>

            <span className='font-heading text-xl font-semibold text-muted-foreground'>km</span>
          </div>

          <p className='text-muted-foreground text-xs mt-1'>{workout.title}</p>
        </div>

        <ZonePill zone={workout.zone} />
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

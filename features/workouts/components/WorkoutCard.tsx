'use client'

import { SportShoe, Clock, Gauge, Zap, Trophy } from 'lucide-react'
import { TodayWorkoutCardProps, WorkoutProps } from '@/types/interfaces'
import { CustomCard, CustomCardInside } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill, ZonePill } from '@/components/ui/custom/pills'
import { formatPace, paceToSpeed } from '@/utils/formatters'
import { formatShortDate } from '@/utils/date-helpers'

export function TodayWorkoutCard({ workout, date }: TodayWorkoutCardProps) {
  const dateLabel = date ? formatShortDate(date) : ''

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

export interface RaceCardProps {
  date?: string
  workout?: WorkoutProps | null
}

export function RaceCard({ workout, date }: RaceCardProps) {
  const dateLabel = date ? formatShortDate(date) : ''

  // Valores con fallback seguro si workout es null/undefined
  const raceTitle = workout?.title ?? 'Día de Carrera'
  const raceKm = workout?.km ?? 0
  const raceTime = workout?.time ?? 0
  const racePace = workout?.pace ?? 0
  const raceZone = workout?.zone ?? 'Z5'
  const raceNotes = workout?.notes ?? 'Día del evento principal. ¡A darlo todo!'

  const stats = [
    { icon: Clock, label: 'Tiempo est.', value: raceTime, unit: 'min' },
    { icon: Zap, label: 'Ritmo medio', value: formatPace(racePace), unit: '/km' },
    { icon: Gauge, label: 'Vel. media', value: paceToSpeed(racePace), unit: 'km/h' },
  ]

  return (
    <CustomCard className='bg-emerald-500/10 border-emerald-500/20'>
      {/* Header row */}
      <CardHeader title={raceTitle} icon={Trophy}>
        <span className='font-mono text-muted-foreground text-xs'>{dateLabel}</span>
      </CardHeader>

      {/* Main stat row */}
      <CustomCardInside className='flex items-center'>
        <div className='flex-1'>
          <div className='flex items-baseline gap-1.5'>
            <span className='font-heading font-black text-foreground leading-none text-5xl tracking-tight'>
              {raceKm}
            </span>

            <span className='font-heading text-xl font-semibold text-muted-foreground'>km</span>
          </div>
        </div>

        <ZonePill zone={raceZone} />
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

        <p className='text-foreground/80 text-xs leading-relaxed'>{raceNotes}</p>
      </CustomCardInside>
    </CustomCard>
  )
}

export function RestCard() {}

'use client'

import { SportShoe, Clock, Gauge, Zap, Trophy, CheckCircle, Coffee } from 'lucide-react'
import { WorkoutProps } from '@/features/workouts/types/workout.types'
import { GpxData } from '@/lib/gpx/gpx-parser'
import { CustomCard, CustomCardInside } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill, ZonePill } from '@/components/ui/custom/pills'
import { Button } from '@/components/ui/button'
import { formatPace, paceToSpeed } from '@/utils/formatters'
import { LogWorkoutDialog } from '@/features/workouts/components/LogWorkoutDialog'
import { WeatherPillStrip } from '@/features/workouts/components/WeatherPillStrip'
import { useWorkoutCard } from '@/features/workouts/hooks/useWorkoutCard'

export interface WorkoutCardProps {
  workout: WorkoutProps
  date?: string
  gpxData?: GpxData | null
}

export function TodayWorkoutCard({ workout, date, gpxData }: WorkoutCardProps) {
  const {
    dateLabel,
    isLogOpen,
    weather,
    isLoadingWeather,
    isPast,
    stats,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
  } = useWorkoutCard({ workout, date, gpxData })

  return (
    <>
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

        {/* Barra meteorológica */}
        {!isPast && <WeatherPillStrip weather={weather} isLoading={isLoadingWeather} />}

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

        {/* Botón para Registrar */}
        <Button
          type='button'
          onClick={openLogDialog}
          className='w-full h-10 rounded-xl text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-all active:scale-98 cursor-pointer gap-2 mt-1 shadow-xs'
        >
          <CheckCircle size={15} />
          <span>Registrar entrenamiento realizado</span>
        </Button>
      </CustomCard>

      {/* Modal de Registro */}
      <LogWorkoutDialog
        isOpen={isLogOpen}
        onClose={closeLogDialog}
        workout={workout}
        dateStr={date}
        onSave={handleSaveSession}
      />
    </>
  )
}

export function RaceCard({ workout, date }: WorkoutCardProps) {
  const { dateLabel, weather, isLoadingWeather, isPast } = useWorkoutCard({ workout, date })

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
      <CardHeader title={raceTitle} icon={Trophy}>
        <span className='font-mono text-muted-foreground text-xs'>{dateLabel}</span>
      </CardHeader>

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

      {/* Barra meteorológica */}
      {!isPast && <WeatherPillStrip weather={weather} isLoading={isLoadingWeather} />}

      <div className='grid grid-cols-3 gap-3'>
        {stats.map(({ icon: Icon, label, value, unit }) => (
          <StatPill key={label} icon={Icon} label={label} value={value} unit={unit} />
        ))}
      </div>

      <CustomCardInside className='p-3 bg-primary/10 border-primary/20'>
        <p className='font-bold uppercase tracking-wider mb-1.5 text-[10px] text-primary'>Nota del Entrenador</p>
        <p className='text-foreground/80 text-xs leading-relaxed'>{raceNotes}</p>
      </CustomCardInside>
    </CustomCard>
  )
}

export function RestCard() {
  return (
    <CustomCard className='items-center py-6'>
      <Coffee className='text-muted-foreground' size={22} />
      <p className='font-heading font-semibold text-foreground text-sm mt-1'>Día de Descanso</p>
      <p className='text-xs text-muted-foreground mt-0.5 font-sans'>Sin rutina programada. Aprovecha para recuperar.</p>
    </CustomCard>
  )
}

'use client'

import { CheckCircle, Coffee, Edit } from 'lucide-react'
import { WorkoutCardProps } from '@/types'
import { CustomCard, CustomCardInside } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill, ZonePill } from '@/components/ui/custom/pills'
import { PrimaryFilledButton, GlassFilledButton } from '@/components/ui/custom/buttons'
import { LogWorkoutDialog } from '@/features/workouts/components/LogWorkoutDialog'
import { WeatherPillStrip } from '@/features/workouts/components/WeatherPillStrip'
import { useWorkoutCard } from '@/features/workouts/hooks/useWorkoutCard'
import { useTranslations } from 'next-intl'

export function TodayWorkoutCard({ workout, date, gpxData }: WorkoutCardProps) {
  const {
    WorkoutIcon,
    headerTitle,
    dateLabel,
    isLogOpen,
    weather,
    isLoadingWeather,
    isPast,
    isLogged,
    stats,
    zoneInfo,
    bpmRange,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
    handleDeleteSession,
  } = useWorkoutCard({ workout, date, gpxData })

  return (
    <>
      <CustomCard>
        {/* Header row */}
        <CardHeader title={headerTitle} icon={WorkoutIcon}>
          <span className='font-mono text-muted-foreground text-xs'>{dateLabel}</span>
        </CardHeader>

        {/* Main stat row */}
        <CustomCardInside className='flex items-center'>
          <div className='flex-1'>
            <div className='flex items-baseline gap-1.5'>
              <span className='font-heading font-black text-foreground leading-none text-5xl tracking-tight'>
                {workout.distance}
              </span>
              <span className='font-heading text-xl font-semibold text-muted-foreground'>km</span>
            </div>
            <p className='text-muted-foreground text-xs mt-1'>{workout.title}</p>
          </div>

          <ZonePill zoneInfo={zoneInfo} bpmRange={bpmRange} />
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
        <CustomCardInside className='bg-linear-to-t from-secondary/10 to-secondary/1 border-secondary/20'>
          <p className='font-bold uppercase tracking-wider mb-1.5 text-xs text-secondary'>Nota del Entrenador</p>
          <p className='text-foreground/80 text-xs leading-relaxed'>{workout.notes}</p>
        </CustomCardInside>

        {/* Botón para Registrar */}
        {isLogged ? (
          <GlassFilledButton onClick={openLogDialog} className='rounded-xl text-xs active:scale-98'>
            <Edit />
            <span>Editar registro</span>
          </GlassFilledButton>
        ) : (
          <PrimaryFilledButton onClick={openLogDialog} className='rounded-xl text-xs active:scale-98'>
            <CheckCircle />
            <span>Registrar entrenamiento</span>
          </PrimaryFilledButton>
        )}
      </CustomCard>

      {/* Modal de Registro */}
      <LogWorkoutDialog
        key={workout.id}
        isOpen={isLogOpen}
        onClose={closeLogDialog}
        workout={workout}
        dateStr={date}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
      />
    </>
  )
}

export function RaceCard({ workout, date, gpxData }: WorkoutCardProps) {
  const {
    WorkoutIcon,
    headerTitle,
    dateLabel,
    isLogOpen,
    weather,
    isLoadingWeather,
    isPast,
    isLogged,
    stats,
    zoneInfo,
    bpmRange,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
    handleDeleteSession,
  } = useWorkoutCard({ workout, date, gpxData })

  return (
    <>
      <CustomCard className='bg-emerald-500/10 border-emerald-500/20'>
        <CardHeader title={headerTitle} icon={WorkoutIcon}>
          <span className='font-mono text-muted-foreground text-xs'>{dateLabel}</span>
        </CardHeader>

        <CustomCardInside className='flex items-center'>
          <div className='flex-1'>
            <div className='flex items-baseline gap-1.5'>
              <span className='font-heading font-black text-foreground leading-none text-5xl tracking-tight'>
                {workout.distance}
              </span>
              <span className='font-heading text-xl font-semibold text-muted-foreground'>km</span>
            </div>
          </div>

          <ZonePill zoneInfo={zoneInfo} bpmRange={bpmRange} />
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
        {isLogged ? (
          <GlassFilledButton onClick={openLogDialog} className='rounded-xl text-xs active:scale-98'>
            <Edit />
            <span>Editar registro</span>
          </GlassFilledButton>
        ) : (
          <PrimaryFilledButton onClick={openLogDialog} className='rounded-xl text-xs active:scale-98'>
            <CheckCircle />
            <span>Registrar carrera</span>
          </PrimaryFilledButton>
        )}
      </CustomCard>

      {/* Modal de Registro */}
      <LogWorkoutDialog
        key={workout.id}
        isOpen={isLogOpen}
        onClose={closeLogDialog}
        workout={workout}
        dateStr={date}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
      />
    </>
  )
}

export function RestCard() {
  const t = useTranslations('Workouts')

  return (
    <CustomCard className='items-center py-6'>
      <Coffee className='text-muted-foreground' size={22} />
      <p className='font-heading font-semibold text-foreground text-sm mt-1'>{t('types.Rest')}</p>
      <p className='text-xs text-muted-foreground mt-0.5 font-sans'>{t('card.restMessage')}</p>
    </CustomCard>
  )
}

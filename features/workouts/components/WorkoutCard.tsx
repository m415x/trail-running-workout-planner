'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle, Coffee, Edit } from 'lucide-react'
import { WorkoutCardProps } from '@/types'
import { CustomCard, CustomCardInside } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import { StatPill, ZonePill } from '@ui/custom/pills'
import { PrimaryFilledButton, GlassFilledButton } from '@ui/custom/buttons'
import { LogWorkoutDialog } from '@workouts/components/LogWorkoutDialog'
import { WeatherPillStrip } from '@workouts/components/WeatherPillStrip'
import { useWorkoutCard } from '@workouts/hooks/useWorkoutCard'

interface BaseWorkoutCardProps extends WorkoutCardProps {
  cardClassName?: string
  showSubtitle?: boolean
  actionButtonLabel?: string
}

export function BaseWorkoutCard({
  workout,
  date,
  TrackData,
  cardClassName,
  showSubtitle = true,
  actionButtonLabel = 'Registrar entrenamiento',
}: BaseWorkoutCardProps) {
  const {
    WorkoutIcon,
    headerTitle,
    dateLabel,
    isLogOpen,
    weather,
    isLoadingWeather,
    isPast,
    isFuture,
    isLogged,
    stats,
    zoneInfo,
    bpmRange,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
    handleDeleteSession,
  } = useWorkoutCard({ workout, date, TrackData })

  return (
    <>
      <CustomCard className={cardClassName}>
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
            {showSubtitle && workout.title && <p className='text-muted-foreground text-xs mt-1'>{workout.title}</p>}
          </div>

          <ZonePill zoneInfo={zoneInfo} bpmRange={bpmRange} />
        </CustomCardInside>

        {/* Barra meteorológica */}
        {!isPast && <WeatherPillStrip weather={weather} isLoading={isLoadingWeather} />}

        {/* Stats row */}
        <div className='grid grid-cols-3 gap-2'>
          {stats.map(({ icon: Icon, label, value, unit }) => (
            <StatPill key={label} icon={Icon} label={label} value={value} unit={unit} />
          ))}
        </div>

        {/* Coach note */}
        {workout.notes && (
          <CustomCardInside className='bg-linear-to-t from-secondary/10 to-secondary/1 border-secondary/20'>
            <p className='font-bold uppercase tracking-wider mb-1.5 text-xs text-secondary'>Nota del Entrenador</p>
            <p className='text-foreground/80 text-xs leading-relaxed'>{workout.notes}</p>
          </CustomCardInside>
        )}

        {/* Botón para Registrar (Solo visible hoy o en el pasado) */}
        {!isFuture && (
          <>
            {isLogged ? (
              <GlassFilledButton onClick={openLogDialog} className='rounded-xl text-xs active:scale-98'>
                <Edit />
                <span>Editar registro</span>
              </GlassFilledButton>
            ) : (
              <PrimaryFilledButton onClick={openLogDialog} className='rounded-xl text-xs active:scale-98'>
                <CheckCircle />
                <span>{actionButtonLabel}</span>
              </PrimaryFilledButton>
            )}
          </>
        )}
      </CustomCard>

      {/* Modal de Registro */}
      <LogWorkoutDialog
        key={workout?.id ?? date}
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

/* -------------------------------------------------------------------------- */
/* Componentes Especializados (Wrappers Livianos)                             */
/* -------------------------------------------------------------------------- */

export function TodayWorkoutCard(props: WorkoutCardProps) {
  return <BaseWorkoutCard {...props} />
}

export function RaceCard(props: WorkoutCardProps) {
  return (
    <BaseWorkoutCard
      {...props}
      cardClassName='bg-emerald-500/10 border-emerald-500/20'
      showSubtitle={false}
      actionButtonLabel='Registrar carrera'
    />
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

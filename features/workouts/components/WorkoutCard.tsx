'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircleIcon, CoffeeIcon, PlusCircleIcon } from '@phosphor-icons/react'
import type { ManualRealizedTrainingClientInput, RealizedTrainingRecord, WorkoutCardProps } from '@/types'
import { createManualRealizedTrainingAction } from '@/app/actions/realized-training-actions'
import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'
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
  onRealizedTrainingSaved?: (record: RealizedTrainingRecord) => void
}

export function BaseWorkoutCard({
  workout,
  date,
  TrackData,
  cardClassName,
  showSubtitle = true,
  actionButtonLabel,
  onRealizedTrainingSaved,
}: BaseWorkoutCardProps) {
  const t = useTranslations('Workouts')
  const common = useTranslations('Common')
  const shouldPrioritizeTerrainEffort = workout.type === 'Trail' || workout.type === 'Hills' || (TrackData?.maxGradePct ?? 0) > 0
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
    isCaptureReady,
    canEditLoggedWorkout,
    editableCaptureInput,
    stats,
    zoneInfo,
    bpmRange,
    executionGuidance,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
  } = useWorkoutCard({ workout, date, TrackData, onRealizedTrainingSaved })

  return (
    <>
      <CustomCard className={cardClassName}>
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
            {showSubtitle && workout.title && <p className='text-muted-foreground text-xs mt-1'>{workout.title}</p>}
          </div>

          <ZonePill zoneInfo={zoneInfo} bpmRange={bpmRange} />
        </CustomCardInside>

        {!isPast && <WeatherPillStrip weather={weather} isLoading={isLoadingWeather} />}

        <div className='grid grid-cols-3 gap-2'>
          {stats.map(({ icon: Icon, label, value, unit }) => (
            <StatPill key={label} icon={Icon} label={label} value={value} unit={unit} />
          ))}
        </div>

        {executionGuidance.quality?.status === 'available' && !shouldPrioritizeTerrainEffort && (
          <CustomCardInside className='space-y-1 text-xs'>
            <p className='font-medium text-foreground'>{executionGuidance.quality.intensityPercentage}% · {executionGuidance.quality.paceLabel}</p>
            <p className='text-muted-foreground'>{executionGuidance.quality.averageSpeedKmh} km/h</p>
          </CustomCardInside>
        )}

        {workout.notes && (
          <CustomCardInside className='bg-linear-to-t from-secondary/10 to-secondary/1 border-secondary/20'>
            <p className='font-bold uppercase tracking-wider mb-1.5 text-xs text-secondary'>{t('card.coachNote')}</p>
            <p className='text-foreground/80 text-xs leading-relaxed'>{workout.notes}</p>
          </CustomCardInside>
        )}

        {!isFuture && (
          <>
            {isLogged ? (
              <GlassFilledButton
                disabled={!canEditLoggedWorkout}
                onClick={canEditLoggedWorkout ? openLogDialog : undefined}
                className='rounded-xl text-xs active:scale-98'
              >
                <CheckCircleIcon />
                <span>{canEditLoggedWorkout ? common('edit') : t('card.logged')}</span>
              </GlassFilledButton>
            ) : (
              <PrimaryFilledButton disabled={!isCaptureReady} onClick={openLogDialog} className='rounded-xl text-xs active:scale-98'>
                <CheckCircleIcon />
                <span>{actionButtonLabel ?? t('card.logWorkoutButton')}</span>
              </PrimaryFilledButton>
            )}
          </>
        )}
      </CustomCard>

      <LogWorkoutDialog
        key={workout?.id ?? date}
        isOpen={isLogOpen}
        onClose={closeLogDialog}
        workout={workout}
        dateStr={date}
        initialInput={editableCaptureInput}
        onSave={handleSaveSession}
      />
    </>
  )
}

export function TodayWorkoutCard(props: BaseWorkoutCardProps) {
  return <BaseWorkoutCard {...props} />
}

export function RaceCard(props: BaseWorkoutCardProps) {
  return (
    <BaseWorkoutCard
      {...props}
      cardClassName='bg-emerald-500/10 border-emerald-500/20'
      showSubtitle={false}
    />
  )
}

interface RestCardProps {
  date?: string
  onRealizedTrainingSaved?: (record: RealizedTrainingRecord) => void
}

/**
 * Rest days can still contain realized training. A free capture is persisted with
 * no Session/Workout link, so it contributes to athlete load/readiness without
 * being misrepresented as compliance with an official session.
 */
export function RestCard({ date, onRealizedTrainingSaved }: RestCardProps = {}) {
  const t = useTranslations('Workouts')
  const [isLogOpen, setIsLogOpen] = useState(false)
  const today = getCurrentISODateInTimeZone()
  const isFuture = Boolean(date && date > today)

  const handleSaveFreeWorkout = async (input: ManualRealizedTrainingClientInput) => {
    const result = await createManualRealizedTrainingAction({
      ...input,
      sessionId: null,
      workoutId: null,
    })
    if (!result.success) return false
    onRealizedTrainingSaved?.(result.data)
    return true
  }

  return (
    <>
      <CustomCard className='items-center py-6'>
        <CoffeeIcon className='text-muted-foreground' size={22} />
        <p className='font-heading font-semibold text-foreground text-sm mt-1'>{t('types.Rest')}</p>
        <p className='text-xs text-muted-foreground mt-0.5 font-sans'>{t('card.restMessage')}</p>
        {date && !isFuture && (
          <PrimaryFilledButton onClick={() => setIsLogOpen(true)} className='rounded-xl text-xs mt-3 active:scale-98'>
            <PlusCircleIcon />
            <span>{t('card.logWorkoutButton')}</span>
          </PrimaryFilledButton>
        )}
      </CustomCard>

      <LogWorkoutDialog
        key={`free-${date ?? 'undated'}`}
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        workout={null}
        dateStr={date}
        onSave={handleSaveFreeWorkout}
      />
    </>
  )
}

'use client'

import { currentUser } from '@/data/data'
import { HomeHeaderNav } from '@/features/workouts/components/HomeHeaderNav'
import { WeeklyCalendarCard } from '@/features/workouts/components/WeeklyCalendarCard'
import { TodayWorkoutCard, RaceCard } from '@/features/workouts/components/WorkoutCard'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { ElevationProfileCard } from '@/features/workouts/components/ElevationProfileCard'
import { RouteMapCard } from '@/features/workouts/components/RouteMapCard'
import { Coffee } from 'lucide-react'
import { useDashboard } from '@/features/workouts/hooks/useDashboard'

export function HomeTab() {
  const {
    weeklyCycle,
    weekDays,
    selectedDay,
    selectedWeekDay,
    currentWorkout,
    elevationChartData,
    gpxData,
    onSelectDay,
  } = useDashboard()

  return (
    <>
      {/* Header */}
      <HomeHeaderNav user={currentUser} />

      <div className='space-y-4'>
        {/* ── Weekly Calendar Card ── */}
        <WeeklyCalendarCard
          cycle={weeklyCycle}
          weekDays={weekDays}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />

        {/* ── Tarjeta del Día Seleccionado ── */}
        {selectedWeekDay?.type === 'Race' ? (
          <RaceCard date={selectedWeekDay.fullDate} workout={currentWorkout} />
        ) : currentWorkout ? (
          <TodayWorkoutCard workout={currentWorkout} date={selectedWeekDay?.fullDate ?? '2026-08-13'} />
        ) : (
          /* Placeholder estilizado para días de descanso */
          <CustomCard className='items-center'>
            <Coffee className='text-muted-foreground' />
            <p className='font-heading font-semibold text-foreground text-sm'>Día de Descanso</p>
            <p className='text-xs text-muted-foreground mt-0.5 font-sans'>
              Sin rutina programada. Aprovecha para recuperar.
            </p>
          </CustomCard>
        )}

        {/* ── Perfil de Elevación ── */}
        {elevationChartData && <ElevationProfileCard {...elevationChartData} />}

        {/* ── Mapa Interactivo del Track GPS ── */}
        {currentWorkout && elevationChartData && (
          <RouteMapCard
            mapKey={selectedWeekDay?.fullDate}
            title={currentWorkout.title}
            distanceKm={gpxData?.distanceKm ?? currentWorkout.km}
            gainMeters={gpxData?.gainMeters ?? currentWorkout.gain}
            maxGradePct={gpxData?.maxGradePct ?? 0}
            positions={gpxData?.positions ?? []}
          />
        )}

        {/* ── Objetivos del Microciclo ── */}
        {/* <ObjectivesCard /> */}
      </div>
    </>
  )
}

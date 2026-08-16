'use client'

import { useDashboard } from '@/features/workouts/hooks/useDashboard'
import { HomeHeaderNav } from '@/features/workouts/components/HomeHeaderNav'
import { WeeklyCalendarCard } from '@/features/workouts/components/WeeklyCalendarCard'
import { TodayWorkoutCard, RaceCard } from '@/features/workouts/components/WorkoutCard'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { ElevationProfileCard } from '@/features/workouts/components/ElevationProfileCard'
import { RouteMapCard } from '@/features/workouts/components/RouteMapCard'
import { Coffee } from 'lucide-react'

//! TODO Refactorizar hooks , interfaces, etc en sus correspondientes archivos. Añadir clima (icono, Tmax/Tmin) y mas info en campanita

export function HomeTab() {
  const {
    user,
    weeklyCycle,
    weekDays,
    selectedDay,
    selectedDate,
    selectedWeekDay,
    currentWorkout,
    elevationChartData,
    gpxData,
    onSelectDay,
    onPrevWeek,
    onNextWeek,
    onSelectDate,
  } = useDashboard()

  return (
    <div className='space-y-4'>
      {/* Header Superior */}
      <HomeHeaderNav user={user} />

      {/* Tarjeta de Calendario Semanal con Slider & Popover DatePicker */}
      <WeeklyCalendarCard
        cycle={weeklyCycle}
        weekDays={weekDays}
        selectedDay={selectedDay}
        selectedDate={selectedDate}
        onSelectDay={onSelectDay}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
        onSelectDate={onSelectDate}
      />

      {/* Tarjeta del Día Seleccionado */}
      {selectedWeekDay?.type === 'Race' ? (
        <RaceCard date={selectedWeekDay.fullDate} workout={currentWorkout} />
      ) : currentWorkout ? (
        <TodayWorkoutCard workout={currentWorkout} date={selectedWeekDay?.fullDate} />
      ) : (
        <CustomCard className='items-center py-6'>
          <Coffee className='text-muted-foreground' size={22} />
          <p className='font-heading font-semibold text-foreground text-sm mt-1'>Día de Descanso</p>
          <p className='text-xs text-muted-foreground mt-0.5 font-sans'>
            Sin rutina programada. Aprovecha para recuperar.
          </p>
        </CustomCard>
      )}

      {/* Perfil de Elevación */}
      {elevationChartData && <ElevationProfileCard {...elevationChartData} />}

      {/* Mapa Interactivo del Track GPS */}
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
    </div>
  )
}

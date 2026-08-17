'use client'

import { useHomeTab } from '@/features/workouts/hooks/useHomeTab'
import { HomeHeader } from '@/features/workouts/components/HomeHeader'
import { WeeklyCalendarCard } from '@/features/workouts/components/WeeklyCalendarCard'
import { TodayWorkoutCard, RaceCard, RestCard } from '@/features/workouts/components/WorkoutCard'
import { ElevationProfileCard } from '@/features/workouts/components/ElevationProfileCard'
import { RouteMapCard } from '@/features/workouts/components/RouteMapCard'

export function HomeTab() {
  const {
    team,
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
  } = useHomeTab()

  return (
    <div className='space-y-4'>
      {/* Header Superior */}
      <HomeHeader team={team} user={user} />

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
        <RestCard />
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

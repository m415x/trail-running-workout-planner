'use client'

import { useHomeTab } from '@workouts/hooks/useHomeTab'
import { HomeHeader } from '@workouts/components/HomeHeader'
import { WeeklyCalendarCard } from '@workouts/components/WeeklyCalendarCard'
import { TodayWorkoutCard, RaceCard, RestCard } from '@workouts/components/WorkoutCard'
import { ElevationProfileCard } from '@workouts/components/ElevationProfileCard'
// import { RouteMapCard } from '@workouts/components/RouteMapCard'

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
    TrackData,
    onSelectDay,
    onPrevWeek,
    onNextWeek,
    onSelectDate,
  } = useHomeTab()

  return (
    <div className='space-y-2'>
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
      {selectedWeekDay?.type === 'Race' && currentWorkout ? (
        <RaceCard date={selectedWeekDay.fullDate} workout={currentWorkout} />
      ) : currentWorkout ? (
        <TodayWorkoutCard workout={currentWorkout} date={selectedWeekDay?.fullDate} TrackData={TrackData} />
      ) : (
        <RestCard />
      )}

      {/* Perfil de Elevación */}
      {elevationChartData && <ElevationProfileCard {...elevationChartData} />}

      {/* Mapa Interactivo del Track GPS */}
      {/* currentWorkout && elevationChartData && (
        <RouteMapCard
          mapKey={selectedWeekDay?.fullDate}
          title={currentWorkout.title}
          distanceKm={TrackData?.distanceKm ?? currentWorkout.distance}
          gainMeters={TrackData?.gainMeters ?? currentWorkout.gain}
          maxGradePct={TrackData?.maxGradePct ?? 0}
          trackPoints={TrackData?.trackPoints ?? []}
        />
      )*/}
    </div>
  )
}

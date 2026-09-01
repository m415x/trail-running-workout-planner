'use client'

import { useHomeTab } from '@workouts/hooks/useHomeTab'
import { HomeHeader } from '@workouts/components/HomeHeader'
import { WeeklyCalendarCard } from '@workouts/components/WeeklyCalendarCard'
import { TodayWorkoutCard, RaceCard, RestCard } from '@workouts/components/WorkoutCard'
import { ElevationProfileCard } from '@workouts/components/ElevationProfileCard'
import { RouteMapCard } from '@workouts/components/RouteMapCard'
import { getWeeklySchedule } from '@/app/actions/dashboard-actions'
import { Team } from '@/types'

export function HomeTab({ initialAthlete, initialSchedule, locale }: any) {
  // 1. Definimos la función que se ejecutará al cambiar de semana
  const handleWeekChange = async (startDateIso: string) => {
    const res = await getWeeklySchedule(startDateIso)
    return res.success && res.data ? res.data : []
  }

  // 2. Pasamos handleWeekChange al hook
  const {
    team,
    user,
    athlete,
    weeklyCycle,
    weekDays,
    selectedDay,
    selectedDate,
    selectedWeekDay,
    currentWorkout,
    elevationChartData,
    TrackData,
    isLoadingWeek,
    onSelectDay,
    onPrevWeek,
    onNextWeek,
    onSelectDate,
  } = useHomeTab({
    initialSchedule,
    initialAthlete,
    onWeekChange: handleWeekChange, // ✅ ¡Ahora sí está definido!
  })

  if (isLoadingWeek) return <div className='p-4'>Cargando semana...</div>

  const fallbackTeam: Team = {
    id: 'default',
    name: 'Sin Equipo',
    description: 'Atleta independiente',
    avatarLight: '/default-avatar.png',
    avatarDark: '/default-avatar.png',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  }

  return (
    <div className='space-y-2'>
      {/* Header Superior */}
      <HomeHeader team={team || fallbackTeam} athlete={athlete} />

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
      {currentWorkout && elevationChartData && (
        <RouteMapCard
          title={currentWorkout.title}
          distanceKm={TrackData?.distanceKm ?? currentWorkout.distance}
          gainMeters={TrackData?.gainMeters ?? currentWorkout.gain}
          maxGradePct={TrackData?.maxGradePct ?? 0}
          trackPoints={TrackData?.trackPoints ?? []}
        />
      )}
    </div>
  )
}

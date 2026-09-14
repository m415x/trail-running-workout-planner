'use client'

import { SessionWithWorkout, useHomeTab, UseHomeTabProps } from '@workouts/hooks/useHomeTab'
import { HomeHeader } from '@workouts/components/HomeHeader'
import { WeeklyCalendarCard } from '@workouts/components/WeeklyCalendarCard'
import { TodayWorkoutCard, RaceCard, RestCard } from '@workouts/components/WorkoutCard'
import { ElevationProfileCard } from '@workouts/components/ElevationProfileCard'
import { RouteMapCard } from '@workouts/components/RouteMapCard'
import { getWeeklySchedule } from '@/app/actions/dashboard-actions'
import { getCurrentAthleteRealizedTrainingRangeAction } from '@/app/actions/realized-training-actions'
import { Team } from '@/types'

interface HomeTabProps {
  initialAthlete: UseHomeTabProps['initialAthlete']
  initialSchedule: SessionWithWorkout[]
  initialRealizedTraining: UseHomeTabProps['initialRealizedTraining']
  locale: string
}

export function HomeTab({ initialAthlete, initialSchedule, initialRealizedTraining }: HomeTabProps) {
  const handleWeekChange = async (startDateIso: string) => {
    const result = await getWeeklySchedule(startDateIso)
    return result.success && result.data ? result.data : []
  }

  const handleRealizedTrainingWeekChange = async (startDateIso: string, endDateIso: string) => {
    const result = await getCurrentAthleteRealizedTrainingRangeAction(startDateIso, endDateIso)
    return result.success ? result.data : []
  }

  const {
    team,
    athlete,
    weeklyCycle,
    weekDays,
    selectedDay,
    selectedDate,
    selectedWeekDay,
    currentWorkout,
    currentWorkouts,
    elevationChartData,
    TrackData,
    onSelectDay,
    onPrevWeek,
    onNextWeek,
    onSelectDate,
  } = useHomeTab({
    initialSchedule,
    initialRealizedTraining,
    initialAthlete,
    onWeekChange: handleWeekChange,
    onRealizedTrainingWeekChange: handleRealizedTrainingWeekChange,
  })

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
      <HomeHeader team={team || fallbackTeam} athlete={athlete} />

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

      {currentWorkouts.length > 0 ? (
        <div className='space-y-2'>
          {currentWorkouts.map((workout, index) => workout.type === 'Race' ? (
            <RaceCard key={workout.id} date={selectedWeekDay?.fullDate} workout={workout} />
          ) : (
            <TodayWorkoutCard
              key={workout.id}
              workout={workout}
              date={selectedWeekDay?.fullDate}
              TrackData={index === 0 ? TrackData : null}
            />
          ))}
        </div>
      ) : <RestCard />}

      {elevationChartData && <ElevationProfileCard {...elevationChartData} />}

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

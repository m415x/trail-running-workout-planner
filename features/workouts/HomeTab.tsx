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
import { getCurrentAthleteTrack1000mPerformanceAction } from '@/app/actions/field-performance-test-actions'
import type { RunningReference } from '@/lib/physiology/running-reference'
import { useEffect, useState } from 'react'

interface HomeTabProps {
  initialAthlete: UseHomeTabProps['initialAthlete']
  initialSchedule: SessionWithWorkout[]
  initialRealizedTraining: UseHomeTabProps['initialRealizedTraining']
  locale: string
  runningReference: RunningReference
}

export function HomeTab({ initialAthlete, initialSchedule, initialRealizedTraining, locale, runningReference: initialRunningReference }: HomeTabProps) {
  const [runningReference, setRunningReference] = useState<RunningReference>(initialRunningReference)

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
    onRealizedTrainingSaved,
  } = useHomeTab({
    initialSchedule,
    initialRealizedTraining,
    initialAthlete,
    locale,
    onWeekChange: handleWeekChange,
    onRealizedTrainingWeekChange: handleRealizedTrainingWeekChange,
  })

  useEffect(() => {
    const effectiveDate = selectedWeekDay?.fullDate
    if (!effectiveDate) {
      setRunningReference({ status: 'unknown' })
      return
    }

    let active = true
    getCurrentAthleteTrack1000mPerformanceAction(effectiveDate)
      .then(result => {
        if (active) {
          setRunningReference(result.success ? result.data.reference : { status: 'unknown' })
        }
      })
      .catch(() => {
        if (active) setRunningReference({ status: 'unknown' })
      })

    return () => {
      active = false
    }
  }, [selectedWeekDay?.fullDate])

  const fallbackTeam: Team = {
    id: 'default',
    name: '—',
    description: '',
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
            <RaceCard
              key={workout.id}
              date={selectedWeekDay?.fullDate}
              workout={workout}
              onRealizedTrainingSaved={onRealizedTrainingSaved}
            />
          ) : (
            <TodayWorkoutCard
              key={workout.id}
              workout={{ ...workout, runningReference }}
              date={selectedWeekDay?.fullDate}
              TrackData={index === 0 ? TrackData : null}
              onRealizedTrainingSaved={onRealizedTrainingSaved}
            />
          ))}
        </div>
      ) : (
        <RestCard
          date={selectedWeekDay?.fullDate}
          onRealizedTrainingSaved={onRealizedTrainingSaved}
        />
      )}

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

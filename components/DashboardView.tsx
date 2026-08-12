'use client'

import { useState, useMemo } from 'react'
import { weekDays, workouts, elevationProfiles } from '@/utils/constants'
import { formatShortDate } from '@/utils/date-helpers'
import { ElevationChartProps } from '@/utils/interfaces'
import { Header } from '@/components/blocks/Header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WeeklyCalendarCard } from '@/components/blocks/cards/WeeklyCalendarCard'
import { TodayWorkoutCard } from '@/components/blocks/cards/TodayWorkoutCard'
import { ElevationProfileCard } from '@/components/blocks/cards/ElevationProfileCard'
import { RouteMapCard } from '@/components/blocks/cards/RouteMapCard'
import { ObjectivesCard } from '@/components/blocks/cards/ObjectivesCard'
import { BottomNavigationBar } from '@/components/blocks/BottomNavigationBar'

export default function DashboardView() {
  const [selectedDay, setSelectedDay] = useState<number>(1) // Martes seleccionado por defecto (índice 1)

  // Calcular los km completados dinámicamente según los días marcados con done: true
  const currentKm = useMemo(() => {
    return weekDays.reduce((total, day) => (day.done ? total + day.km : total), 0)
  }, [])

  const selectedDateLabel = useMemo(() => {
    const dayData = weekDays[selectedDay]
    return formatShortDate(selectedDay, dayData.date, 7) // 7 = Agosto
  }, [selectedDay])

  const elevationChartData: ElevationChartProps = useMemo(() => {
    const workout = workouts[selectedDay] ?? workouts[1]
    const elevData = elevationProfiles[selectedDay] ?? elevationProfiles[1]

    const elevMin = Math.min(...elevData.map((d) => d.elev))
    const elevMax = Math.max(...elevData.map((d) => d.elev))
    const yDomain = [Math.floor(elevMin - 50), Math.ceil(elevMax + 50)]

    return {
      workout,
      elevData,
      elevMin,
      elevMax,
      yDomain,
    }
  }, [selectedDay])

  return (
    <div className='min-h-screen bg-black flex items-start justify-center'>
      {/* Phone shell */}
      <div className='w-full max-w-97.5 min-h-screen flex flex-col relative overflow-hidden bg-background'>
        {/* Header */}
        <Header />

        {/* Scrollable content */}
        <ScrollArea className='flex-1 w-full'>
          <div className='px-4 pt-1 pb-21.5 space-y-4'>
            {/* ── Weekly Calendar Card ── */}
            <WeeklyCalendarCard
              title='Microciclo #32'
              phase='Choque'
              targetKm={45}
              currentKm={currentKm}
              dateRange='Ago 10–16'
              weekDays={weekDays}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />

            {/* ── Today's Workout Card ── */}
            <TodayWorkoutCard workout={elevationChartData.workout} dateLabel={selectedDateLabel} />

            {/* ── Elevation Profile Card ── */}
            <ElevationProfileCard {...elevationChartData} />

            {/* ── Nueva Card de Track GPS / Mapa ── */}
            <RouteMapCard
              name='Ruta Antenas - San Juan'
              distanceKm={elevationChartData.workout.km}
              gainMeters={elevationChartData.workout.gain}
              maxGradePct={14}
              onUploadGpx={() => console.log('Abrir selector de archivos GPX')}
            />

            {/* ── Objectives Card ── */}
            <ObjectivesCard />
          </div>
        </ScrollArea>

        {/* ── Bottom Navigation ── */}
        <BottomNavigationBar />
      </div>
    </div>
  )
}

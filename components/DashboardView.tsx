'use client'

import { useState, useMemo } from 'react'
import { weekDays, workouts, elevationProfiles } from '@/utils/constants'
import { ElevationChartProps } from '@/utils/interfaces'
import { Header } from '@/components/blocks/Header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WeeklyCalendarCard } from '@/components/blocks/cards/WeeklyCalendarCard'
import { TodayWorkoutCard } from '@/components/blocks/cards/TodayWorkoutCard'
import { ElevationProfileCard } from '@/components/blocks/cards/ElevationProfileCard'
import { ObjectivesCard } from '@/components/blocks/cards/ObjectivesCard'
import { BottomNavigationBar } from '@/components/blocks/BottomNavigationBar'

export default function DashboardView() {
  const [selectedDay, setSelectedDay] = useState<number>(1) // Martes seleccionado por defecto (índice 1)

  // Calcular los km completados dinámicamente según los días marcados con done: true
  const currentKm = useMemo(() => {
    return weekDays.reduce((total, day) => (day.done ? total + day.km : total), 0)
  }, [])

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
    <div className='min-h-screen bg-[#070B11] flex items-start justify-center'>
      {/* Phone shell */}
      <div className='w-full max-w-97.5 min-h-screen flex flex-col relative overflow-hidden bg-background'>
        {/* Header */}
        <Header />

        {/* Scrollable content */}
        <ScrollArea>
          <div className='flex-1 overflow-y-auto px-4 pb-28 space-y-3'>
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
            <TodayWorkoutCard workout={elevationChartData.workout} onViewMap={() => console.log('Abrir mapa')} />

            {/* ── Elevation Profile Card ── */}
            <ElevationProfileCard {...elevationChartData} />

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

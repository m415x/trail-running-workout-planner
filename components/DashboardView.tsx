'use client'

// Componentes de Bloques / UI
import { HeaderNav } from '@/components/blocks/HeaderNav'
import { ScrollArea } from '@/components/ui/scroll-area'
import { WeeklyCalendarCard } from '@/components/blocks/cards/WeeklyCalendarCard'
import { TodayWorkoutCard, RaceCard } from '@/components/blocks/cards/WorkoutCard'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { ElevationProfileCard } from '@/components/blocks/cards/ElevationProfileCard'
import { RouteMapCard } from '@/components/blocks/cards/RouteMapCard'
// import { ObjectivesCard } from '@/components/blocks/cards/ObjectivesCard'
import { BottomNavigationBar } from '@/components/blocks/BottomNavigationBar'
import { Coffee } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'

export default function DashboardView() {
  const {
    user,
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
    <div className='min-h-screen bg-black flex items-start justify-center'>
      {/* Phone shell */}
      <div className='w-full max-w-97.5 min-h-screen flex flex-col relative overflow-hidden bg-background'>
        {/* Header */}
        <HeaderNav user={user} />

        {/* Scrollable content */}
        <ScrollArea className='flex-1 w-full'>
          <div className='px-4 pt-1 pb-21.5 space-y-4'>
            {/* ── Weekly Calendar Card ── */}
            <WeeklyCalendarCard
              cycle={weeklyCycle}
              weekDays={weekDays}
              selectedDay={selectedDay}
              onSelectDay={onSelectDay}
            />

            {/* ── Tarjeta del Día Seleccionado ── */}
            {selectedWeekDay?.type === 'Race' ? (
              <RaceCard
                date={selectedWeekDay.fullDate}
                workout={currentWorkout} // Si la carrera tiene datos cargados
              />
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

            {/* ── Perfil de Elevación (si hay datos de elevación disponibles) ── */}
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
        </ScrollArea>

        {/* ── Bottom Navigation Fixed ── */}
        <BottomNavigationBar />
      </div>
    </div>
  )
}

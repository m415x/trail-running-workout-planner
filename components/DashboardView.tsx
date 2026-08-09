'use client'

import { useState, useMemo } from 'react'
import { Bell, CheckCircle2 } from 'lucide-react'
import { colors, weekDays, workouts, elevationProfiles, navItems } from '@/utils/constants'
import { ElevationChartProps } from '@/utils/interfaces'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'
import { ElevationProfileCard } from '@/components/ElevationProfileCard'

export default function DashboardView() {
  const [activeNav, setActiveNav] = useState<number>(0)
  const [selectedDay, setSelectedDay] = useState<number>(1)

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
  // }, [selectedDay, workouts, elevationProfiles])

  return (
    <div className='min-h-screen bg-[#070B11] flex items-start justify-center'>
      {/* Phone shell */}
      <div
        className='w-full max-w-[390px] min-h-screen flex flex-col relative overflow-hidden'
        style={{ background: 'var(--background)' }}
      >
        {/* Header */}
        <div className='px-5 pt-14 pb-3 flex items-center justify-between'>
          <div>
            <p
              className='text-muted-foreground text-[11px] font-medium tracking-widest uppercase'
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Martes · 11 Agosto 2026
            </p>
            <h1
              className='text-foreground text-[28px] font-bold mt-0.5 leading-tight'
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Hola, Cristian
            </h1>
          </div>
          <button className='relative p-2 rounded-2xl border border-border bg-card'>
            <Bell size={18} className='text-muted-foreground' />
            <span
              className='absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2'
              style={{ background: colors.ORANGE, borderColor: 'var(--card)' }}
            />
          </button>
        </div>

        {/* Scrollable content */}
        <div className='flex-1 overflow-y-auto px-4 pb-28 space-y-3' style={{ scrollbarWidth: 'none' }}>
          {/* ── Weekly Calendar Card ── */}
          <div className='bg-card rounded-3xl p-4 border border-border'>
            <div className='flex items-center justify-between mb-3'>
              <div>
                <h2
                  className='text-foreground text-[19px] font-bold leading-tight'
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Microciclo #32
                </h2>
                <p className='text-muted-foreground text-[11px] mt-0.5' style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Fase Choque · objetivo 45 km
                </p>
              </div>
              <span
                className='text-[11px] font-semibold px-3 py-1.5 rounded-full'
                style={{
                  color: colors.ORANGE,
                  background: `${colors.ORANGE}18`,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Ago 10–16
              </span>
            </div>

            {/* Day columns */}
            <div className='grid grid-cols-7 gap-1'>
              {weekDays.map((d, i) => {
                const isSelected = selectedDay === i
                const hasWorkout = !d.isRest
                return (
                  <button
                    key={i}
                    onClick={() => hasWorkout && setSelectedDay(i)}
                    disabled={d.isRest}
                    className='flex flex-col items-center rounded-[18px] py-2.5 px-1 transition-all duration-200'
                    style={{
                      background: isSelected
                        ? colors.ORANGE
                        : d.isToday && !isSelected
                          ? 'rgba(255,90,26,0.12)'
                          : 'transparent',
                      boxShadow: isSelected ? `0 6px 20px ${colors.ORANGE}40` : 'none',
                    }}
                  >
                    <span
                      className='text-[10px] font-semibold mb-1.5'
                      style={{
                        color: isSelected ? 'white' : 'var(--muted-foreground)',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {d.day}
                    </span>
                    <span
                      className='text-[15px] font-bold'
                      style={{
                        color: isSelected ? 'white' : d.isToday ? 'var(--foreground)' : 'rgba(240,244,248,0.6)',
                        fontFamily: "'Barlow Condensed', sans-serif",
                      }}
                    >
                      {d.date}
                    </span>
                    <div className='mt-1.5 h-2 flex items-center justify-center'>
                      {d.done ? (
                        <CheckCircle2 size={9} color={colors.EMERALD} />
                      ) : hasWorkout ? (
                        <span
                          className='w-1.5 h-1.5 rounded-full'
                          style={{
                            background: isSelected
                              ? 'rgba(255,255,255,0.7)'
                              : d.type === 'Long'
                                ? `${colors.ORANGE}80`
                                : 'rgba(255,255,255,0.2)',
                          }}
                        />
                      ) : (
                        <span className='w-1.5 h-1.5' />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Weekly progress */}
            <div className='mt-4'>
              <div className='flex justify-between text-[11px] mb-2' style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <span className='text-muted-foreground'>Progreso semanal</span>
                <span className='text-foreground font-semibold'>
                  8 km <span className='text-muted-foreground font-normal'>/ 45 km</span>
                </span>
              </div>
              <div className='h-1.5 rounded-full overflow-hidden' style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className='h-full rounded-full transition-all duration-500'
                  style={{
                    width: '17.8%',
                    background: `linear-gradient(90deg, ${colors.ORANGE}, #FF8C42)`,
                  }}
                />
              </div>
            </div>
          </div>
          {/* ── Today's Workout Card ── */}
          <TodayWorkoutCard workout={elevationChartData.workout} onViewMap={() => console.log('Abrir mapa')} />
          {/* ── Elevation Profile Card ── */}
          <ElevationProfileCard {...elevationChartData} />
          {/* ── Objectives Banner ── */}
          <div
            className='rounded-3xl p-4 flex items-center justify-between'
            style={{
              background: `linear-gradient(135deg, ${colors.ORANGE}22, ${colors.ORANGE}08)`,
              border: `1px solid ${colors.ORANGE}25`,
            }}
          >
            <div>
              <p className='text-muted-foreground text-[11px] mb-1' style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Objetivo del macrociclo
              </p>
              <p
                className='text-foreground font-bold text-[20px] leading-tight'
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Carrera 10 km
              </p>
              <p className='text-muted-foreground text-[11px] mt-1' style={{ fontFamily: "'DM Sans', sans-serif" }}>
                El Parque Team · PAM 1.000 m
              </p>
            </div>
            <div className='text-right'>
              <p className='text-muted-foreground text-[11px] mb-1' style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Vol. total ciclo
              </p>
              <p
                className='font-black text-[38px] leading-none'
                style={{ color: colors.ORANGE, fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                170
              </p>
              <p className='text-muted-foreground text-[11px]' style={{ fontFamily: "'DM Sans', sans-serif" }}>
                km
              </p>
            </div>
          </div>
        </div>

        {/* ── Bottom Navigation ── */}
        <div
          className='absolute bottom-0 left-0 right-0 border-t border-border px-2 pb-8 pt-3'
          style={{ background: 'rgba(20,25,34,0.96)', backdropFilter: 'blur(20px)' }}
        >
          <div className='flex items-center justify-around'>
            {navItems.map(({ icon: Icon, label }, i) => {
              const isCenter = i === 2
              const isActive = activeNav === i
              return (
                <button
                  key={i}
                  onClick={() => setActiveNav(i)}
                  className='flex flex-col items-center gap-1 transition-all duration-200'
                  style={{
                    ...(isCenter
                      ? {
                          background: colors.ORANGE,
                          borderRadius: '50%',
                          width: 52,
                          height: 52,
                          marginTop: -22,
                          boxShadow: `0 8px 24px ${colors.ORANGE}50`,
                          justifyContent: 'center',
                          display: 'flex',
                          alignItems: 'center',
                        }
                      : {}),
                  }}
                >
                  <Icon
                    size={isCenter ? 22 : 20}
                    style={{
                      color: isCenter ? 'white' : isActive ? colors.ORANGE : '#64748B',
                    }}
                  />
                  {!isCenter && (
                    <span
                      className='font-medium'
                      style={{
                        fontSize: 9,
                        color: isActive ? colors.ORANGE : '#64748B',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

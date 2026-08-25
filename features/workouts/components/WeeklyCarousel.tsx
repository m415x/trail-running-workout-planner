'use client'

import * as React from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@ui/carousel'
import { DaySelectorButton } from '@workouts/components/DaySelectorButton'
import { WeekDay } from '@/types'

interface WeeklyCarouselProps {
  weekDays: WeekDay[]
  selectedDay: number
  onSelectDay: (index: number) => void
  onPrevWeek: () => void
  onNextWeek: () => void
}

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function buildAdjacentWeekDays(baseWeekDays: WeekDay[], weekOffset: number): WeekDay[] {
  if (!baseWeekDays.length) return []

  const rawDateStr = baseWeekDays[0].date || baseWeekDays[0].fullDate
  if (!rawDateStr) return []

  const firstDayCurrentWeek = parseISO(rawDateStr)
  const startAdjacent = addDays(firstDayCurrentWeek, weekOffset * 7)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(startAdjacent, i)
    const dateStr = format(dayDate, 'yyyy-MM-dd')

    return {
      date: dateStr,
      fullDate: dateStr,
      day: DAY_LETTERS[i],
      dayName: DAY_LETTERS[i],
      dayNumber: dayDate.getDate(),
      isToday: todayStr === dateStr,
      isRest: false,
    }
  })
}

export function WeeklyCarousel({ weekDays, selectedDay, onSelectDay, onPrevWeek, onNextWeek }: WeeklyCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi>()
  const isTransitioningRef = React.useRef(false)

  const prevWeekDays = React.useMemo(() => buildAdjacentWeekDays(weekDays, -1), [weekDays])
  const nextWeekDays = React.useMemo(() => buildAdjacentWeekDays(weekDays, 1), [weekDays])

  React.useEffect(() => {
    if (!api) return

    const handleSettle = () => {
      const selectedSnap = api.selectedScrollSnap()

      if (selectedSnap === 0 && !isTransitioningRef.current) {
        isTransitioningRef.current = true
        onPrevWeek()
      } else if (selectedSnap === 2 && !isTransitioningRef.current) {
        isTransitioningRef.current = true
        onNextWeek()
      }
    }

    api.on('settle', handleSettle)
    return () => {
      api.off('settle', handleSettle)
    }
  }, [api, onPrevWeek, onNextWeek])

  React.useEffect(() => {
    if (!api) return
    api.scrollTo(1, true)
    isTransitioningRef.current = false
  }, [api, weekDays])

  return (
    <Carousel
      setApi={setApi}
      opts={{
        startIndex: 1,
        align: 'start',
        loop: false,
        dragFree: false,
        dragThreshold: 22,
        duration: 5,
      }}
      className='w-full select-none'
    >
      <CarouselContent className='-ml-2'>
        {/* Slide 0: Semana Anterior sin iconos ni dots */}
        <CarouselItem className='pl-2 basis-full'>
          <div className='grid grid-cols-7 items-start gap-1 px-1.5 py-1.5 opacity-70'>
            {prevWeekDays.map((d, i) => (
              <DaySelectorButton
                key={`prev-${d.date}`}
                day={d}
                index={i}
                isSelected={false}
                hideStatusIndicators={true}
                onSelectDay={() => {}}
              />
            ))}
          </div>
        </CarouselItem>

        {/* Slide 1: Semana Actual (con iconos y estados completos) */}
        <CarouselItem className='pl-2 basis-full'>
          <div className='grid grid-cols-7 items-start gap-1 px-1.5 py-1.5'>
            {weekDays.map((d, i) => (
              <DaySelectorButton
                key={`curr-${d.date || d.fullDate || i}`}
                day={d}
                index={i}
                isSelected={selectedDay === i}
                hideStatusIndicators={false}
                onSelectDay={onSelectDay}
              />
            ))}
          </div>
        </CarouselItem>

        {/* Slide 2: Semana Siguiente sin iconos ni dots */}
        <CarouselItem className='pl-2 basis-full'>
          <div className='grid grid-cols-7 items-start gap-1 px-1.5 py-1.5 opacity-70'>
            {nextWeekDays.map((d, i) => (
              <DaySelectorButton
                key={`next-${d.date}`}
                day={d}
                index={i}
                isSelected={false}
                hideStatusIndicators={true}
                onSelectDay={() => {}}
              />
            ))}
          </div>
        </CarouselItem>
      </CarouselContent>
    </Carousel>
  )
}

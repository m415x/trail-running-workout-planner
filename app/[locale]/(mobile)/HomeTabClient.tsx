'use client'

import { useEffect } from 'react'
import { useMobileShell } from '@/context/MobileShellContext'
import { HomeTab } from '@workouts/HomeTab'
import { SessionWithWorkout, UseHomeTabProps } from '@workouts/hooks/useHomeTab'

interface HomeTabClientProps {
  initialAthlete: UseHomeTabProps['initialAthlete']
  initialSchedule: SessionWithWorkout[]
  initialRealizedTraining: UseHomeTabProps['initialRealizedTraining']
  locale: string
}

export function HomeTabClient({
  initialAthlete,
  initialSchedule,
  initialRealizedTraining,
  locale,
}: HomeTabClientProps) {
  const { setShellBgColor } = useMobileShell()

  useEffect(() => {
    setShellBgColor('bg-background')
    return () => setShellBgColor('bg-background')
  }, [setShellBgColor])

  return (
    <HomeTab
      initialAthlete={initialAthlete}
      initialSchedule={initialSchedule}
      initialRealizedTraining={initialRealizedTraining}
      locale={locale}
    />
  )
}

'use client'

import { useEffect } from 'react'
import { useMobileShell } from '@/context/MobileShellContext'
import { HomeTab } from '@workouts/HomeTab'
import type { SessionWithWorkout, UseHomeTabProps } from '@workouts/hooks/useHomeTab'
import { AthleteHomeEconomicNotice } from '@/features/memberships/components/AthleteHomeEconomicNotice'
import type { AthleteHomeEconomicSummary } from '@/lib/memberships/athlete-home-economic-reader'
import { projectAthleteEconomicVisualState } from '@/lib/memberships/athlete-home-economic-visual'
import { resolveAthleteEconomicShellBackground } from '@/lib/memberships/athlete-home-economic-shell'

interface HomeTabClientProps {
  initialAthlete: UseHomeTabProps['initialAthlete']
  initialSchedule: SessionWithWorkout[]
  initialRealizedTraining: UseHomeTabProps['initialRealizedTraining']
  locale: string
  runningReference: import('@/lib/physiology/running-reference').RunningReference
  economicState: AthleteHomeEconomicSummary
}

export function HomeTabClient({
  initialAthlete,
  initialSchedule,
  initialRealizedTraining,
  locale,
  runningReference,
  economicState,
}: HomeTabClientProps) {
  const { setShellBgColor } = useMobileShell()
  const visual = projectAthleteEconomicVisualState(economicState)
  const background = resolveAthleteEconomicShellBackground(visual.tone)

  useEffect(() => {
    setShellBgColor(background)
    return () => setShellBgColor('bg-background')
  }, [background, setShellBgColor])

  return (
    <div className='min-w-0 space-y-3'>
      <AthleteHomeEconomicNotice locale={locale === 'en' ? 'en' : 'es'} state={visual} />
      <HomeTab
        initialAthlete={initialAthlete}
        initialSchedule={initialSchedule}
        initialRealizedTraining={initialRealizedTraining}
        locale={locale}
        runningReference={runningReference}
      />
    </div>
  )
}

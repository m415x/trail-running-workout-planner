'use client'

import { useEffect } from 'react'
import { useMobileShell } from '@/context/MobileShellContext'
import { HomeTab } from '@workouts/HomeTab'
import { SessionWithWorkout, UseHomeTabProps } from '@workouts/hooks/useHomeTab'

// Tipos simplificados basados en lo que devuelve tu Server Action
interface HomeTabClientProps {
  initialAthlete: UseHomeTabProps['initialAthlete']
  initialSchedule: SessionWithWorkout[] // Reemplaza 'any' con SessionWithWorkout[]
  locale: string
}

export function HomeTabClient({ initialAthlete, initialSchedule, locale }: HomeTabClientProps) {
  const { setShellBgColor } = useMobileShell()

  useEffect(() => {
    // Cambia el fondo del div del layout a un color de zona o alerta
    setShellBgColor('bg-background')

    // Restablece al desmontar
    return () => setShellBgColor('bg-background')
  }, [setShellBgColor])

  return <HomeTab initialAthlete={initialAthlete} initialSchedule={initialSchedule} locale={locale} />
}

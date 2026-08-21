'use client'

import { useEffect } from 'react'
import { useMobileShell } from '@/context/MobileShellContext'
import { HomeTab } from '@/features/workouts/HomeTab'

export default function HomePage() {
  const { setShellBgColor } = useMobileShell()

  useEffect(() => {
    // Cambia el fondo del div del layout a un color de zona o alerta
    setShellBgColor('bg-background')

    // Restablece al desmontar
    return () => setShellBgColor('bg-background')
  }, [setShellBgColor])

  return <HomeTab />
}

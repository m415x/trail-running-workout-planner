import { useMemo } from 'react'
import { currentUser as user } from '@/data/data'

export function useHomeHeader(presentationLocale: string) {
  // Nombre completo compuesto
  const fullName = `${user.firstName} ${user.lastName}`

  // Iniciales exactas del team para el Fallback
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  const today = useMemo(() => {
    const formatted = new Intl.DateTimeFormat(presentationLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())

    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [presentationLocale])

  return {
    fullName,
    initials,
    today,
  }
}

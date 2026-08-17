import { useMemo } from 'react'
import { currentUser as user } from '@/data/data'
import { formatFullDate } from '@/utils/date-helpers'

export function useHomeHeader() {
  // Nombre completo compuesto
  const fullName = `${user.firstName} ${user.lastName}`

  // Iniciales exactas del team para el Fallback
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  // Calcula y formatea la fecha actual ("Jueves · 13 Agosto 2026")
  const today = useMemo(() => {
    return formatFullDate(new Date())
  }, [])

  return {
    fullName,
    initials,
    today,
  }
}

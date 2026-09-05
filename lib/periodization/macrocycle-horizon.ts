import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'

export interface MacrocycleHorizon {
  startDate: string
  endDate: string
}

export interface MacrocycleHorizonValidation {
  isValid: boolean
  durationDays: number | null
  durationWeeks: number | null
  error?: string
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

export function validateMacrocycleHorizon(
  horizon: MacrocycleHorizon,
): MacrocycleHorizonValidation {
  if (!isValidIsoDate(horizon.startDate) || !isValidIsoDate(horizon.endDate)) {
    return {
      isValid: false,
      durationDays: null,
      durationWeeks: null,
      error: 'Ingresá fechas válidas para el macrociclo.',
    }
  }

  const durationDays = differenceInCalendarDays(
    parseISO(horizon.endDate),
    parseISO(horizon.startDate),
  ) + 1

  if (durationDays <= 0) {
    return {
      isValid: false,
      durationDays,
      durationWeeks: null,
      error: 'La fecha final debe ser igual o posterior a la fecha inicial.',
    }
  }

  if (durationDays < 28) {
    return {
      isValid: false,
      durationDays,
      durationWeeks: Math.ceil(durationDays / 7),
      error: 'El macrociclo debe abarcar al menos 4 semanas.',
    }
  }

  return {
    isValid: true,
    durationDays,
    durationWeeks: Math.ceil(durationDays / 7),
  }
}

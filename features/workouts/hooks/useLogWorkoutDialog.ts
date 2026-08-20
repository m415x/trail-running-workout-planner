import { useState, useMemo } from 'react'
import { LoggedWorkoutPayload, LogWorkoutDialogProps } from '@/types'

export function useLogWorkoutDialog({ onClose, workout, dateStr, onSave }: LogWorkoutDialogProps) {
  // 1. Calcular valores iniciales basados en el workout planificado.
  const initialValues = useMemo(() => {
    const totalMinutes = workout?.time ?? 0
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return {
      distance: workout?.km?.toString() ?? '',
      gain: workout?.gain?.toString() ?? '0',
      timeHr: hours > 0 ? hours.toString() : '',
      timeMin: minutes > 0 ? minutes.toString() : '0',
      timeSec: '0',
      rpe: 5,
      athleteNotes: '',
    }
  }, [workout])

  // 2. Inicializar el estado del formulario.
  const [distance, setDistance] = useState(initialValues.distance)
  const [timeHr, setTimeHr] = useState(initialValues.timeHr)
  const [timeMin, setTimeMin] = useState(initialValues.timeMin)
  const [timeSec, setTimeSec] = useState(initialValues.timeSec)
  const [gain, setGain] = useState(initialValues.gain)
  const [avgHr, setAvgHr] = useState('')
  const [rpe, setRpe] = useState(initialValues.rpe)
  const [athleteNotes, setAthleteNotes] = useState(initialValues.athleteNotes)

  // Handler seguro para segundos (limita rango entre 0 y 59)
  const handleTimeSecChange = (value: string) => {
    if (value === '') {
      setTimeSec('')
      return
    }
    const valNum = parseInt(value, 10)
    if (!isNaN(valNum) && valNum >= 0 && valNum <= 59) {
      setTimeSec(value)
    }
  }

  // Handler para autocalcular horas desde minutos
  const handleMinutesChange = (value: string) => {
    const numValue = parseInt(value, 10)
    if (isNaN(numValue)) {
      setTimeMin('')
      return
    }

    if (numValue >= 60) {
      const currentHours = timeHr ? parseInt(timeHr, 10) : 0
      const newHours = currentHours + Math.floor(numValue / 60)
      const newMinutes = numValue % 60
      setTimeHr(newHours.toString())
      setTimeMin(newMinutes.toString())
    } else {
      setTimeMin(value)
    }
  }

  const handleSave = () => {
    const hours = parseInt(timeHr, 10) || 0
    const mins = parseInt(timeMin, 10) || 0
    const secs = parseInt(timeSec, 10) || 0

    // Duración en minutos totales con precisión decimal
    const totalDurationMin = Number((hours * 60 + mins + secs / 60).toFixed(2))

    const payload: LoggedWorkoutPayload = {
      workoutId: workout?.id?.toString(),
      date: dateStr,
      distanceKm: parseFloat(distance) || 0,
      durationMin: totalDurationMin,
      elevationGain: parseInt(gain, 10) || 0,
      avgHr: avgHr ? parseInt(avgHr, 10) : null,
      rpe,
      athleteNotes,
      loggedAt: new Date().toISOString(),
    }

    onSave?.(payload)
    onClose()
  }
  return {
    distance,
    timeMin,
    timeHr,
    timeSec,
    gain,
    avgHr,
    rpe,
    athleteNotes,
    setDistance,
    setTimeHr,
    setTimeMin,
    handleMinutesChange,
    setTimeSec: handleTimeSecChange,
    setGain,
    setAvgHr,
    setRpe,
    setAthleteNotes,
    handleSave,
  }
}

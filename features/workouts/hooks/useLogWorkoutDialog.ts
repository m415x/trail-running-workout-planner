import { useState } from 'react'
import { LoggedWorkoutPayload, LogWorkoutDialogProps } from '@/types'

export function useLogWorkoutDialog({ onClose, workout, dateStr, onSave }: LogWorkoutDialogProps) {
  // Valores iniciales basados en la planificación
  const [distance, setDistance] = useState<string>(workout ? String(workout.km) : '')
  const [timeMin, setTimeMin] = useState<string>(workout ? String(workout.time) : '')
  const [timeSec, setTimeSec] = useState<string>('')
  const [gain, setGain] = useState<string>(workout ? String(workout.gain) : '0')
  const [avgHr, setAvgHr] = useState<string>('')
  const [rpe, setRpe] = useState<number>(5)
  const [athleteNotes, setAthleteNotes] = useState<string>('')

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

  const handleSave = () => {
    const mins = parseInt(timeMin, 10) || 0
    const secs = parseInt(timeSec, 10) || 0

    // Duración en minutos totales con precisión decimal
    const totalDurationMin = Number((mins + secs / 60).toFixed(2))

    const payload: LoggedWorkoutPayload = {
      workoutId: workout?.title,
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
    timeSec,
    gain,
    avgHr,
    rpe,
    athleteNotes,
    setDistance,
    setTimeMin,
    setTimeSec: handleTimeSecChange,
    setGain,
    setAvgHr,
    setRpe,
    setAthleteNotes,
    handleSave,
  }
}

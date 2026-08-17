import { useState } from 'react'
import { LoggedWorkoutPayload, LogWorkoutDialogProps } from '@/features/workouts/types/workout.types'

export function useLogWorkoutDialog({ isOpen, onClose, workout, dateStr, onSave }: LogWorkoutDialogProps) {
  // Valores iniciales basados en la planificación
  const [distance, setDistance] = useState<string>(workout ? String(workout.km) : '')
  const [timeMin, setTimeMin] = useState<string>(workout ? String(workout.time) : '')
  const [gain, setGain] = useState<string>(workout ? String(workout.gain) : '0')
  const [avgHr, setAvgHr] = useState<string>('')
  const [rpe, setRpe] = useState<number>(5)
  const [athleteNotes, setAthleteNotes] = useState<string>('')

  const handleSave = () => {
    const payload: LoggedWorkoutPayload = {
      workoutId: workout?.title,
      date: dateStr,
      distanceKm: parseFloat(distance) || 0,
      durationMin: parseInt(timeMin, 10) || 0,
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
    gain,
    avgHr,
    rpe,
    athleteNotes,
    setDistance,
    setTimeMin,
    setGain,
    setAvgHr,
    setRpe,
    setAthleteNotes,
    handleSave,
  }
}

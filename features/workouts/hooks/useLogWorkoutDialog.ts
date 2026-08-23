import { useState, useMemo, useCallback } from 'react'
import { LoggedWorkoutPayload, LogWorkoutDialogProps } from '@/types'
import { SelfAssessmentValues } from '@/features/workouts/components/SelfAssessment'

export function useLogWorkoutDialog({ onClose, workout, dateStr, onSave, onDelete }: LogWorkoutDialogProps) {
  // 1. Calcular valores iniciales basados en el workout planificado.
  const initialValues = useMemo(() => {
    const totalMinutes = workout?.time ?? 0
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return {
      distance: workout?.distance?.toString() ?? '',
      gain: workout?.gain?.toString() ?? '0',
      timeHr: hours > 0 ? hours.toString() : '',
      timeMin: minutes > 0 ? minutes.toString() : '0',
      timeSec: '0',
      assessment: {
        feeling: null,
        rpe: 0,
      } as SelfAssessmentValues,
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
  const [assessment, setAssessment] = useState<SelfAssessmentValues>(initialValues.assessment)
  const [athleteNotes, setAthleteNotes] = useState(initialValues.athleteNotes)

  // 3. Función para resetear el estado a los valores iniciales.
  const resetForm = useCallback(() => {
    setDistance(initialValues.distance)
    setGain(initialValues.gain)
    setTimeHr(initialValues.timeHr)
    setTimeMin(initialValues.timeMin)
    setTimeSec(initialValues.timeSec)
    setAssessment(initialValues.assessment)
    setAthleteNotes(initialValues.athleteNotes)
    setAvgHr('')
  }, [initialValues])

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
      rpe: assessment.rpe ?? 0,
      feeling: assessment.feeling ?? undefined,
      athleteNotes,
      loggedAt: new Date().toISOString(),
    }

    onSave?.(payload)
    onClose()
  }

  const handleDelete = () => {
    onDelete?.()
    resetForm()
    onClose()
  }

  return {
    distance,
    timeMin,
    timeHr,
    timeSec,
    gain,
    avgHr,
    assessment,
    athleteNotes,
    setDistance,
    setTimeHr,
    setTimeMin,
    handleMinutesChange,
    setTimeSec: handleTimeSecChange,
    setGain,
    setAvgHr,
    setAssessment,
    setAthleteNotes,
    handleSave,
    handleDelete,
    resetForm,
  }
}

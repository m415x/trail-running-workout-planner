import { useState, useMemo, useCallback, useRef } from 'react'
import { captureLocalInstant, captureDuration } from '@/lib/realized-training/manual-capture-fields'
import type {
  ManualRealizedTrainingClientInput,
  RealizedTrainingCaptureMetric,
} from '@/types'
import { SelfAssessmentValues } from '@workouts/components/SelfAssessment'
import { LogWorkoutDialogProps } from '@workouts/components/LogWorkoutDialog'

function metricFromInput(value: string): RealizedTrainingCaptureMetric {
  const normalized = value.trim()
  if (!normalized) return { state: 'unknown' }
  return { state: 'known', value: Number(normalized) }
}

export function useLogWorkoutDialog({ onClose, workout, dateStr, onSave }: LogWorkoutDialogProps) {
  // Planned values are deliberately not copied into realized metrics. They can
  // be shown as placeholders by the UI, but an untouched input remains unknown.
  const initialValues = useMemo(() => ({
    distance: '',
    gain: '',
    timeHr: '',
    timeMin: '',
    timeSec: '',
    avgHr: '',
    assessment: {
      feeling: null,
      rpe: null,
    } as SelfAssessmentValues,
    athleteNotes: '',
  }), [])

  const [distance, setDistance] = useState(initialValues.distance)
  const [timeHr, setTimeHr] = useState(initialValues.timeHr)
  const [timeMin, setTimeMin] = useState(initialValues.timeMin)
  const [timeSec, setTimeSec] = useState(initialValues.timeSec)
  const [gain, setGain] = useState(initialValues.gain)
  const [avgHr, setAvgHr] = useState(initialValues.avgHr)
  const [assessment, setAssessment] = useState<SelfAssessmentValues>(initialValues.assessment)
  const [athleteNotes, setAthleteNotes] = useState(initialValues.athleteNotes)
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)
  const [performedLocal, setPerformedLocal] = useState('')
  const [saveError, setSaveError] = useState<'invalidPerformedAt' | 'saveFailed' | null>(null)

  const resetForm = useCallback(() => {
    setPerformedLocal('')
    setSaveError(null)
    setDistance(initialValues.distance)
    setGain(initialValues.gain)
    setTimeHr(initialValues.timeHr)
    setTimeMin(initialValues.timeMin)
    setTimeSec(initialValues.timeSec)
    setAssessment(initialValues.assessment)
    setAthleteNotes(initialValues.athleteNotes)
    setAvgHr(initialValues.avgHr)
  }, [initialValues])

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

  const handleMinutesChange = (value: string) => {
    if (value === '') {
      setTimeMin('')
      return
    }

    const numValue = parseInt(value, 10)
    if (isNaN(numValue)) return

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


  const handleSave = async () => {
    if (!dateStr || !onSave || saving.current) return
    const performedAt = captureLocalInstant(performedLocal)
    if (!performedAt) {
      setSaveError('invalidPerformedAt')
      return
    }

    const payload: ManualRealizedTrainingClientInput = {
      sessionId: workout?.id?.toString() ?? null,
      workoutId: null,
      date: dateStr,
      performedAt,
      status: 'completed',
      metrics: {
        distanceKm: metricFromInput(distance),
        durationMin: captureDuration(timeHr, timeMin, timeSec),
        elevationGainM: metricFromInput(gain),
        avgHrBpm: metricFromInput(avgHr),
        rpe: assessment.rpe === null || assessment.rpe === undefined
          ? { state: 'unknown' }
          : { state: 'known', value: assessment.rpe },
      },
      feeling: assessment.feeling ?? null,
      athleteNotes: athleteNotes.trim() || null,
    }

    saving.current = true
    setSaveError(null)
    setIsSaving(true)
    try {
      const saved = await onSave(payload)
      if (!saved) {
        setSaveError('saveFailed')
        return
      }
      resetForm()
      onClose()
    } catch {
      setSaveError('saveFailed')
    } finally {
      saving.current = false
      setIsSaving(false)
    }
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
    isSaving,
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
    performedLocal,
    setPerformedLocal,
    saveError,
    resetForm,
  }
}

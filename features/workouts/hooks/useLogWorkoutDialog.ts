import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
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

function inputFromMetric(metric: RealizedTrainingCaptureMetric | undefined): string {
  return metric?.state === 'known' ? String(metric.value) : ''
}

function localDateTimeInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function durationInputs(metric: RealizedTrainingCaptureMetric | undefined) {
  if (!metric || metric.state !== 'known') return { timeHr: '', timeMin: '', timeSec: '' }
  const totalSeconds = Math.max(0, Math.round(metric.value * 60))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return {
    timeHr: String(hours),
    timeMin: String(minutes),
    timeSec: String(seconds),
  }
}

export function useLogWorkoutDialog({
  isOpen,
  onClose,
  workout,
  dateStr,
  onSave,
  initialInput,
}: LogWorkoutDialogProps) {
  // Planned values are deliberately not copied into realized metrics. They can
  // be shown as placeholders by the UI, but an untouched input remains unknown.
  const emptyValues = useMemo(() => ({
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
    performedLocal: '',
  }), [])

  const valuesFromInput = useCallback((input: ManualRealizedTrainingClientInput | null | undefined) => {
    if (!input) return emptyValues
    const duration = durationInputs(input.metrics.durationMin)
    return {
      distance: inputFromMetric(input.metrics.distanceKm),
      gain: inputFromMetric(input.metrics.elevationGainM),
      ...duration,
      avgHr: inputFromMetric(input.metrics.avgHrBpm),
      assessment: {
        feeling: input.feeling,
        rpe: input.metrics.rpe.state === 'known' ? input.metrics.rpe.value : null,
      } as SelfAssessmentValues,
      athleteNotes: input.athleteNotes ?? '',
      performedLocal: localDateTimeInput(input.performedAt),
    }
  }, [emptyValues])

  const [distance, setDistance] = useState(emptyValues.distance)
  const [timeHr, setTimeHr] = useState(emptyValues.timeHr)
  const [timeMin, setTimeMin] = useState(emptyValues.timeMin)
  const [timeSec, setTimeSec] = useState(emptyValues.timeSec)
  const [gain, setGain] = useState(emptyValues.gain)
  const [avgHr, setAvgHr] = useState(emptyValues.avgHr)
  const [assessment, setAssessment] = useState<SelfAssessmentValues>(emptyValues.assessment)
  const [athleteNotes, setAthleteNotes] = useState(emptyValues.athleteNotes)
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)
  const [performedLocal, setPerformedLocal] = useState(emptyValues.performedLocal)
  const [saveError, setSaveError] = useState<'invalidPerformedAt' | 'saveFailed' | null>(null)

  const applyValues = useCallback((input: ManualRealizedTrainingClientInput | null | undefined) => {
    const values = valuesFromInput(input)
    setPerformedLocal(values.performedLocal)
    setSaveError(null)
    setDistance(values.distance)
    setGain(values.gain)
    setTimeHr(values.timeHr)
    setTimeMin(values.timeMin)
    setTimeSec(values.timeSec)
    setAssessment(values.assessment)
    setAthleteNotes(values.athleteNotes)
    setAvgHr(values.avgHr)
  }, [valuesFromInput])

  useEffect(() => {
    if (isOpen) applyValues(initialInput)
  }, [applyValues, initialInput, isOpen])

  const resetForm = useCallback(() => {
    applyValues(initialInput)
  }, [applyValues, initialInput])

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
      sessionId: workout?.id?.toString() ?? initialInput?.sessionId ?? null,
      workoutId: initialInput?.workoutId ?? null,
      date: initialInput?.date ?? dateStr,
      performedAt,
      status: initialInput?.status ?? 'completed',
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
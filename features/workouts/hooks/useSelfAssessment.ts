import { useState, useEffect } from 'react'
import { FEELING_OPTIONS, FeelingValue } from '@workouts/components/FeelingSelector'

export interface SelfAssessmentValues {
  feeling?: FeelingValue | null
  rpe?: number
}

export interface UseSelfAssessmentProps {
  value?: SelfAssessmentValues
  onChange?: (values: SelfAssessmentValues) => void
}

export function useSelfAssessment({ value, onChange }: UseSelfAssessmentProps = {}) {
  // Estado interno de fallback
  const [internalFeeling, setInternalFeeling] = useState<FeelingValue | null>(value?.feeling ?? null)
  const [internalRpe, setInternalRpe] = useState<number>(value?.rpe ?? 0)

  // Sincronizar estado interno si cambian las props de forma controlada
  useEffect(() => {
    if (value?.feeling !== undefined) {
      setInternalFeeling(value.feeling)
    }
  }, [value?.feeling])

  useEffect(() => {
    if (value?.rpe !== undefined) {
      setInternalRpe(value.rpe)
    }
  }, [value?.rpe])

  const feeling = value?.feeling !== undefined ? value.feeling : internalFeeling
  const rpe = value?.rpe !== undefined ? (value.rpe ?? 0) : internalRpe
  const hasData = Boolean(feeling || rpe > 0)

  const selectedFeelingOption = FEELING_OPTIONS.find((opt) => opt.value === feeling)
  const FeelingIcon = selectedFeelingOption?.icon

  const handleFeelingChange = (newFeeling: FeelingValue | null) => {
    setInternalFeeling(newFeeling)
    onChange?.({ feeling: newFeeling, rpe })
  }

  const handleRpeChange = (newRpe: number) => {
    setInternalRpe(newRpe)
    onChange?.({ feeling, rpe: newRpe })
  }

  return {
    feeling,
    rpe,
    hasData,
    selectedFeelingOption,
    FeelingIcon,
    handleFeelingChange,
    handleRpeChange,
  }
}

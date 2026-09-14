import { useState, useEffect } from 'react'
import { FEELING_OPTIONS, FeelingValue } from '@workouts/components/FeelingSelector'

export interface SelfAssessmentValues {
  feeling?: FeelingValue | null
  rpe?: number | null
}

export interface UseSelfAssessmentProps {
  value?: SelfAssessmentValues
  onChange?: (values: SelfAssessmentValues) => void
}

export function useSelfAssessment({ value, onChange }: UseSelfAssessmentProps = {}) {
  const [internalFeeling, setInternalFeeling] = useState<FeelingValue | null>(value?.feeling ?? null)
  const [internalRpe, setInternalRpe] = useState<number | null>(value?.rpe ?? null)

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
  const rpe = value?.rpe !== undefined ? value.rpe : internalRpe
  const hasData = Boolean(feeling || rpe !== null)

  const selectedFeelingOption = FEELING_OPTIONS.find((opt) => opt.value === feeling)
  const FeelingIcon = selectedFeelingOption?.icon

  const handleFeelingChange = (newFeeling: FeelingValue | null) => {
    setInternalFeeling(newFeeling)
    onChange?.({ feeling: newFeeling, rpe })
  }

  const handleRpeChange = (newRpe: number | null) => {
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

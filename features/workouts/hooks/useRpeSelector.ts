import { useState } from 'react'
import { RPE_LEVELS } from '@/utils/constants'

export function useRpeSelector(value: number) {
  const [showDetails, setShowDetails] = useState(true)
  const currentRpe = RPE_LEVELS.find((l) => l.value === value) ?? RPE_LEVELS[4]

  return {
    showDetails,
    setShowDetails,
    currentRpe,
  }
}

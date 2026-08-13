'use client'

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'

export default function ProgressGradient({ value }: { value: number }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(value)
    }, 150)

    return () => clearTimeout(timer)
  }, [value])

  return <Progress indicatorClassName='bg-linear-to-r from-chart-5 via-chart-1 to-chart-1' value={progress} />
}

import type { RunningReference } from '@/lib/physiology/running-reference'
import type { TrainingIntensity } from '@/types/training/intensity.types'

export const INTENSITY_GUIDANCE_POLICY = {
  id: 'execution-guidance',
  version: '1.0.0',
} as const

interface QualityGuidanceAvailable {
  readonly status: 'available'
  readonly intensityPercentage: number
  readonly source: Extract<RunningReference, { status: 'available' }>['source']
  readonly paceSecPerKm: number
  readonly paceLabel: string
  readonly averageSpeedKmh: number
}

interface QualityGuidanceUnknown {
  readonly status: 'unknown'
  readonly intensityPercentage: number
}

type QualityGuidance = QualityGuidanceAvailable | QualityGuidanceUnknown

interface ZoneGuidance {
  readonly zone: Extract<TrainingIntensity, { method: 'hr_zone' }>['zone']
}

export type ExecutionGuidance =
  | {
      readonly policyVersion: typeof INTENSITY_GUIDANCE_POLICY.version
      readonly prescription: Extract<TrainingIntensity, { method: 'pam_percentage' }>
      readonly quality: QualityGuidance
      readonly zone: null
    }
  | {
      readonly policyVersion: typeof INTENSITY_GUIDANCE_POLICY.version
      readonly prescription: Extract<TrainingIntensity, { method: 'hr_zone' }>
      readonly quality: null
      readonly zone: ZoneGuidance
    }

function formatPace(paceSecPerKm: number): string {
  const rounded = Math.round(paceSecPerKm)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}/km`
}

interface ResolveExecutionGuidanceInput {
  readonly intensity: TrainingIntensity
  readonly runningReference: RunningReference
}

export function resolveExecutionGuidance({
  intensity,
  runningReference,
}: ResolveExecutionGuidanceInput): ExecutionGuidance {
  if (intensity.method === 'hr_zone') {
    return {
      policyVersion: INTENSITY_GUIDANCE_POLICY.version,
      prescription: intensity,
      quality: null,
      zone: { zone: intensity.zone },
    }
  }

  const quality: QualityGuidance =
    runningReference.status === 'available'
      ? {
          status: 'available',
          intensityPercentage: intensity.pamPercentage,
          source: runningReference.source,
          paceSecPerKm: Math.round(
            runningReference.derived.paceSecPerKm / (intensity.pamPercentage / 100),
          ),
          paceLabel: formatPace(
            runningReference.derived.paceSecPerKm / (intensity.pamPercentage / 100),
          ),
          averageSpeedKmh: Number(
            (
              runningReference.derived.averageSpeedKmh *
              (intensity.pamPercentage / 100)
            ).toFixed(1),
          ),
        }
      : {
          status: 'unknown',
          intensityPercentage: intensity.pamPercentage,
        }

  return {
    policyVersion: INTENSITY_GUIDANCE_POLICY.version,
    prescription: intensity,
    quality,
    zone: null,
  }
}

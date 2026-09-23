import type { RunningReference } from '@/lib/physiology/running-reference'
import type { TrainingIntensity } from '@/types/training/intensity.types'

/** Canonical execution intensity contract. */
export type ExecutionIntensity = TrainingIntensity

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

const ZONE_EFFORT_GUIDANCE = {
  Z1: { rpe: { min: 1, max: 2 }, talkTest: 'comfortable_conversation' },
  Z2: { rpe: { min: 3, max: 4 }, talkTest: 'full_conversation' },
  Z3: { rpe: { min: 5, max: 6 }, talkTest: 'short_phrases' },
  Z4: { rpe: { min: 7, max: 8 }, talkTest: 'few_words' },
  Z5: { rpe: { min: 9, max: 10 }, talkTest: 'no_conversation' },
} as const

type Zone = Extract<TrainingIntensity, { method: 'hr_zone' }>['zone']

interface ZoneGuidance {
  readonly zone: Zone
  readonly rpe: (typeof ZONE_EFFORT_GUIDANCE)[Zone]['rpe']
  readonly talkTest: (typeof ZONE_EFFORT_GUIDANCE)[Zone]['talkTest']
  readonly terrainPriority: 'effort_over_pace'
}

export type ExecutionGuidance =
  | {
      readonly policyVersion: typeof INTENSITY_GUIDANCE_POLICY.version
      readonly prescription: Exclude<ExecutionIntensity, { method: 'hr_zone' }>
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
  readonly intensity: ExecutionIntensity
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
      zone: {
        zone: intensity.zone,
        ...ZONE_EFFORT_GUIDANCE[intensity.zone],
        terrainPriority: 'effort_over_pace',
      },
    }
  }

  const percentage = intensity.referencePercentage

  const quality: QualityGuidance =
    runningReference.status === 'available'
      ? {
          status: 'available',
          intensityPercentage: percentage,
          source: runningReference.source,
          paceSecPerKm: Math.round(
            runningReference.derived.paceSecPerKm / (percentage / 100),
          ),
          paceLabel: formatPace(
            runningReference.derived.paceSecPerKm / (percentage / 100),
          ),
          averageSpeedKmh: Number(
            (
              runningReference.derived.averageSpeedKmh *
              (percentage / 100)
            ).toFixed(1),
          ),
        }
      : {
          status: 'unknown',
          intensityPercentage: percentage,
        }

  return {
    policyVersion: INTENSITY_GUIDANCE_POLICY.version,
    prescription: intensity,
    quality,
    zone: null,
  }
}

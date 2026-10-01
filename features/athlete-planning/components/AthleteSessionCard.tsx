'use client'

import { Activity, MapPin, Mountain, Timer } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { IntensityMethod, IntensityZone } from '@/types/training/intensity.types'
import type { ExecutionGuidance } from '@/lib/physiology/execution-guidance'
import type { WorkoutType } from '@/types/training/workout.types'
import { Badge } from '@ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card'

interface AthleteSessionCardProps {
  session: {
    id: string
    title: string
    type: WorkoutType
    location: { name: string } | null
    notes: string | null
    structure: {
      preliminaryExercises?: string | null
      warmup?: string | null
      mainBlock?: string | null
      cooldown?: string | null
    } | null
  }
  executionGuidance?: ExecutionGuidance
  prescription: {
    distanceKm: number | null
    durationMin: number | null
    elevationGain: number | null
    intensityMethod: IntensityMethod | null
    zone: IntensityZone | null
    referencePercentage: number | null
    notes: string | null
  }
}

export function AthleteSessionCard({ session, prescription, executionGuidance }: AthleteSessionCardProps) {
  const t = useTranslations('AthletePlan')
  const tWorkouts = useTranslations('Workouts')
  const intensity = formatIntensity(prescription, t)
  const hasVolume = prescription.distanceKm != null
    || prescription.durationMin != null
    || prescription.elevationGain != null
  const structureBlocks = [
    { label: t('session.structure.preliminary'), value: session.structure?.preliminaryExercises },
    { label: t('session.structure.warmup'), value: session.structure?.warmup },
    { label: t('session.structure.main'), value: session.structure?.mainBlock },
    { label: t('session.structure.cooldown'), value: session.structure?.cooldown },
  ].filter((block): block is { label: string; value: string } => Boolean(block.value))
  const generalNotes = session.notes !== prescription.notes ? session.notes : null
  const hasInstructions = Boolean(prescription.notes || generalNotes || structureBlocks.length > 0)

  return (
    <Card className='gap-3 py-4 shadow-none'>
      <CardHeader className='px-4'>
        <div className='flex items-start justify-between gap-2'>
          <CardTitle className='text-base'>{session.title}</CardTitle>
          <Badge variant='outline'>{tWorkouts(`types.${session.type}`)}</Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-2 px-4 text-xs text-muted-foreground'>
        <div className='rounded-lg bg-muted/40 p-2.5'>
          <p className='mb-1.5 font-medium text-foreground'>{t('session.volume')}</p>
          {hasVolume ? (
            <div className='flex flex-wrap gap-x-4 gap-y-2'>
              {prescription.distanceKm != null && <Metric icon={Activity} value={`${prescription.distanceKm} km`} />}
              {prescription.durationMin != null && <Metric icon={Timer} value={`${prescription.durationMin} min`} />}
              {prescription.elevationGain != null && <Metric icon={Mountain} value={`${prescription.elevationGain} m+`} />}
            </div>
          ) : (
            <p>{t('session.loadPending')}</p>
          )}
        </div>

        <div className='rounded-lg border px-2.5 py-2'>
          <p className='mb-1 font-medium text-foreground'>{t('session.location')}</p>
          <p className='flex items-start gap-1.5'>
            <MapPin className='mt-0.5 size-3.5 shrink-0' />
            <span>{session.location?.name || t('session.locationPending')}</span>
          </p>
        </div>
        {intensity && <p className='font-medium text-foreground'>{intensity}</p>}
        {executionGuidance?.zone && (
          <div className='rounded-lg border px-2.5 py-2'>
            <p className='font-medium text-foreground'>RPE {executionGuidance.zone.rpe.min}–{executionGuidance.zone.rpe.max}</p>
            <p>Talk Test: {tWorkouts(`card.guidance.talkTest.${executionGuidance.zone.talkTest}`)}</p>
            <p>{tWorkouts(`card.guidance.terrainPriority.${executionGuidance.zone.terrainPriority}`)}</p>
          </div>
        )}
        {executionGuidance?.quality?.status === 'available' && (
          <div className='rounded-lg border px-2.5 py-2'>
            <p className='font-medium text-foreground'>{executionGuidance.quality.intensityPercentage}% · {executionGuidance.quality.paceLabel}</p>
            <p>{executionGuidance.quality.averageSpeedKmh} km/h</p>
          </div>
        )}

        <div className='border-t pt-3'>
          <p className='mb-2 font-medium text-foreground'>{t('session.instructions')}</p>
          {hasInstructions ? (
            <div className='space-y-2.5'>
              {prescription.notes && <Instruction label={t('session.groupInstructions')} value={prescription.notes} />}
              {structureBlocks.map((block) => <Instruction key={block.label} label={block.label} value={block.value} />)}
              {generalNotes && <Instruction label={t('session.generalInstructions')} value={generalNotes} />}
            </div>
          ) : (
            <p>{t('session.noInstructions')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ icon: Icon, value }: { icon: typeof Activity; value: string }) {
  return <span className='flex items-center gap-1'><Icon className='size-3.5' /> {value}</span>
}

function Instruction({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='font-medium text-foreground/80'>{label}</p>
      <p className='mt-0.5 whitespace-pre-wrap leading-relaxed'>{value}</p>
    </div>
  )
}

function formatIntensity(prescription: AthleteSessionCardProps['prescription'], t: (key: string, values?: Record<string, string | number>) => string) {
  if (prescription.intensityMethod === 'reference_percentage' && prescription.referencePercentage != null) {
    return t('session.referenceIntensity', { value: prescription.referencePercentage })
  }
  if (prescription.zone) return t('session.intensity', { value: prescription.zone })
  return null
}

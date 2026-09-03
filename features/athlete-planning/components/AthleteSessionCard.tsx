import { Activity, MapPin, Mountain, Timer } from 'lucide-react'

import type { IntensityMethod, IntensityZone } from '@/types/training/intensity.types'
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
  prescription: {
    distanceKm: number | null
    durationMin: number | null
    elevationGain: number | null
    intensityMethod: IntensityMethod | null
    zone: IntensityZone | null
    pamPercentage: number | null
    notes: string | null
  }
}

export function AthleteSessionCard({ session, prescription }: AthleteSessionCardProps) {
  const intensity = formatIntensity(prescription)
  const hasVolume = prescription.distanceKm != null
    || prescription.durationMin != null
    || prescription.elevationGain != null
  const structureBlocks = [
    { label: 'Ejercicios preliminares', value: session.structure?.preliminaryExercises },
    { label: 'Entrada en calor', value: session.structure?.warmup },
    { label: 'Bloque principal', value: session.structure?.mainBlock },
    { label: 'Vuelta a la calma', value: session.structure?.cooldown },
  ].filter((block): block is { label: string; value: string } => Boolean(block.value))
  const generalNotes = session.notes !== prescription.notes ? session.notes : null
  const hasInstructions = Boolean(prescription.notes || generalNotes || structureBlocks.length > 0)

  return (
    <Card className='gap-3 py-4 shadow-none'>
      <CardHeader className='px-4'>
        <div className='flex items-start justify-between gap-2'>
          <CardTitle className='text-base'>{session.title}</CardTitle>
          <Badge variant='outline'>{session.type}</Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-2 px-4 text-xs text-muted-foreground'>
        <div className='rounded-lg bg-muted/40 p-2.5'>
          <p className='mb-1.5 font-medium text-foreground'>Tu volumen</p>
          {hasVolume ? (
            <div className='flex flex-wrap gap-x-4 gap-y-2'>
              {prescription.distanceKm != null && <Metric icon={Activity} value={`${prescription.distanceKm} km`} />}
              {prescription.durationMin != null && <Metric icon={Timer} value={`${prescription.durationMin} min`} />}
              {prescription.elevationGain != null && <Metric icon={Mountain} value={`${prescription.elevationGain} m+`} />}
            </div>
          ) : (
            <p>Carga por definir</p>
          )}
        </div>

        <div className='rounded-lg border px-2.5 py-2'>
          <p className='mb-1 font-medium text-foreground'>Lugar</p>
          <p className='flex items-start gap-1.5'>
            <MapPin className='mt-0.5 size-3.5 shrink-0' />
            <span>{session.location?.name || 'Ubicación por confirmar'}</span>
          </p>
        </div>
        {intensity && <p className='font-medium text-foreground'>{intensity}</p>}

        <div className='border-t pt-3'>
          <p className='mb-2 font-medium text-foreground'>Instrucciones</p>
          {hasInstructions ? (
            <div className='space-y-2.5'>
              {prescription.notes && <Instruction label='Para tu grupo' value={prescription.notes} />}
              {structureBlocks.map((block) => <Instruction key={block.label} label={block.label} value={block.value} />)}
              {generalNotes && <Instruction label='Indicaciones generales' value={generalNotes} />}
            </div>
          ) : (
            <p>Sin instrucciones adicionales</p>
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

function formatIntensity(prescription: AthleteSessionCardProps['prescription']) {
  if (prescription.intensityMethod === 'pam_percentage' && prescription.pamPercentage != null) {
    return `Intensidad: ${prescription.pamPercentage}% PAM`
  }
  if (prescription.zone) return `Intensidad: ${prescription.zone}`
  return null
}

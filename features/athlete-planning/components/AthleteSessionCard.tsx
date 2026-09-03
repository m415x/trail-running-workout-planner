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
  }
  prescription: {
    distanceKm: number | null
    durationMin: number | null
    elevationGain: number | null
    intensityMethod: IntensityMethod | null
    zone: IntensityZone | null
    pamPercentage: number | null
  }
}

export function AthleteSessionCard({ session, prescription }: AthleteSessionCardProps) {
  const intensity = formatIntensity(prescription)
  const hasVolume = prescription.distanceKm != null
    || prescription.durationMin != null
    || prescription.elevationGain != null

  return (
    <Card className='gap-3 py-4 shadow-none'>
      <CardHeader className='px-4'>
        <div className='flex items-start justify-between gap-2'>
          <CardTitle className='text-base'>{session.title}</CardTitle>
          <Badge variant='outline'>{session.type}</Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-2 px-4 text-xs text-muted-foreground'>
        <div className='flex flex-wrap gap-x-4 gap-y-2'>
          {prescription.distanceKm != null && <Metric icon={Activity} value={`${prescription.distanceKm} km`} />}
          {prescription.durationMin != null && <Metric icon={Timer} value={`${prescription.durationMin} min`} />}
          {prescription.elevationGain != null && <Metric icon={Mountain} value={`${prescription.elevationGain} m+`} />}
          {session.location && <Metric icon={MapPin} value={session.location.name} />}
        </div>
        {!hasVolume && <p>Carga por definir</p>}
        {intensity && <p className='font-medium text-foreground'>{intensity}</p>}
      </CardContent>
    </Card>
  )
}

function Metric({ icon: Icon, value }: { icon: typeof Activity; value: string }) {
  return <span className='flex items-center gap-1'><Icon className='size-3.5' /> {value}</span>
}

function formatIntensity(prescription: AthleteSessionCardProps['prescription']) {
  if (prescription.intensityMethod === 'pam_percentage' && prescription.pamPercentage != null) {
    return `Intensidad: ${prescription.pamPercentage}% PAM`
  }
  if (prescription.zone) return `Intensidad: ${prescription.zone}`
  return null
}

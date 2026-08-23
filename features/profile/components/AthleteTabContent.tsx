import { Heart, Activity } from 'lucide-react'
import { CustomCard } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import { ZoneRow } from '@profile/components/ZoneRow'
import { MetricBox } from '@profile/components/MetricBox'

const HR_ZONES = [
  { zone: 'Z1', name: 'Recuperación Activa', range: '< 132 bpm', color: 'bg-hr-z1' },
  { zone: 'Z2', name: 'Base Aeróbica', range: '132 – 150 bpm', color: 'bg-hr-z2' },
  { zone: 'Z3', name: 'Tempo / Ritmo', range: '151 – 165 bpm', color: 'bg-hr-z3' },
  { zone: 'Z4', name: 'Umbral Anaeróbico', range: '166 – 178 bpm', color: 'bg-hr-z4' },
  { zone: 'Z5', name: 'Capacidad Máxima / VO2', range: '> 178 bpm', color: 'bg-hr-z5' },
]

export function AthleteTabContent() {
  return (
    <div className='space-y-3 mt-2'>
      {/* ── Tarjeta de Información Física y Fisiológica ── */}
      <CustomCard>
        <CardHeader title='Información Física & Rendimiento' icon={Activity} />
        <div className='grid grid-cols-2 gap-2'>
          <MetricBox label='Peso' value='72 kg' />
          <MetricBox label='FC Máx' value='188 bpm' />
          <MetricBox label='VO2 Máx' value='54 ml/kg' />
          <MetricBox label='Altura' value='1.75 m' />
          <MetricBox label='FC Reposo' value='46 bpm' />
          <MetricBox label='Umbral Lactato' value='172 bpm' />
        </div>
      </CustomCard>

      {/* ── Zonas Cardíacas ── */}
      <CustomCard>
        <CardHeader title='Zonas Cardíacas (FC)' icon={Heart} />
        <div className='space-y-2'>
          {HR_ZONES.map((zone) => (
            <ZoneRow key={zone.zone} {...zone} />
          ))}
        </div>
      </CustomCard>
    </div>
  )
}

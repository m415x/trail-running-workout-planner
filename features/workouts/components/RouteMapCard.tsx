'use client'

import dynamic from 'next/dynamic'
import { RouteMapCardProps } from '@/features/workouts/types/workout.types'
import { Navigation, Route, TrendingUp, Angle } from 'lucide-react'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill } from '@/components/ui/custom/pills'

// Carga dinámica de Leaflet (solo en cliente / SSR disabled)
const MapWithNoSSR = dynamic(() => import('@/components/maps/MapInner'), {
  ssr: false,
  loading: () => (
    <div className='w-full h-48 rounded-2xl bg-secondary/50 animate-pulse flex items-center justify-center text-xs text-muted-foreground'>
      Cargando mapa GPS...
    </div>
  ),
})

export function RouteMapCard({
  title,
  distanceKm,
  gainMeters,
  maxGradePct = 0,
  positions = [],
  mapKey,
}: RouteMapCardProps) {
  return (
    <CustomCard>
      {/* Header con botón para cargar GPX futuro */}
      <CardHeader title='Track GPS' icon={Route} subtitle={title}>
        {/* <PrimaryOutlineButton onClick={onUploadGpx}>
          <Upload size={11} />
          <span>Cargar GPX</span>
        </PrimaryOutlineButton> */}
      </CardHeader>

      {/* Contenedor del Mapa con Leaflet */}
      <div className='relative h-52 w-full rounded-2xl border border-border/50 overflow-hidden my-2'>
        <MapWithNoSSR key={mapKey ?? `${title}-${positions.length}`} positions={positions} />
      </div>

      {/* Resumen de Métricas del GPX */}
      <div className='grid grid-cols-3 gap-2.5'>
        <StatPill icon={Navigation} label='Distancia' value={distanceKm} unit='km' />
        <StatPill icon={TrendingUp} label='Desnivel' value={`+${gainMeters}`} unit='m' />
        <StatPill icon={Angle} label='Pendiente Máx.' value={maxGradePct} unit='%' />
      </div>
    </CustomCard>
  )
}

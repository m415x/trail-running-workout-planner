'use client'

import dynamic from 'next/dynamic'
import { Navigation, Navigation2, Route, TrendingUp, Angle } from 'lucide-react'
import { TrackPoint } from '@/types'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill } from '@/components/ui/custom/pills'
import { PrimaryOutlineButton } from '@/components/ui/custom/buttons'

// Carga dinámica de Leaflet (solo en cliente / SSR disabled)
const MapWithNoSSR = dynamic(() => import('@/components/maps/MapInner'), {
  ssr: false,
  loading: () => (
    <div className='w-full h-48 rounded-2xl bg-secondary/50 animate-pulse flex items-center justify-center text-xs text-muted-foreground'>
      Cargando mapa GPS...
    </div>
  ),
})

export interface RouteMapCardProps {
  title?: string
  distanceKm: number
  gainMeters?: number
  maxGradePct?: number

  trackPoints?: TrackPoint[]

  mapKey?: string
  onUploadGpx?: () => void
}

export function RouteMapCard({
  title,
  distanceKm,
  gainMeters,
  maxGradePct = 0,
  trackPoints = [],
  mapKey,
}: RouteMapCardProps) {
  // 1. Transformamos los TrackPoints a un array de tuplas [lat, lon] que Leaflet entiende
  const positions: [number, number][] = trackPoints.map((tp) => [tp.lat, tp.lon])

  // 2. Determinamos el punto de inicio para el botón de Google Maps
  const startCoordinates = positions.length > 0 ? positions[0] : null
  const navigationUrl = startCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${startCoordinates[0]},${startCoordinates[1]}`
    : null

  return (
    <CustomCard>
      {/* Header con botón para cargar GPX futuro */}
      <CardHeader title='Track GPS' icon={Route} subtitle={title}>
        {navigationUrl && (
          <PrimaryOutlineButton
            onClick={() => {
              if (navigationUrl) {
                window.open(navigationUrl, '_blank', 'noopener,noreferrer')
              }
            }}
            className='rounded-full font-mono text-xs h-0 py-3.5'
          >
            <Navigation2 className='size-3! fill-primary' />
            <span>Cómo llegar</span>
          </PrimaryOutlineButton>
        )}
      </CardHeader>

      {/* Contenedor del Mapa con Leaflet */}
      <div className='relative h-60 w-full rounded-2xl border border-border/50 overflow-hidden'>
        <MapWithNoSSR key={mapKey ?? `${title}-${trackPoints.length}`} trackPoints={trackPoints} />
      </div>

      {/* Resumen de Métricas del GPX */}
      <div className='grid grid-cols-3 gap-2'>
        <StatPill icon={Navigation} label='Distancia' value={distanceKm} unit='km' />
        <StatPill icon={TrendingUp} label='Desnivel' value={`+${gainMeters}`} unit='m' />
        <StatPill icon={Angle} label='Pendiente Máx.' value={maxGradePct} unit='%' />
      </div>
    </CustomCard>
  )
}

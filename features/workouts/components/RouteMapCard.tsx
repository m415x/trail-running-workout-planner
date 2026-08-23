'use client'

import dynamic from 'next/dynamic'
import { Navigation, Navigation2, Route, TrendingUp, Mountain } from 'lucide-react'
import { TrackPoint } from '@/types'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill } from '@/components/ui/custom/pills'
import { PrimaryOutlineButton } from '@/components/ui/custom/buttons'

// Carga dinámica de MapLibre (solo en cliente / SSR disabled para WebGL)
const MapWithNoSSR = dynamic(() => import('@/components/maps/MapInner'), {
  ssr: false,
  loading: () => (
    <div className='w-full h-full rounded-2xl bg-secondary/50 animate-pulse flex items-center justify-center text-xs text-muted-foreground'>
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
  gainMeters = 0,
  maxGradePct = 0,
  trackPoints = [],
  mapKey,
}: RouteMapCardProps) {
  // Punto de largada para el botón externo de Google Maps
  const firstPoint = trackPoints.length > 0 ? trackPoints[0] : null
  const navigationUrl = firstPoint
    ? `https://www.google.com/maps/dir/?api=1&destination=${firstPoint.lat},${firstPoint.lon}`
    : null

  return (
    <CustomCard>
      {/* Header con botón para navegación externa */}
      <CardHeader title='Track GPS' icon={Route} subtitle={title}>
        {navigationUrl && (
          <PrimaryOutlineButton
            onClick={() => {
              window.open(navigationUrl, '_blank', 'noopener,noreferrer')
            }}
            className='rounded-full font-mono text-xs h-0 py-3.5'
          >
            <Navigation2 className='size-3 fill-primary' />
            <span>Cómo llegar</span>
          </PrimaryOutlineButton>
        )}
      </CardHeader>

      {/* Contenedor del Mapa MapLibre GL */}
      <div className='relative h-60 w-full rounded-2xl border border-border/50 overflow-hidden'>
        <MapWithNoSSR key={mapKey ?? `${title}-${trackPoints.length}`} trackPoints={trackPoints} />
      </div>

      {/* Resumen de Métricas del GPX */}
      <div className='grid grid-cols-3 gap-2'>
        <StatPill icon={Navigation} label='Distancia' value={distanceKm} unit='km' />
        <StatPill icon={TrendingUp} label='Desnivel' value={`+${gainMeters}`} unit='m' />
        <StatPill icon={Mountain} label='Pendiente Máx.' value={maxGradePct} unit='%' />
      </div>
    </CustomCard>
  )
}

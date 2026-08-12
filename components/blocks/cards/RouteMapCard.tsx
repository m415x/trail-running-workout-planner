'use client'

import dynamic from 'next/dynamic'
import { Navigation, Route, TrendingUp, Upload } from 'lucide-react'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { StatPill } from '@/components/ui/custom/pills'

// Carga diferida del mapa omitiendo el Server-Side Rendering
const MapInner = dynamic(() => import('@/components/blocks/maps/MapInner'), {
  ssr: false,
  loading: () => (
    <div className='w-full h-full bg-secondary/30 animate-pulse flex items-center justify-center text-xs text-muted-foreground font-sans rounded-2xl'>
      Cargando mapa...
    </div>
  ),
})

export interface RouteMapCardProps {
  name?: string
  distanceKm?: number
  gainMeters?: number
  maxGradePct?: number
  lat?: number
  lng?: number
  onUploadGpx?: () => void
}

export function RouteMapCard({
  name = 'Ruta',
  distanceKm = 0,
  gainMeters = 0,
  maxGradePct = 0,
  lat = -31.48,
  lng = -68.65,
  onUploadGpx,
}: RouteMapCardProps) {
  return (
    <CustomCard>
      {/* Header con botón para cargar GPX futuro */}
      <CardHeader title='Track GPS' icon={Route} subtitle={name}>
        <button
          type='button'
          onClick={onUploadGpx}
          className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer font-sans'
        >
          <Upload size={11} />
          <span>Cargar GPX</span>
        </button>
      </CardHeader>

      {/* Visor de Leaflet con estilo oscuro ajustado */}
      <div className='relative h-48 w-full rounded-2xl border border-border/50 overflow-hidden my-2'>
        <MapInner lat={lat} lng={lng} />
      </div>

      {/* Métricas rápidas del Track usando StatPill */}
      <div className='grid grid-cols-3 gap-2.5'>
        <StatPill icon={Navigation} label='Distancia' value={distanceKm} unit='km' />
        <StatPill icon={TrendingUp} label='Desnivel' value={`+${gainMeters}`} unit='m' />
        <StatPill icon={Route} label='Pendiente Máx.' value={maxGradePct} unit='%' />
      </div>
    </CustomCard>
  )
}

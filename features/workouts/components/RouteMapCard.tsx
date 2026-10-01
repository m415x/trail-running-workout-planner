'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Navigation, Navigation2, Route, TrendingUp, Mountain } from 'lucide-react'
import { TrackPoint } from '@/types'
import { CustomCard } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import { StatPill } from '@ui/custom/pills'
import { PrimaryOutlineButton } from '@ui/custom/buttons'

function MapLoading() {
  const t = useTranslations('Workouts')
  return (
    <div role='status' className='flex h-full w-full items-center justify-center rounded-2xl bg-secondary/50 text-sm text-muted-foreground animate-pulse'>
      {t('map.loading')}
    </div>
  )
}

// Carga dinámica de MapLibre (solo en cliente / SSR disabled para WebGL)
const MapWithNoSSR = dynamic(() => import('@/components/maps/MapInner'), {
  ssr: false,
  loading: () => <MapLoading />,
})

export interface RouteMapCardProps {
  title?: string
  distanceKm: number
  gainMeters?: number
  maxGradePct?: number
  trackPoints?: TrackPoint[]
  onUploadGpx?: () => void
}

export function RouteMapCard({
  title = 'Track',
  distanceKm = 0,
  gainMeters = 0,
  maxGradePct = 0,
  trackPoints = [],
}: RouteMapCardProps) {
  const t = useTranslations('Workouts')
  // Punto de largada para el botón externo de Google Maps
  const firstPoint = trackPoints.find((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)) ?? null
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
            <span>{t('map.meetingPoint')}</span>
          </PrimaryOutlineButton>
        )}
      </CardHeader>

      {/* Contenedor del Mapa MapLibre GL */}
      <div className='relative h-60 w-full rounded-2xl border border-border/50 overflow-hidden'>
        <MapWithNoSSR trackPoints={trackPoints} />
      </div>

      {/* Resumen de Métricas del GPX */}
      <div className='grid grid-cols-3 gap-2'>
        <StatPill icon={Navigation} label={t('map.distance')} value={distanceKm} unit='km' />
        <StatPill icon={TrendingUp} label={t('map.elevationGain')} value={`+${gainMeters}`} unit='m' />
        <StatPill icon={Mountain} label={t('map.maxGrade')} value={maxGradePct} unit='%' />
      </div>
    </CustomCard>
  )
}

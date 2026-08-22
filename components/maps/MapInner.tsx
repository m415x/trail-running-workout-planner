'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet'
import L, { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import GradientTrack from '@/components/maps/GradientTrackLayer'
import { PrimaryOutlineButton } from '@/components/ui/custom/buttons'
import { TrackPoint } from '@/types'

// Controlador para mover/ajustar la cámara sin desmontar el mapa
function MapViewController({
  positions,
  fallbackCenter,
  zoom,
}: {
  positions: LatLngTuple[]
  fallbackCenter: LatLngTuple
  zoom: number
}) {
  const map = useMap()

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
    } else {
      map.setView(fallbackCenter, zoom)
    }
  }, [positions, fallbackCenter, zoom, map])

  return null
}

const startIcon = L.divIcon({
  className: 'custom-map-pin',
  html: `<div class="w-4 h-4 bg-green-500 border-2 border-background rounded-full shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const endIcon = L.divIcon({
  className: 'custom-map-pin',
  html: `<div class="w-4 h-4 bg-red-500 border-2 border-background rounded-full shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

interface MapInnerProps {
  lat?: number
  lon?: number
  zoom?: number
  trackPoints?: TrackPoint[]
}

export default function MapInner({ lat = -31.529822, lon = -68.5440881, zoom = 14, trackPoints = [] }: MapInnerProps) {
  const defaultCenter: LatLngTuple = [lat, lon]
  const positions = trackPoints.map(({ lat, lon }) => [lat, lon] as LatLngTuple)
  const elevations = trackPoints.map(({ ele }) => ele)

  const startPosition: LatLngTuple = positions.length > 0 ? positions[0] : defaultCenter
  const endPosition: LatLngTuple = positions.length > 0 ? positions[positions.length - 1] : defaultCenter

  const lowestPosition: L.LatLngTuple | null = lowestPoint ? ([lowestPoint.lat, lowestPoint.lon] as LatLngTuple) : null

  // Determinamos el punto de inicio y fin del track o fallback
  const navigationStartUrl = startPosition
    ? `https://www.google.com/maps/dir/?api=1&destination=${startPosition[0]},${startPosition[1]}`
    : null

  const navigationEndUrl = endPosition
    ? `https://www.google.com/maps/dir/?api=1&destination=${endPosition[0]},${endPosition[1]}`
    : null

  return (
    <MapContainer
      center={startPosition}
      zoom={zoom}
      scrollWheelZoom={false}
      className='w-full h-full rounded-2xl z-0 overflow-hidden'
    >
      <LayersControl position='topright'>
        {/* 1. Capa Estándar (OpenStreetMap) */}
        <LayersControl.BaseLayer checked name='🗺️ Estándar'>
          <TileLayer
            // attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        {/* 2. Capa Topográfica con Curvas de Nivel (OpenTopoMap) */}
        <LayersControl.BaseLayer name='⛰️ Topográfico'>
          <TileLayer
            // attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
            url='https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
            maxZoom={17}
          />
        </LayersControl.BaseLayer>

        {/* 3. Capa Satélite (ESRI World Imagery) */}
        <LayersControl.BaseLayer name='🛰️ Satélite'>
          <TileLayer
            // attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            maxZoom={18}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* Controlador de cámara reactivo */}
      <MapViewController positions={positions} fallbackCenter={defaultCenter} zoom={zoom} />

      {/* Trazada GPS de la ruta en color contrastante */}
      {positions.length > 0 && (
        <GradientTrack
          positions={positions}
          elevations={elevations}
          weight={4}
          opacity={0.92}
          simplifyTolerance={1.2}
        />
      )}

      {/* Marcador en el punto de largada */}
      <Marker position={startPosition} icon={startIcon}>
        <Popup className='font-sans text-xs'>
          <div className='flex flex-col align-center gap-1.5 p-0.5'>
            <span className='font-bold text-foreground text-center'>Punto de Largada</span>
            <span className='text-[10px] text-muted-foreground text-center'>
              {startPosition[0].toFixed(5)}, {startPosition[1].toFixed(5)}
            </span>
            <PrimaryOutlineButton
              onClick={() => {
                if (navigationStartUrl) {
                  window.open(navigationStartUrl, '_blank', 'noopener,noreferrer')
                }
              }}
              className='rounded-full font-mono font-[10px] h-0 py-2.5'
            >
              <span>Cómo llegar</span>
            </PrimaryOutlineButton>
          </div>
        </Popup>
      </Marker>

      {/* Marcador en el punto de llegada */}
      <Marker position={endPosition} icon={endIcon}>
        <Popup className='font-sans text-xs'>
          <div className='flex flex-col align-center gap-1.5 p-0.5'>
            <span className='font-bold text-foreground text-center'>Punto de Llegada</span>
            <span className='text-[10px] text-muted-foreground text-center'>
              {endPosition[0].toFixed(5)}, {endPosition[1].toFixed(5)}
            </span>
            <PrimaryOutlineButton
              onClick={() => {
                if (navigationEndUrl) {
                  window.open(navigationEndUrl, '_blank', 'noopener,noreferrer')
                }
              }}
              className='rounded-full font-mono font-[10px] h-0 py-2.5'
            >
              <span>Cómo llegar</span>
            </PrimaryOutlineButton>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  )
}

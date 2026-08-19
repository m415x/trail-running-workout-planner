'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L, { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Controlador unificado para mover/ajustar la cámara sin desmontar el mapa ──
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

const customIcon = L.divIcon({
  className: 'custom-map-pin',
  html: `<div class="w-4 h-4 bg-primary border-2 border-background rounded-full shadow-lg"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

interface MapInnerProps {
  lat?: number
  lon?: number
  zoom?: number
  positions?: LatLngTuple[]
}

export default function MapInner({ lat = -31.529822, lon = -68.5440881, zoom = 14, positions = [] }: MapInnerProps) {
  const defaultCenter: LatLngTuple = [lat, lon]
  const startPosition: LatLngTuple = positions.length > 0 ? positions[0] : defaultCenter

  return (
    <MapContainer
      center={startPosition}
      zoom={zoom}
      scrollWheelZoom={false}
      className='w-full h-full rounded-2xl z-0 overflow-hidden'
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />

      {/* Controlador de cámara reactivo (sustituye el key re-mount) */}
      <MapViewController positions={positions} fallbackCenter={defaultCenter} zoom={zoom} />

      {/* Trazada GPS del track */}
      {positions.length > 0 && <Polyline positions={positions} color='#161af9' weight={2} opacity={0.7} />}

      {/* Marcador en el punto de largada */}
      <Marker position={startPosition} icon={customIcon}>
        <Popup className='font-sans text-xs'>Punto de largada</Popup>
      </Marker>
    </MapContainer>
  )
}

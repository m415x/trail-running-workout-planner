'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L, { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Componente helper para centrar y hacer zoom automático al recorrido
function AutoFitBounds({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap()

  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [positions, map])

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
  lng?: number
  zoom?: number
  positions?: LatLngTuple[] // Usamos LatLngTuple ([number, number])
}

export default function MapInner({ lat = -31.48, lng = -68.65, zoom = 14, positions = [] }: MapInnerProps) {
  // Aseguramos que startPosition sea estrictamente una LatLngTuple de 2 elementos
  const startPosition: LatLngTuple = positions.length > 0 ? positions[0] : [lat, lng]

  // Generamos una clave única basada en las coordenadas iniciales
  const mapKey = positions.length > 0 ? `${positions[0][0]}-${positions[0][1]}` : 'default-map'

  return (
    <MapContainer
      key={mapKey}
      center={startPosition}
      zoom={zoom}
      scrollWheelZoom={false}
      className='w-full h-full rounded-2xl z-0 overflow-hidden'
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />

      {/* Trazada GPS de la carrera */}
      {positions.length > 0 && (
        <>
          <Polyline positions={positions} color='#161af9' weight={2} opacity={0.7} />
          <AutoFitBounds positions={positions} />
        </>
      )}

      {/* Marcador en la largada */}
      <Marker position={startPosition} icon={customIcon}>
        <Popup className='font-sans text-xs'>Punto de largada</Popup>
      </Marker>
    </MapContainer>
  )
}

'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Solución limpia para el ícono del Marker en Next.js
const customIcon = L.divIcon({
  className: 'custom-map-pin',
  html: `<div class="w-4 h-4 bg-primary border-2 border-background rounded-full shadow-lg pulse"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

interface MapInnerProps {
  lat?: number
  lng?: number
  zoom?: number
}

export default function MapInner({ lat = -31.48, lng = -68.65, zoom = 9 }: MapInnerProps) {
  return (
    <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={false} className='w-full h-full rounded-xl z-0'>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />
      <Marker position={[lat, lng]} icon={customIcon}>
        <Popup className='font-sans text-xs'>
          <strong>Ruta</strong>
          <br />
          Punto de largada
        </Popup>
      </Marker>
    </MapContainer>
  )
}

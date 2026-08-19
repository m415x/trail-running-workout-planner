'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, LayersControl } from 'react-leaflet'
import L, { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
      <LayersControl position='topright'>
        {/* 1. Capa Topográfica con Curvas de Nivel (OpenTopoMap) */}
        <LayersControl.BaseLayer checked name='⛰️ Topográfico'>
          <TileLayer
            // attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
            url='https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
            maxZoom={17}
          />
        </LayersControl.BaseLayer>

        {/* 2. Capa Satélite (ESRI World Imagery) */}
        <LayersControl.BaseLayer name='🛰️ Satélite'>
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            maxZoom={18}
          />
        </LayersControl.BaseLayer>

        {/* 3. Capa Estándar (OpenStreetMap) */}
        <LayersControl.BaseLayer name='🗺️ Estándar'>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* Controlador de cámara reactivo */}
      <MapViewController positions={positions} fallbackCenter={defaultCenter} zoom={zoom} />

      {/* Trazada GPS de la ruta en color contrastante */}
      {positions.length > 0 && <Polyline positions={positions} color='#e11d48' weight={3.5} opacity={0.85} />}

      {/* Marcador en el punto de inicio */}
      <Marker position={startPosition} icon={customIcon}>
        <Popup className='font-sans text-xs'>Punto de largada</Popup>
      </Marker>
    </MapContainer>
  )
}

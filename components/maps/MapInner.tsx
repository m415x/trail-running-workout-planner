'use client'

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, LineString } from 'geojson'
import { getMapLibreOklchGradientExpression } from '@/utils/trackColors'
import { TrackPoint } from '@/types'

const BASE_STYLES = {
  standard: {
    name: '🗺️ Estándar',
    style: {
      version: 8 as const,
      sources: {
        'osm-tiles': {
          type: 'raster' as const,
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        },
      },
      layers: [
        {
          id: 'osm-tiles-layer',
          type: 'raster' as const,
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  topo: {
    name: '⛰️ Topográfico',
    style: {
      version: 8 as const,
      sources: {
        'opentopo-tiles': {
          type: 'raster' as const,
          tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenTopoMap',
        },
      },
      layers: [
        {
          id: 'opentopo-tiles-layer',
          type: 'raster' as const,
          source: 'opentopo-tiles',
          minzoom: 0,
          maxzoom: 17,
        },
      ],
    },
  },
  satellite: {
    name: '🛰️ Satelital',
    style: {
      version: 8 as const,
      sources: {
        'esri-tiles': {
          type: 'raster' as const,
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
      },
      layers: [
        {
          id: 'esri-tiles-layer',
          type: 'raster' as const,
          source: 'esri-tiles',
          minzoom: 0,
          maxzoom: 18,
        },
      ],
    },
  },
}

interface MapInnerProps {
  lat?: number
  lon?: number
  zoom?: number
  trackPoints?: TrackPoint[]
}

export default function MapInner({ lat = -31.529822, lon = -68.5440881, zoom = 13, trackPoints = [] }: MapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [selectedLayer, setSelectedLayer] = useState<keyof typeof BASE_STYLES>('standard')

  // MapLibre REQUIERE [Longitud, Latitud]
  const validCoordinates: [number, number][] = trackPoints
    .filter((pt) => Number.isFinite(pt.lon) && Number.isFinite(pt.lat))
    .map((pt) => [pt.lon, pt.lat])

  const initialCenter: [number, number] = validCoordinates.length > 0 ? validCoordinates[0] : [lon, lat]

  // Función principal para renderizar la ruta y los pines
  const renderTrackAndMarkers = (map: maplibregl.Map) => {
    // 1. Limpiar marcadores previos
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (validCoordinates.length === 0) return

    const geojsonData: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: validCoordinates,
      },
    }

    // 2. Limpieza y reconstrucción de la capa para asegurar que lineMetrics tome efecto
    if (map.getLayer('trail-track-layer')) {
      map.removeLayer('trail-track-layer')
    }
    if (map.getSource('trail-track')) {
      map.removeSource('trail-track')
    }

    map.addSource('trail-track', {
      type: 'geojson',
      data: geojsonData,
      lineMetrics: true,
    })

    map.addLayer({
      id: 'trail-track-layer',
      type: 'line',
      source: 'trail-track',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-width': 5,
        'line-opacity': 0.95,
        'line-gradient': getMapLibreOklchGradientExpression(16),
      },
    })

    // 3. Marcadores
    const startCoord = validCoordinates[0]
    const endCoord = validCoordinates[validCoordinates.length - 1]

    // Pin Inicio
    const startEl = document.createElement('div')
    startEl.className = 'w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-md cursor-pointer'
    const startPopup = new maplibregl.Popup({ offset: 10 }).setHTML(
      `<div class="p-1 text-center font-sans text-xs">
        <b>Punto de Largada</b><br/>
        <span class="text-[10px] text-gray-500">${startCoord[1].toFixed(5)}, ${startCoord[0].toFixed(5)}</span>
      </div>`,
    )
    const startMarker = new maplibregl.Marker({ element: startEl })
      .setLngLat(startCoord)
      .setPopup(startPopup)
      .addTo(map)
    markersRef.current.push(startMarker)

    // Pin Llegada
    if (validCoordinates.length > 1) {
      const endEl = document.createElement('div')
      endEl.className = 'w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-md cursor-pointer'
      const endPopup = new maplibregl.Popup({ offset: 10 }).setHTML(
        `<div class="p-1 text-center font-sans text-xs">
          <b>Punto de Llegada</b><br/>
          <span class="text-[10px] text-gray-500">${endCoord[1].toFixed(5)}, ${endCoord[0].toFixed(5)}</span>
        </div>`,
      )
      const endMarker = new maplibregl.Marker({ element: endEl }).setLngLat(endCoord).setPopup(endPopup).addTo(map)
      markersRef.current.push(endMarker)
    }

    // 4. Centrar y encuadrar la cámara al track
    const bounds = validCoordinates.reduce(
      (b, coord) => b.extend(coord),
      new maplibregl.LngLatBounds(startCoord, startCoord),
    )

    map.fitBounds(bounds, { padding: 40, maxZoom: 16, animate: false })
  }

  // Inicializar Mapa
  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASE_STYLES[selectedLayer].style,
      center: initialCenter,
      zoom: zoom,
      scrollZoom: false,
    })

    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      renderTrackAndMarkers(map)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Cambio de capa base
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setStyle(BASE_STYLES[selectedLayer].style)
    map.once('style.load', () => {
      renderTrackAndMarkers(map)
    })
  }, [selectedLayer])

  // Actualización cuando cambian las props del track
  useEffect(() => {
    const map = mapRef.current
    if (map && map.isStyleLoaded()) {
      renderTrackAndMarkers(map)
    }
  }, [trackPoints])

  return (
    <div className='relative w-full h-full rounded-2xl overflow-hidden'>
      <div ref={mapContainerRef} className='w-full h-full' />

      {/* Selector de capas */}
      <div className='absolute top-3 right-3 bg-white/95 dark:bg-gray-900/95 p-1.5 rounded-xl shadow-lg flex flex-col gap-1 z-10 text-xs border border-border/50'>
        {(Object.keys(BASE_STYLES) as Array<keyof typeof BASE_STYLES>).map((key) => (
          <button
            key={key}
            type='button'
            onClick={() => setSelectedLayer(key)}
            className={`px-3 py-1.5 rounded-lg text-left transition-all ${
              selectedLayer === key
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {BASE_STYLES[key].name}
          </button>
        ))}
      </div>
    </div>
  )
}

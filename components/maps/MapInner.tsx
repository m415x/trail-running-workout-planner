'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type { TrackPoint } from '@/types'

const TRAIL_SOURCE_ID = 'trail-track'
const TRAIL_LAYER_ID = 'trail-track-layer'

type BaseStyleKey = 'standard' | 'topo' | 'satellite'

interface BaseStyle {
  name: string
  style: StyleSpecification
}

const BASE_STYLES: Record<BaseStyleKey, BaseStyle> = {
  standard: {
    name: '🗺️ Estándar',
    style: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        },
      },
      layers: [
        {
          id: 'osm-tiles-layer',
          type: 'raster',
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
      version: 8,
      sources: {
        'opentopo-tiles': {
          type: 'raster',
          tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenTopoMap',
        },
      },
      layers: [
        {
          id: 'opentopo-tiles-layer',
          type: 'raster',
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
      version: 8,
      sources: {
        'esri-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
      },
      layers: [
        {
          id: 'esri-tiles-layer',
          type: 'raster',
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
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const markersRef = useRef<maplibregl.Marker[]>([])

  const initializedRef = useRef(false)

  const [selectedLayer, setSelectedLayer] = useState<BaseStyleKey>('standard')

  /**
   * Filtramos coordenadas inválidas.
   */
  const validTrackPoints = useMemo(
    () => trackPoints.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)),
    [trackPoints],
  )

  /**
   * MapLibre = [longitude, latitude]
   */
  const coordinates = useMemo<[number, number][]>(
    () => validTrackPoints.map((point) => [point.lon, point.lat]),
    [validTrackPoints],
  )

  const center = useMemo<[number, number]>(
    () => (coordinates.length > 0 ? coordinates[0] : [lon, lat]),
    [coordinates, lon, lat],
  )

  /**
   * Identificador del track.
   *
   * Sirve para no hacer fitBounds continuamente.
   */
  const trackKey = useMemo(() => {
    if (validTrackPoints.length === 0) {
      return 'empty'
    }

    const first = validTrackPoints[0]
    const last = validTrackPoints[validTrackPoints.length - 1]

    return [validTrackPoints.length, first.lat, first.lon, last.lat, last.lon].join('|')
  }, [validTrackPoints])

  /**
   * GeoJSON.
   */
  const geojson = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates,
      },
    }),
    [coordinates],
  )

  /**
   * Elimina markers.
   */
  const clearMarkers = () => {
    markersRef.current.forEach((marker) => marker.remove())

    markersRef.current = []
  }

  /**
   * Crea markers de inicio y fin.
   */
  const renderMarkers = (map: maplibregl.Map) => {
    clearMarkers()

    if (coordinates.length === 0) {
      return
    }

    const start = coordinates[0]

    const startElement = document.createElement('div')

    startElement.className = 'w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-md'

    const startMarker = new maplibregl.Marker({
      element: startElement,
    })
      .setLngLat(start)
      .setPopup(
        new maplibregl.Popup({
          offset: 10,
        }).setHTML(`
            <div class="p-1 text-center font-sans text-xs">
              <strong>Punto de Largada</strong>
              <br />
              <span class="text-[10px] text-gray-500">
                ${start[1].toFixed(5)},
                ${start[0].toFixed(5)}
              </span>
            </div>
          `),
      )
      .addTo(map)

    markersRef.current.push(startMarker)

    if (coordinates.length > 1) {
      const end = coordinates[coordinates.length - 1]

      const endElement = document.createElement('div')

      endElement.className = 'w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-md'

      const endMarker = new maplibregl.Marker({
        element: endElement,
      })
        .setLngLat(end)
        .setPopup(
          new maplibregl.Popup({
            offset: 10,
          }).setHTML(`
              <div class="p-1 text-center font-sans text-xs">
                <strong>Punto de Llegada</strong>
                <br />
                <span class="text-[10px] text-gray-500">
                  ${end[1].toFixed(5)},
                  ${end[0].toFixed(5)}
                </span>
              </div>
            `),
        )
        .addTo(map)

      markersRef.current.push(endMarker)
    }
  }

  /**
   * Crea el source + layer del track.
   *
   * IMPORTANTE:
   * Esta función se ejecuta DESPUÉS de que el estilo
   * esté completamente cargado.
   */
  const ensureTrackLayer = (map: maplibregl.Map) => {
    console.log('[GradientTrack] ensureTrackLayer', {
      coordinates: coordinates.length,
      styleLoaded: map.isStyleLoaded(),
    })

    /**
     * Si no hay track, no hacemos nada.
     */
    if (coordinates.length < 2) {
      console.warn('[GradientTrack] No hay suficientes coordenadas')

      return
    }

    /**
     * SOURCE
     */
    let source = map.getSource(TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource | undefined

    if (!source) {
      console.log('[GradientTrack] Creando source')

      map.addSource(TRAIL_SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        lineMetrics: true,
      })

      source = map.getSource(TRAIL_SOURCE_ID) as maplibregl.GeoJSONSource
    } else {
      console.log('[GradientTrack] Actualizando source')

      source.setData(geojson)
    }

    /**
     * LAYER
     */
    if (!map.getLayer(TRAIL_LAYER_ID)) {
      console.log('[GradientTrack] Creando layer')

      map.addLayer({
        id: TRAIL_LAYER_ID,
        type: 'line',
        source: TRAIL_SOURCE_ID,

        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },

        paint: {
          /**
           * COLOR FIJO TEMPORAL.
           *
           * No estamos usando todavía OKLCH.
           */
          'line-color': '#ff006e',

          'line-width': 6,

          'line-opacity': 1,
        },
      })
    }

    console.log('[GradientTrack] Layer creada:', !!map.getLayer(TRAIL_LAYER_ID))
  }

  /**
   * Ajusta cámara.
   */
  const fitTrack = (map: maplibregl.Map) => {
    if (coordinates.length === 0) {
      return
    }

    const first = coordinates[0]

    const bounds = coordinates.reduce(
      (bounds, coordinate) => bounds.extend(coordinate),
      new maplibregl.LngLatBounds(first, first),
    )

    map.fitBounds(bounds, {
      padding: 50,
      maxZoom: 16,
      animate: false,
    })
  }

  /**
   * INICIALIZACIÓN DEL MAPA
   */
  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (initializedRef.current) {
      return
    }

    initializedRef.current = true

    console.log('[GradientTrack] Inicializando mapa')

    const map = new maplibregl.Map({
      container: containerRef.current,

      style: BASE_STYLES[selectedLayer].style,

      center,

      zoom,

      scrollZoom: false,
    })

    mapRef.current = map

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
      }),
      'bottom-right',
    )

    map.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 80,
        unit: 'metric',
      }),
      'bottom-left',
    )

    /**
     * CARGA INICIAL
     */
    map.once('load', () => {
      console.log('[GradientTrack] MAP LOAD')

      console.log('[GradientTrack] puntos:', coordinates.length)

      console.log('[GradientTrack] coordenadas:', coordinates.slice(0, 3))

      ensureTrackLayer(map)

      renderMarkers(map)

      if (coordinates.length > 0) {
        fitTrack(map)
      }
    })

    /**
     * Errores de MapLibre.
     */
    map.on('error', (event) => {
      console.error('[GradientTrack] MapLibre error:', event.error)
    })

    return () => {
      clearMarkers()

      map.remove()

      mapRef.current = null

      initializedRef.current = false
    }

    // Inicialización deliberadamente única.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * ACTUALIZACIÓN DEL TRACK
   */
  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    if (!map.isStyleLoaded()) {
      return
    }

    if (coordinates.length < 2) {
      clearMarkers()
      return
    }

    console.log('[GradientTrack] Actualizando track', {
      points: coordinates.length,
      trackKey,
    })

    ensureTrackLayer(map)

    renderMarkers(map)
  }, [trackKey, coordinates, geojson])

  /**
   * CAMBIO DE MAPA BASE
   */
  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    /**
     * Durante la creación inicial no hacemos
     * setStyle().
     */
    if (!map.isStyleLoaded()) {
      return
    }

    console.log('[GradientTrack] Cambiando estilo:', selectedLayer)

    const handleStyleLoad = () => {
      console.log('[GradientTrack] Nuevo estilo cargado')

      /**
       * setStyle elimina los sources/layers
       * del estilo anterior.
       *
       * Por eso los volvemos a crear.
       */
      ensureTrackLayer(map)

      renderMarkers(map)
    }

    map.once('style.load', handleStyleLoad)

    map.setStyle(BASE_STYLES[selectedLayer].style)

    return () => {
      map.off('style.load', handleStyleLoad)
    }
  }, [selectedLayer])

  return (
    <div className='relative w-full h-full rounded-2xl overflow-hidden'>
      <div ref={containerRef} className='w-full h-full' />

      <div className='absolute top-3 right-3 bg-white/95 dark:bg-gray-900/95 p-1.5 rounded-xl shadow-lg flex flex-col gap-1 z-10 text-xs border border-border/50'>
        {(Object.keys(BASE_STYLES) as BaseStyleKey[]).map((key) => (
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

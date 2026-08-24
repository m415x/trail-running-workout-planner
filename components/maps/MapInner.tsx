'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import type { StyleSpecification } from 'maplibre-gl'

import 'maplibre-gl/dist/maplibre-gl.css'

import { getMapLibreAltitudeColorExpression } from '@/utils/trackColors'

import { TrackPoint } from '@/types'

/* -------------------------------------------------------------------------- */
/* BASE MAP STYLES                                                            */
/* -------------------------------------------------------------------------- */

const BASE_STYLES = {
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
    } satisfies StyleSpecification,
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
    } satisfies StyleSpecification,
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
    } satisfies StyleSpecification,
  },
} as const

type BaseStyleKey = keyof typeof BASE_STYLES

/* -------------------------------------------------------------------------- */
/* TRACK CONSTANTS                                                            */
/* -------------------------------------------------------------------------- */

const TRAIL_SOURCE_ID = 'trail-track'
const TRAIL_LAYER_ID = 'trail-track-layer'

/* -------------------------------------------------------------------------- */
/* GEOJSON TYPES                                                              */
/* -------------------------------------------------------------------------- */

type AltitudeSegmentProperties = {
  altitudePercent: number
  elevation: number
}

type AltitudeSegment = Feature<LineString, AltitudeSegmentProperties>

type AltitudeFeatureCollection = FeatureCollection<LineString, AltitudeSegmentProperties>

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Devuelve solamente los puntos que tienen coordenadas y elevación válidas.
 */
function getValidTrackPoints(points: TrackPoint[]): TrackPoint[] {
  return points.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon) && Number.isFinite(point.ele),
  )
}

/**
 * Convierte el track en pequeños segmentos GeoJSON.
 *
 * Cada segmento recibe un altitudePercent entre 0 y 1.
 *
 * 0 = punto más bajo del track
 * 1 = punto más alto del track
 *
 * Importante:
 * no utilizamos line-progress.
 */
function buildAltitudeSegments(points: TrackPoint[]): {
  geojson: AltitudeFeatureCollection
  minElevation: number
  maxElevation: number
} {
  const validPoints = getValidTrackPoints(points)

  if (validPoints.length < 2) {
    return {
      geojson: {
        type: 'FeatureCollection',
        features: [],
      },
      minElevation: validPoints.length === 1 ? validPoints[0].ele : 0,
      maxElevation: validPoints.length === 1 ? validPoints[0].ele : 0,
    }
  }

  const elevations = validPoints.map((point) => point.ele)

  const minElevation = Math.min(...elevations)
  const maxElevation = Math.max(...elevations)

  const elevationRange = maxElevation - minElevation || 1

  const features: AltitudeSegment[] = []

  for (let index = 1; index < validPoints.length; index++) {
    const previous = validPoints[index - 1]
    const current = validPoints[index]

    /*
     * Usamos la elevación media del segmento.
     *
     * Esto evita que un segmento largo tenga un color
     * completamente determinado por uno solo de sus extremos.
     */
    const averageElevation = (previous.ele + current.ele) / 2

    const altitudePercent = (averageElevation - minElevation) / elevationRange

    features.push({
      type: 'Feature',

      properties: {
        elevation: averageElevation,

        altitudePercent: Math.max(0, Math.min(1, altitudePercent)),
      },

      geometry: {
        type: 'LineString',

        coordinates: [
          [previous.lon, previous.lat],
          [current.lon, current.lat],
        ],
      },
    })
  }

  return {
    geojson: {
      type: 'FeatureCollection',
      features,
    },

    minElevation,
    maxElevation,
  }
}

/**
 * Obtiene los bounds del track.
 */
function getTrackBounds(coordinates: [number, number][]): maplibregl.LngLatBounds | null {
  if (coordinates.length === 0) {
    return null
  }

  const first = coordinates[0]

  const bounds = new maplibregl.LngLatBounds(first, first)

  for (let index = 1; index < coordinates.length; index++) {
    bounds.extend(coordinates[index])
  }

  return bounds
}

/* -------------------------------------------------------------------------- */
/* PROPS                                                                      */
/* -------------------------------------------------------------------------- */

interface MapInnerProps {
  lat?: number
  lon?: number
  zoom?: number
  trackPoints?: TrackPoint[]
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function MapInner({ lat = -31.529822, lon = -68.5440881, zoom = 13, trackPoints = [] }: MapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const mapRef = useRef<maplibregl.Map | null>(null)

  const markersRef = useRef<maplibregl.Marker[]>([])

  const [selectedLayer, setSelectedLayer] = useState<BaseStyleKey>('standard')

  /*
   * Coordenadas válidas para MapLibre.
   *
   * MapLibre utiliza [longitude, latitude].
   */
  const validPoints = useMemo(() => getValidTrackPoints(trackPoints), [trackPoints])

  const coordinates = useMemo<[number, number][]>(
    () => validPoints.map((point) => [point.lon, point.lat]),
    [validPoints],
  )

  const initialCenter = useMemo<[number, number]>(
    () => (coordinates.length > 0 ? coordinates[0] : [lon, lat]),
    [coordinates, lon, lat],
  )

  /* ---------------------------------------------------------------------- */
  /* MARKERS                                                                */
  /* ---------------------------------------------------------------------- */

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove())

    markersRef.current = []
  }, [])

  const renderMarkers = useCallback(
    (map: maplibregl.Map) => {
      clearMarkers()

      if (coordinates.length === 0) {
        return
      }

      const startCoord = coordinates[0]

      const startElement = document.createElement('div')

      startElement.className = 'w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-md cursor-pointer'

      const startPopup = new maplibregl.Popup({
        offset: 10,
      }).setHTML(`
          <div class="p-1 text-center font-sans text-xs">
            <b>Punto de Largada</b>
            <br/>
            <span class="text-[10px] text-gray-500">
              ${startCoord[1].toFixed(5)},
              ${startCoord[0].toFixed(5)}
            </span>
          </div>
        `)

      const startMarker = new maplibregl.Marker({
        element: startElement,
      })
        .setLngLat(startCoord)
        .setPopup(startPopup)
        .addTo(map)

      markersRef.current.push(startMarker)

      /* ------------------------------ */
      /* END MARKER                     */
      /* ------------------------------ */

      if (coordinates.length > 1) {
        const endCoord = coordinates[coordinates.length - 1]

        const endElement = document.createElement('div')

        endElement.className = 'w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-md cursor-pointer'

        const endPopup = new maplibregl.Popup({
          offset: 10,
        }).setHTML(`
            <div class="p-1 text-center font-sans text-xs">
              <b>Punto de Llegada</b>
              <br/>
              <span class="text-[10px] text-gray-500">
                ${endCoord[1].toFixed(5)},
                ${endCoord[0].toFixed(5)}
              </span>
            </div>
          `)

        const endMarker = new maplibregl.Marker({
          element: endElement,
        })
          .setLngLat(endCoord)
          .setPopup(endPopup)
          .addTo(map)

        markersRef.current.push(endMarker)
      }
    },
    [clearMarkers, coordinates],
  )

  /* ---------------------------------------------------------------------- */
  /* TRACK SOURCE + LAYER                                                   */
  /* ---------------------------------------------------------------------- */

  //! Define un flag arriba o dentro del componente
  const USE_SOLID_COLOR = true

  const ensureTrackLayer = useCallback(
    (map: maplibregl.Map) => {
      if (!map.isStyleLoaded()) {
        return
      }

      /*
       * Si no hay track, eliminamos cualquier source/layer existente.
       */
      if (coordinates.length < 2) {
        if (map.getLayer(TRAIL_LAYER_ID)) {
          map.removeLayer(TRAIL_LAYER_ID)
        }

        if (map.getSource(TRAIL_SOURCE_ID)) {
          map.removeSource(TRAIL_SOURCE_ID)
        }

        return
      }

      const { geojson, minElevation, maxElevation } = buildAltitudeSegments(validPoints)

      if (geojson.features.length === 0) {
        return
      }
      console.log('[GEOJSON]', geojson) //! Prueba

      /*
       * --------------------------------------------------------------------
       * SOURCE
       * --------------------------------------------------------------------
       *
       * Si el source ya existe, NO lo eliminamos.
       *
       * Esto es importante para evitar parpadeos y problemas durante
       * actualizaciones del mapa.
       */
      const existingSource = map.getSource(TRAIL_SOURCE_ID)

      if (existingSource) {
        const geojsonSource = existingSource as maplibregl.GeoJSONSource

        geojsonSource.setData(geojson)
      } else {
        map.addSource(TRAIL_SOURCE_ID, {
          type: 'geojson',
          data: geojson,
        })
      }

      /*
       * --------------------------------------------------------------------
       * LAYER
       * --------------------------------------------------------------------
       */

      if (!map.getLayer(TRAIL_LAYER_ID)) {
        map.addLayer({
          id: TRAIL_LAYER_ID,

          type: 'line',

          source: TRAIL_SOURCE_ID,

          layout: {
            'line-cap': 'round',
            'line-join': 'round',
            visibility: 'visible',
          },

          paint: {
            /*
             * Una única capa.
             *
             * El color se calcula usando altitudePercent,
             * NO line-progress.
             */
            // 'line-color': getMapLibreAltitudeColorExpression(),
            'line-color': USE_SOLID_COLOR //! PRUEBA
              ? '#2563eb' // Color sólido visible (azul)
              : (getMapLibreAltitudeColorExpression() as any),

            'line-width': 5,

            'line-opacity': 0.95,
          },
        })
      } else {
        //! PRUEBA
        // Asegura que si la capa ya existía, tome el color actual
        map.setPaintProperty(
          TRAIL_LAYER_ID,
          'line-color',
          USE_SOLID_COLOR ? '#2563eb' : getMapLibreAltitudeColorExpression(),
        )
      }

      //! Forzar que quede al frente
      if (map.getLayer(TRAIL_LAYER_ID)) {
        map.moveLayer(TRAIL_LAYER_ID)
      }

      /*
       * Nos aseguramos de que el track quede por encima
       * de las capas raster.
       */
      if (map.getLayer(TRAIL_LAYER_ID)) {
        map.moveLayer(TRAIL_LAYER_ID)
      }

      /*
       * Debug útil durante esta etapa.
       */
      if (process.env.NODE_ENV === 'development') {
        console.log('[GradientTrack] Track actualizado', {
          points: validPoints.length,
          segments: geojson.features.length,
          minElevation,
          maxElevation,
        })
      }
    },
    [coordinates.length, validPoints],
  )

  /* ---------------------------------------------------------------------- */
  /* FIT BOUNDS                                                              */
  /* ---------------------------------------------------------------------- */

  const fitTrack = useCallback(
    (map: maplibregl.Map) => {
      if (coordinates.length === 0) {
        map.setCenter(initialCenter)
        map.setZoom(zoom)
        return
      }

      const bounds = getTrackBounds(coordinates)

      if (!bounds) {
        return
      }

      /*
       * Si solo hay un punto, fitBounds no es necesario.
       */
      if (coordinates.length === 1) {
        map.setCenter(coordinates[0])
        map.setZoom(zoom)
        return
      }

      map.fitBounds(bounds, {
        padding: 40,
        maxZoom: 16,
        animate: false,
      })
    },
    [coordinates, initialCenter, zoom],
  )

  /* ---------------------------------------------------------------------- */
  /* RENDER TRACK                                                            */
  /* ---------------------------------------------------------------------- */

  const renderTrack = useCallback(
    (map: maplibregl.Map, fit = false) => {
      if (!map.isStyleLoaded()) {
        return
      }

      ensureTrackLayer(map)
      renderMarkers(map)

      /*
       * Solamente hacemos fitBounds cuando realmente corresponde.
       *
       * Pan y zoom NO llaman esta función.
       */
      if (fit) {
        fitTrack(map)
      }
    },
    [ensureTrackLayer, renderMarkers, fitTrack],
  )

  /* ---------------------------------------------------------------------- */
  /* INITIALIZE MAP                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    /*
     * Evitar crear dos instancias en caso de HMR / React StrictMode.
     */
    if (mapRef.current) {
      return
    }

    console.log('[GradientTrack] Inicializando mapa')

    const map = new maplibregl.Map({
      container: mapContainerRef.current,

      style: BASE_STYLES[selectedLayer].style,

      center: initialCenter,

      zoom,

      /*
       * Conservamos el comportamiento que tenías:
       * el scroll del mouse no hace zoom.
       */
      scrollZoom: false,
    })

    mapRef.current = map

    /* -------------------------------------------------------------------- */
    /* CONTROLS                                                             */
    /* -------------------------------------------------------------------- */

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

    /* -------------------------------------------------------------------- */
    /* LOAD                                                                 */
    /* -------------------------------------------------------------------- */

    const handleLoad = () => {
      console.log('[GradientTrack] MAP LOAD')

      console.log('[GradientTrack] puntos:', validPoints.length)

      console.log('[GradientTrack] coordenadas:', coordinates.slice(0, 3))

      renderTrack(map, true)
    }

    map.on('load', handleLoad)

    /* -------------------------------------------------------------------- */
    /* CLEANUP                                                              */
    /* -------------------------------------------------------------------- */

    return () => {
      clearMarkers()

      map.off('load', handleLoad)

      map.remove()

      mapRef.current = null
    }

    /*
     * La inicialización del mapa debe ocurrir una sola vez.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------------------------------------------------------------- */
  /* UPDATE TRACK                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    if (!map.isStyleLoaded()) {
      return
    }

    /*
     * Actualizamos source/layer y markers.
     *
     * Aquí hacemos fitBounds porque cambió el track.
     *
     * Esto NO ocurre cuando el usuario hace pan/zoom.
     */
    renderTrack(map, true)
  }, [trackPoints, renderTrack])

  /* ---------------------------------------------------------------------- */
  /* CHANGE BASE MAP                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    const nextStyle = BASE_STYLES[selectedLayer].style

    /*
     * setStyle elimina los sources/layers personalizados.
     *
     * Por eso los recreamos después de style.load.
     */
    map.setStyle(nextStyle)

    const handleStyleLoad = () => {
      console.log('[GradientTrack] STYLE LOAD:', selectedLayer)

      /*
       * Volvemos a crear nuestro source/layer
       * después de que MapLibre haya terminado
       * de cargar el nuevo estilo.
       */
      renderTrack(map, false)
    }

    map.once('style.load', handleStyleLoad)

    return () => {
      map.off('style.load', handleStyleLoad)
    }
  }, [selectedLayer, renderTrack])

  /* ---------------------------------------------------------------------- */
  /* UI                                                                      */
  /* ---------------------------------------------------------------------- */

  return (
    <div className='relative w-full h-full rounded-2xl overflow-hidden'>
      <div ref={mapContainerRef} className='w-full h-full' />

      {/* Selector de mapas */}
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

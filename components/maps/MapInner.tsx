'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Layers3 } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import type { Feature, LineString } from 'geojson'
import type { StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TrackPoint } from '@/types'

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')

/* -------------------------------------------------------------------------- */
/* BASE MAP STYLES                                                            */
/* -------------------------------------------------------------------------- */

const BASE_STYLES = {
  standard: {
    icon: '🗺️',

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
    icon: '⛰️',

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
    icon: '🛰️',

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

type TrackFeature = Feature<LineString>

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
  lon?: number
  lat?: number
  zoom?: number
  trackPoints?: TrackPoint[]
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function MapInner({ lon = -68.5440881, lat = -31.529822, zoom = 13, trackPoints = [] }: MapInnerProps) {
  const t = useTranslations('Workouts')
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const mapRef = useRef<maplibregl.Map | null>(null)

  const activeStyleRef = useRef<BaseStyleKey | null>(null)

  const markersRef = useRef<maplibregl.Marker[]>([])

  const [selectedLayer, setSelectedLayer] = useState<BaseStyleKey>('standard')
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)

  const [mapReady, setMapReady] = useState(false)

  const layerLabels: Record<BaseStyleKey, string> = {
    standard: t('map.standard'),
    topo: t('map.topographic'),
    satellite: t('map.satellite'),
  }

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
          <div class="p-1 text-center font-sans text-xs text-slate-900">
            <b>${t('map.startPoint')}</b>
            <br/>
            <span class="text-[10px] text-slate-600">
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
            <div class="p-1 text-center font-sans text-xs text-slate-900">
              <b>${t('map.endPoint')}</b>
              <br/>
              <span class="text-[10px] text-slate-600">
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
    [clearMarkers, coordinates, t],
  )

  /* ---------------------------------------------------------------------- */
  /* TRACK SOURCE + LAYER                                                   */
  /* ---------------------------------------------------------------------- */

  const ensureTrackLayer = useCallback(
    (map: maplibregl.Map) => {
      if (coordinates.length < 2) {
        if (map.getLayer(TRAIL_LAYER_ID)) {
          map.removeLayer(TRAIL_LAYER_ID)
        }

        if (map.getSource(TRAIL_SOURCE_ID)) {
          map.removeSource(TRAIL_SOURCE_ID)
        }

        return
      }

      const trackFeature: TrackFeature = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: validPoints.map((point) => [point.lon, point.lat]),
        },
      }

      if (map.getLayer(TRAIL_LAYER_ID)) {
        map.removeLayer(TRAIL_LAYER_ID)
      }

      if (map.getSource(TRAIL_SOURCE_ID)) {
        map.removeSource(TRAIL_SOURCE_ID)
      }

      map.addSource(TRAIL_SOURCE_ID, {
        type: 'geojson',
        data: trackFeature,
        lineMetrics: true,
      })

      map.addLayer({
        id: TRAIL_LAYER_ID,
        type: 'line',
        source: TRAIL_SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ff0000',
          'line-width': 8,
          'line-opacity': 1,
        },
      })

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
      const renderLoadedStyle = () => {
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
      }

      if (!map.isStyleLoaded()) {
        map.once('style.load', renderLoadedStyle)
        return
      }

      renderLoadedStyle()
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
      attributionControl: false,
    })

    mapRef.current = map
    activeStyleRef.current = selectedLayer

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })

    resizeObserver.observe(mapContainerRef.current)

    /* -------------------------------------------------------------------- */
    /* CONTROLS                                                             */
    /* -------------------------------------------------------------------- */

    // Bottom-right controls are prepended by MapLibre: register attribution
    // first so the navigation group appears above the compact info toggle.
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      'bottom-right',
    )

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

    // MapLibre's compact option keeps credits expanded until the first map interaction.
    // Collapse only on initial load; the native info button can still reopen them.
    const collapseInitialAttribution = () => {
      const attribution = map.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-attrib')
      if (!attribution) return

      // Keep MapLibre's native control dimensions and disclosure styling.
      attribution.classList.remove('maplibregl-compact-show')
      attribution.removeAttribute('open')
    }

    const handleLoad = () => {
      collapseInitialAttribution()
      setMapReady(true)
    }

    map.on('load', handleLoad)

    /* -------------------------------------------------------------------- */
    /* CLEANUP                                                              */
    /* -------------------------------------------------------------------- */

    return () => {
      clearMarkers()

      resizeObserver.disconnect()

      map.off('load', handleLoad)

      map.remove()

      mapRef.current = null
      activeStyleRef.current = null
      setMapReady(false)
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

    if (!mapReady || !map) {
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
  }, [mapReady, renderTrack])

  /* ---------------------------------------------------------------------- */
  /* CHANGE BASE MAP                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const map = mapRef.current

    if (!mapReady || !map || activeStyleRef.current === selectedLayer) {
      return
    }

    const nextStyle = BASE_STYLES[selectedLayer].style

    /*
     * setStyle elimina los sources/layers personalizados.
     *
     * Por eso los recreamos después de style.load.
     */
    const handleStyleLoad = () => {
      /*
       * Volvemos a crear nuestro source/layer
       * después de que MapLibre haya terminado
       * de cargar el nuevo estilo.
       */
      renderTrack(map, false)
    }

    map.once('style.load', handleStyleLoad)
    activeStyleRef.current = selectedLayer
    map.setStyle(nextStyle)

    return () => {
      map.off('style.load', handleStyleLoad)
    }
  }, [mapReady, selectedLayer, renderTrack])

  /* ---------------------------------------------------------------------- */
  /* UI                                                                      */
  /* ---------------------------------------------------------------------- */

  return (
    <div className='relative w-full h-full rounded-2xl overflow-hidden'>
      <div ref={mapContainerRef} className='w-full h-full' />

      {/* Compact basemap switcher: preserve the mapped style keys and MapLibre lifecycle. */}
      <div
        className='absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5 text-sm'
        onKeyDown={(event) => {
          if (event.key === 'Escape') setLayerMenuOpen(false)
        }}
      >
        <button
          type='button'
          aria-expanded={layerMenuOpen}
          aria-controls='basemap-layer-options'
          aria-label={t('map.layers')}
          title={t('map.layers')}
          onClick={() => setLayerMenuOpen((open) => !open)}
          className='relative flex size-[29px] items-center justify-center rounded-md border border-border bg-background/95 p-0 text-foreground shadow-lg backdrop-blur-sm transition-colors before:absolute before:-inset-[7.5px] before:content-[""] hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          <Layers3 className='size-4 shrink-0' aria-hidden='true' />
        </button>
        {layerMenuOpen && (
          <div id='basemap-layer-options' className='flex w-max max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-xl border border-border bg-background/95 p-1.5 text-foreground shadow-lg backdrop-blur-sm'>
            {(Object.keys(BASE_STYLES) as BaseStyleKey[]).map((key) => (
              <button
                key={key}
                type='button'
                aria-pressed={selectedLayer === key}
                onClick={() => {
                  setSelectedLayer(key)
                  setLayerMenuOpen(false)
                }}
                className={`min-h-[var(--size-ept-touch-target)] rounded-lg px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedLayer === key
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'text-foreground hover:bg-accent/20'
                }`}
              >
                {BASE_STYLES[key].icon} {layerLabels[key]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

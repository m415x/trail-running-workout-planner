'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L, { LatLngTuple, Point } from 'leaflet'

interface GradientTrackProps {
  positions: LatLngTuple[]
  elevations: number[]
  weight?: number
  opacity?: number
  simplifyTolerance?: number
  elevationRange?: [number, number]
}

type IndexedPoint = Point & {
  _trackIndex?: number
}

type OklchStop = {
  position: number
  l: number
  c: number
  h: number
}

/**
 * Paleta principal
 */
const OKLCH_STOPS: OklchStop[] = [
  { position: 0.0, l: 0.4, c: 0.18, h: 250 },
  { position: 0.2, l: 0.55, c: 0.16, h: 200 },
  { position: 0.4, l: 0.65, c: 0.17, h: 140 },
  { position: 0.6, l: 0.8, c: 0.18, h: 95 },
  { position: 0.8, l: 0.65, c: 0.2, h: 55 },
  { position: 1.0, l: 0.5, c: 0.22, h: 30 },
]

/**
 * OKLCH -> sRGB
 */
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const angle = (h * Math.PI) / 180

  const a = c * Math.cos(angle)
  const b = c * Math.sin(angle)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  let b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  const gamma = (value: number) => {
    if (value <= 0.0031308) {
      return 12.92 * value
    }

    return 1.055 * Math.pow(Math.max(value, 0), 1 / 2.4) - 0.055
  }

  r = gamma(r)
  g = gamma(g)
  b2 = gamma(b2)

  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b2))]
}

function rgbToCss(rgb: [number, number, number]): string {
  const [r, g, b] = rgb.map((value) => Math.round(value * 255))

  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Obtiene el color correspondiente a una posición 0..1
 * del gradiente.
 */
function colorForNormalizedValue(value: number): string {
  const t = Math.max(0, Math.min(1, value))

  let start = OKLCH_STOPS[0]
  let end = OKLCH_STOPS[OKLCH_STOPS.length - 1]

  for (let i = 0; i < OKLCH_STOPS.length - 1; i++) {
    const current = OKLCH_STOPS[i]
    const next = OKLCH_STOPS[i + 1]

    if (t >= current.position && t <= next.position) {
      start = current
      end = next
      break
    }
  }

  const localT = (t - start.position) / (end.position - start.position)
  const l = start.l + (end.l - start.l) * localT
  const c = start.c + (end.c - start.c) * localT

  /**
   * En este caso podemos interpolar directamente
   * porque los stops están ordenados con una progresión
   * de hue controlada.
   */
  const h = start.h + (end.h - start.h) * localT

  return rgbToCss(oklchToRgb(l, c, h))
}

function normalizeElevation(elevation: number, min: number, max: number): number {
  if (max <= min) {
    return 0
  }

  return Math.max(0, Math.min(1, (elevation - min) / (max - min)))
}

/**
 * Canvas layer nativo.
 *
 * React no crea un Polyline por segmento.
 * Leaflet solamente administra un único layer.
 */
class GradientTrackLayer extends L.Layer {
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D
  private frameId?: number

  private positions: LatLngTuple[]
  private elevations: number[]

  private weight: number
  private opacity: number
  private simplifyTolerance: number
  private elevationRange?: [number, number]

  constructor(options: GradientTrackProps) {
    super({
      pane: 'gradientTrackPane',
    })

    this.positions = options.positions
    this.elevations = options.elevations

    this.weight = options.weight ?? 4
    this.opacity = options.opacity ?? 0.9
    this.simplifyTolerance = options.simplifyTolerance ?? 1.2

    this.elevationRange = options.elevationRange
  }

  onAdd(map: L.Map): this {
    let pane = map.getPane('gradientTrackPane')

    if (!pane) {
      pane = map.createPane('gradientTrackPane')
      pane.style.zIndex = '450'
    }

    this.canvas = L.DomUtil.create('canvas', 'leaflet-gradient-track', pane)

    this.canvas.style.position = 'absolute'
    this.canvas.style.left = '0'
    this.canvas.style.top = '0'
    this.canvas.style.pointerEvents = 'none'

    this.ctx = this.canvas.getContext('2d') ?? undefined

    this.resizeCanvas(map)

    map.on('move zoom resize', this.scheduleDraw, this)

    this.scheduleDraw()

    return this
  }

  onRemove(map: L.Map): this {
    map.off('move zoom resize', this.scheduleDraw, this)

    if (this.frameId !== undefined) {
      cancelAnimationFrame(this.frameId)
      this.frameId = undefined
    }

    this.canvas?.remove()

    this.canvas = undefined
    this.ctx = undefined

    return this
  }

  private canvasWidth = 0
  private canvasHeight = 0
  private devicePixelRatio = 1

  private resizeCanvas(map: L.Map): void {
    if (!this.canvas || !this.ctx) {
      return
    }

    const size = map.getSize()

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const width = Math.round(size.x * dpr)
    const height = Math.round(size.y * dpr)

    if (width === this.canvas.width && height === this.canvas.height && dpr === this.devicePixelRatio) {
      return
    }

    this.canvas.width = width
    this.canvas.height = height

    this.canvas.style.width = `${size.x}px`
    this.canvas.style.height = `${size.y}px`

    this.canvasWidth = size.x
    this.canvasHeight = size.y
    this.devicePixelRatio = dpr

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private scheduleDraw = () => {
    if (this.frameId) {
      return
    }

    this.frameId = requestAnimationFrame(() => {
      this.frameId = undefined
      this.draw()
    })
  }

  private handleResize = () => {
    const map = this._map

    if (!map) {
      return
    }

    this.resizeCanvas(map)
    this.scheduleDraw()
  }

  private draw() {
    const map = this._map

    if (!map || !this.canvas || !this.ctx || this.positions.length < 2) {
      return
    }

    const ctx = this.ctx

    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

    const validElevations = this.elevations.filter((value) => Number.isFinite(value))

    if (validElevations.length < 2) {
      return
    }

    let minElevation = Math.min(...validElevations)

    let maxElevation = Math.max(...validElevations)

    /**
     * Permite usar una escala global.
     */
    if (this.elevationRange) {
      minElevation = this.elevationRange[0]

      maxElevation = this.elevationRange[1]
    }

    /**
     * Proyectamos coordenadas geográficas
     * a píxeles de pantalla.
     */
    const projected: IndexedPoint[] = this.positions.map(([lat, lng], index) => {
      const point = map.latLngToLayerPoint([lat, lng]) as IndexedPoint

      point._trackIndex = index

      return point
    })

    /**
     * Simplificación geométrica.
     *
     * Leaflet ya implementa Ramer-Douglas-Peucker
     * en LineUtil.simplify().
     */
    const simplified = L.LineUtil.simplify(projected, this.simplifyTolerance) as IndexedPoint[]

    ctx.save()

    ctx.lineWidth = this.weight
    ctx.globalAlpha = this.opacity

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    /**
     * Dibujamos cada tramo en el MISMO canvas.
     *
     * No hay 2000 componentes React.
     * No hay 2000 SVG paths.
     * Son solamente operaciones Canvas.
     */
    for (let i = 0; i < simplified.length - 1; i++) {
      const a = simplified[i]
      const b = simplified[i + 1]

      const indexA = a._trackIndex ?? 0

      const indexB = b._trackIndex ?? 0

      const elevationA = this.elevations[indexA]

      const elevationB = this.elevations[indexB]

      if (!Number.isFinite(elevationA) || !Number.isFinite(elevationB)) {
        continue
      }

      const tA = normalizeElevation(elevationA, minElevation, maxElevation)

      const tB = normalizeElevation(elevationB, minElevation, maxElevation)

      const colorA = colorForNormalizedValue(tA)

      const colorB = colorForNormalizedValue(tB)

      /**
       * Gradiente LOCAL del segmento.
       *
       * Esto evita que el color sea simplemente
       * un escalón por punto.
       */
      const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y)

      gradient.addColorStop(0, colorA)

      gradient.addColorStop(1, colorB)

      ctx.strokeStyle = gradient

      ctx.beginPath()

      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)

      ctx.stroke()
    }

    ctx.restore()
  }
}

export default function GradientTrack({
  positions,
  elevations,
  weight = 4,
  opacity = 0.9,
  simplifyTolerance = 1.2,
  elevationRange,
}: GradientTrackProps) {
  const map = useMap()

  useEffect(() => {
    if (positions.length < 2 || elevations.length < 2) {
      return
    }

    const layer = new GradientTrackLayer({
      positions,
      elevations,
      weight,
      opacity,
      simplifyTolerance,
      elevationRange,
    })

    map.addLayer(layer)

    return () => {
      map.removeLayer(layer)
    }
  }, [map, positions, elevations, weight, opacity, simplifyTolerance, elevationRange])

  return null
}

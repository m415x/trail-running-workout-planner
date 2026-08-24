import type { ExpressionSpecification } from 'maplibre-gl'

type OklchStop = {
  position: number
  l: number
  c: number
  h: number
}

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
 *
 * Conversión:
 *
 * OKLCH
 *   ↓
 * OKLab
 *   ↓
 * LMS
 *   ↓
 * linear sRGB
 *   ↓
 * sRGB
 */
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hue = (h * Math.PI) / 180

  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)

  // OKLab -> LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b

  const m_ = l - 0.1055613458 * a - 0.0638541728 * b

  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  // LMS -> linear RGB
  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3

  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3

  let b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  /**
   * linear sRGB -> sRGB
   */
  const gamma = (value: number) => {
    const v = Math.max(0, value)

    if (v <= 0.0031308) {
      return 12.92 * v
    }

    return 1.055 * Math.pow(v, 1 / 2.4) - 0.055
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
 * Devuelve el color correspondiente a un valor
 * normalizado entre 0 y 1.
 */
export function colorForNormalizedValue(value: number): string {
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

  const range = end.position - start.position

  const localT = range === 0 ? 0 : (t - start.position) / range

  const l = start.l + (end.l - start.l) * localT

  const c = start.c + (end.c - start.c) * localT

  /**
   * Por ahora interpolamos hue linealmente.
   *
   * Más adelante podemos hacer interpolación
   * circular del hue para evitar saltos si
   * ampliamos la paleta.
   */
  const h = start.h + (end.h - start.h) * localT

  return rgbToCss(oklchToRgb(l, c, h))
}

/**
 * Gradiente actualmente basado en line-progress.
 *
 * IMPORTANTE:
 *
 * Esto NO representa elevación.
 *
 * 0   = comienzo del track
 * 1   = final del track
 *
 * Lo mantendremos temporalmente como renderer
 * estable antes de pasar a elevación real.
 */
export function getMapLibreAltitudeColorExpression(): ExpressionSpecification {
  const stops: (number | string)[] = []

  for (const stop of OKLCH_STOPS) {
    stops.push(stop.position, colorForNormalizedValue(stop.position))
  }

  return ['interpolate', ['linear'], ['get', 'altitudePercent'], ...stops] as ExpressionSpecification
}

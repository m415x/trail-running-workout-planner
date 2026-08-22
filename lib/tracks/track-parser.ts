import { TrackData, TrackPoint } from '@/types'

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function smoothElevations(rawEles: number[], windowSize = 7): number[] {
  const smoothed: number[] = []
  const halfWindow = Math.floor(windowSize / 2)

  for (let i = 0; i < rawEles.length; i++) {
    const start = Math.max(0, i - halfWindow)
    const end = Math.min(rawEles.length, i + halfWindow + 1)
    const subset = rawEles.slice(start, end)
    const sum = subset.reduce((acc, val) => acc + val, 0)
    smoothed.push(sum / subset.length)
  }

  return smoothed
}

/**
 * Algoritmo Ramer-Douglas-Peucker para simplificar una polilínea (track de GPS).
 * Reduce el número de puntos sin perder la forma esencial de la ruta.
 * @param points - Array de puntos { lat, lon, ele }.
 * @param epsilon - Distancia máxima de un punto a la línea para ser descartado (en metros).
 * Un valor entre 1.0 y 2.0 es bueno para tracks de GPS.
 */
function ramerDouglasPeucker(points: TrackPoint[], epsilon: number): TrackPoint[] {
  if (points.length < 3) return points

  let dMax = 0
  let index = 0
  const end = points.length - 1

  if (points[0].lat === points[end].lat && points[0].lon === points[end].lon) {
    // Si el inicio y el fin son el mismo punto, no se puede formar una línea.
    // Buscamos el punto más alejado del inicio.
    for (let i = 1; i < end; i++) {
      const d = haversineDistance(points[0].lat, points[0].lon, points[i].lat, points[i].lon)
      if (d > dMax) {
        index = i
        dMax = d
      }
    }
  } else {
    for (let i = 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[0], points[end])
      if (d > dMax) {
        index = i
        dMax = d
      }
    }
  }

  if (dMax > epsilon) {
    // El punto está más lejos que epsilon, así que lo conservamos y aplicamos recursivamente
    const recResults1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon)
    const recResults2 = ramerDouglasPeucker(points.slice(index, end + 1), epsilon)
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2)
  } else {
    return [points[0], points[end]]
  }
}

function perpendicularDistance(pt: TrackPoint, lineStart: TrackPoint, lineEnd: TrackPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000 // Radio de la Tierra en metros

  const bearing13 = bearing(lineStart.lat, lineStart.lon, pt.lat, pt.lon)
  const bearing12 = bearing(lineStart.lat, lineStart.lon, lineEnd.lat, lineEnd.lon)
  const dist13 = haversineDistance(lineStart.lat, lineStart.lon, pt.lat, pt.lon)

  return Math.abs(Math.asin(Math.sin(dist13 / R) * Math.sin(toRad(bearing13) - toRad(bearing12))) * R)
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1))
  return (Math.atan2(y, x) * 180) / Math.PI
}

function calculateMaxGrade(points: TrackPoint[], windowSizeMeters = 100): number {
  let maxGrade = 0
  let endIndex = 1

  for (let startIndex = 0; startIndex < points.length; startIndex++) {
    const start = points[startIndex]

    while (endIndex < points.length && points[endIndex].distance < start.distance + windowSizeMeters) {
      endIndex++
    }

    if (endIndex >= points.length) {
      break
    }

    const end = points[endIndex]
    const deltaDistance = end.distance - start.distance

    if (deltaDistance <= 0) {
      continue
    }

    const deltaElevation = end.ele - start.ele
    const grade = (deltaElevation / deltaDistance) * 100

    if (grade > maxGrade && grade <= 150) {
      maxGrade = grade
    }
  }

  return maxGrade
}

export async function parseTrackFromUrl(trackPath: string): Promise<TrackData | null> {
  try {
    const response = await fetch(trackPath)
    if (!response.ok) return null

    const xmlText = await response.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(xmlText, 'text/xml')
    const trkpts = Array.from(xml.querySelectorAll('trkpt'))

    if (trkpts.length === 0) return null

    // 1. Extraer coordenadas iniciales (calculando la distancia acumulada de manera provisional)
    const rawPoints: TrackPoint[] = []
    let cumulativeDist = 0
    let prevLat: number | null = null
    let prevLon: number | null = null

    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') || '0')
      const lon = parseFloat(pt.getAttribute('lon') || '0')
      const eleEl = pt.querySelector('ele')
      const ele = eleEl ? parseFloat(eleEl.textContent || '0') : 0

      if (prevLat !== null && prevLon !== null) {
        cumulativeDist += haversineDistance(prevLat, prevLon, lat, lon)
      }

      rawPoints.push({ lat, lon, ele, distance: cumulativeDist })
      prevLat = lat
      prevLon = lon
    })

    // 2. Suavizar altitud y simplificar
    const rawElevations = rawPoints.map((p) => p.ele)
    const preSmoothedElevations = smoothElevations(rawElevations, 5)
    const pointsWithSmoothedEle = rawPoints.map((p, i) => ({ ...p, ele: preSmoothedElevations[i] }))

    const simplifiedPoints = ramerDouglasPeucker(pointsWithSmoothedEle, 1.5)

    const coordinates: [number, number][] = []
    const trackMetrics: { dist: number; ele: number }[] = []
    const finalTrackPoints: TrackPoint[] = []

    let totalDistMeters = 0
    let totalGainMeters = 0
    let totalLossMeters = 0
    let minEle = Infinity
    let maxEle = -Infinity

    let pLat = simplifiedPoints[0]?.lat
    let pLng = simplifiedPoints[0]?.lon
    let pEle = simplifiedPoints[0]?.ele

    coordinates.push([pLat, pLng])
    trackMetrics.push({ dist: 0, ele: Math.round(pEle) })
    finalTrackPoints.push({ lat: pLat, lon: pLng, ele: pEle, distance: 0 })

    minEle = Math.min(minEle, pEle)
    maxEle = Math.max(maxEle, pEle)

    for (let i = 1; i < simplifiedPoints.length; i++) {
      const { lat, lon } = simplifiedPoints[i]
      const ele = simplifiedPoints[i].ele

      const distStep = haversineDistance(pLat, pLng, lat, lon)
      totalDistMeters += distStep
      coordinates.push([lat, lon])

      const eleDiff = ele - pEle
      if (eleDiff > 0.4) {
        totalGainMeters += eleDiff
      } else if (eleDiff < -0.4) {
        totalLossMeters += Math.abs(eleDiff)
      }

      minEle = Math.min(minEle, ele)
      maxEle = Math.max(maxEle, ele)

      trackMetrics.push({ dist: totalDistMeters, ele: Math.round(ele) })
      finalTrackPoints.push({ lat, lon, ele, distance: totalDistMeters })

      pLat = lat
      pLng = lon
      pEle = ele
    }

    // 3. Pendiente máxima
    const maxGrade = calculateMaxGrade(rawPoints)

    // 4. Perfil de elevación
    const elevationProfile: { km: string; elev: number }[] = []
    const totalKm = totalDistMeters / 1000
    const stepKm = totalKm > 30 ? 1.0 : 0.5

    let currentTargetDist = 0
    trackMetrics.forEach((pt) => {
      if (pt.dist >= currentTargetDist || pt.dist === totalDistMeters) {
        elevationProfile.push({
          km: (pt.dist / 1000).toFixed(1),
          elev: pt.ele,
        })
        currentTargetDist += stepKm * 1000
      }
    })

    const firstPoint = coordinates[0]
    const lastPoint = coordinates[coordinates.length - 1]

    return {
      trackPoints: finalTrackPoints,
      coordinates,
      elevationProfile,
      distanceKm: Number((totalDistMeters / 1000).toFixed(1)),
      gainMeters: Math.round(totalGainMeters),
      lossMeters: Math.round(totalLossMeters),
      maxGradePct: Math.round(maxGrade),
      minElevation: Math.round(minEle === Infinity ? 0 : minEle),
      maxElevation: Math.round(maxEle === -Infinity ? 0 : maxEle),
      startCoordinates: firstPoint ? { lat: firstPoint[0], lon: firstPoint[1] } : undefined,
      endCoordinates: lastPoint ? { lat: lastPoint[0], lon: lastPoint[1] } : undefined,
    }
  } catch (error) {
    console.error('Error parseando archivo GPX:', error)
    return null
  }
}

export interface GpxData {
  coordinates: [number, number][]
  elevationProfile: { km: string; elev: number; grade?: number }[]
  distanceKm: number
  gainMeters: number
  maxGradePct: number
  startCoordinates?: { lat: number; lon: number }
  endCoordinates?: { lat: number; lon: number }
}

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

export async function parseGpxFromUrl(gpxPath: string): Promise<GpxData | null> {
  try {
    const response = await fetch(gpxPath)
    if (!response.ok) return null

    const xmlText = await response.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(xmlText, 'text/xml')
    const trkpts = Array.from(xml.querySelectorAll('trkpt'))

    if (trkpts.length === 0) return null

    // 1. Extraer coordenadas y elevación
    const rawPoints: { lat: number; lng: number; ele: number }[] = []
    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat') || '0')
      const lng = parseFloat(pt.getAttribute('lon') || '0')
      const eleEl = pt.querySelector('ele')
      const ele = eleEl ? parseFloat(eleEl.textContent || '0') : 0
      rawPoints.push({ lat, lng, ele })
    })

    // 2. Suavizar perfil de altitud
    const rawElevations = rawPoints.map((p) => p.ele)
    const smoothedElevations = smoothElevations(rawElevations, 7)

    const coordinates: [number, number][] = []
    const trackMetrics: { dist: number; ele: number }[] = []

    let totalDistMeters = 0
    let totalGainMeters = 0

    let prevLat = rawPoints[0].lat
    let prevLng = rawPoints[0].lng
    let prevEle = smoothedElevations[0]

    coordinates.push([prevLat, prevLng])
    trackMetrics.push({ dist: 0, ele: Math.round(prevEle) })

    for (let i = 1; i < rawPoints.length; i++) {
      const { lat, lng } = rawPoints[i]
      const ele = smoothedElevations[i]

      const distStep = haversineDistance(prevLat, prevLng, lat, lng)

      if (distStep < 1.0 && i !== rawPoints.length - 1) {
        continue
      }

      totalDistMeters += distStep
      coordinates.push([lat, lng])

      const eleDiff = ele - prevEle
      if (eleDiff > 0.4) {
        totalGainMeters += eleDiff
      }

      trackMetrics.push({ dist: totalDistMeters, ele: Math.round(ele) })

      prevLat = lat
      prevLng = lng
      prevEle = ele
    }

    // 3. PENDIENTE MÁXIMA: Ventana sostenida de 100 metros (Estándar Google Earth / Strava)
    let maxGrade = 0
    const windowSizeMeters = 100

    for (let i = 0; i < trackMetrics.length; i++) {
      const startNode = trackMetrics[i]
      // Buscar el punto a ~100 metros por delante
      const endNode = trackMetrics.find((m) => m.dist >= startNode.dist + windowSizeMeters)

      if (endNode) {
        const deltaDist = endNode.dist - startNode.dist
        const deltaEle = endNode.ele - startNode.ele
        const grade = (deltaEle / deltaDist) * 100

        if (grade > maxGrade && grade <= 55) {
          maxGrade = grade
        }
      }
    }

    // 4. PERFIL DE ELEVACIÓN SIMÉTRICO: Muestreo uniforme por distancia (ej. cada 0.5 km)
    const elevationProfile: { km: string; elev: number }[] = []
    const totalKm = totalDistMeters / 1000
    const stepKm = totalKm > 30 ? 1.0 : 0.5 // Puntos equidistantes cada 0.5k o 1k

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

    // Extraemos las coordenadas del punto inicial
    const firstPoint = coordinates[0]

    return {
      coordinates: coordinates,
      elevationProfile,
      distanceKm: Number((totalDistMeters / 1000).toFixed(1)),
      gainMeters: Math.round(totalGainMeters),
      maxGradePct: Math.round(maxGrade),
      startCoordinates: firstPoint ? { lat: firstPoint[0], lon: firstPoint[1] } : undefined,
    }
  } catch (error) {
    console.error('Error parseando archivo GPX:', error)
    return null
  }
}

export interface TrackPoint {
  lat: number
  lon: number
  ele: number
  distance?: number
  grade?: number

  /*
  time?: number
  speed?: number
  heartRate?: number
  cadence?: number
  power?: number
  */
}

export interface ElevationProfilePoint {
  km: string
  elev: number
  grade?: number
}

export interface TrackCoordinate {
  lat: number
  lon: number
}

export interface TrackElevationPoint extends TrackCoordinate {
  elevation: number
  distance: number
}

export interface TrackData {
  /** Puntos GPS del track */
  trackPoints: TrackPoint[]

  /** Coordenadas GeoJSON/MapLibre en formato [lon, lat] */
  coordinates: [number, number][]

  /** Perfil de elevación */
  elevationProfile: ElevationProfilePoint[]

  /** Distancia total */
  distanceKm: number

  /** Desnivel positivo acumulado */
  gainMeters: number

  /** Desnivel negativo acumulado */
  lossMeters: number

  /** Pendiente máxima */
  maxGradePct: number

  /** Elevación mínima */
  minElevation: number

  /** Elevación máxima */
  maxElevation: number

  /** Punto de inicio */
  startCoordinates?: TrackCoordinate

  /** Punto de llegada */
  endCoordinates?: TrackCoordinate

  /** Punto de menor elevación */
  lowestPoint?: TrackElevationPoint

  /** Punto de mayor elevación */
  highestPoint?: TrackElevationPoint
}

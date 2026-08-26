export interface ElevationRange {
  min: number
  max: number
}

export interface ElevationSegment {
  startElevation: number
  endElevation: number
  gain: number
  loss: number
  distance: number
}

export interface ElevationColorDomain {
  minElevation: number
  maxElevation: number
}

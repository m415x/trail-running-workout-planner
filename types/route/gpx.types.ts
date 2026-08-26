import { TrackPoint } from '@/types/route/track.types'

export interface GpxMetadata {
  name?: string
  description?: string
  author?: string
  time?: string
}

export interface GpxTrack {
  name?: string
  points: TrackPoint[]
}

import { AthleteGroupCode } from '@/types/athlete-groups.types'
import { MicrocycleType } from '@/types/periodization.types'

export interface GroupVolumeProgression {
  range: {
    min: number
    max: number
  }
  volumes: Record<Extract<MicrocycleType, 'base' | 'desarrollo' | 'choque' | 'descarga'>, number>
}

export const GROUP_VOLUME_MATRIX: Record<AthleteGroupCode, GroupVolumeProgression> = {
  // ── ELITE (E) ──
  E1: {
    range: { min: 85, max: 110 },
    volumes: { base: 90, desarrollo: 100, choque: 110, descarga: 70 },
  },
  E2: {
    range: { min: 70, max: 90 },
    volumes: { base: 75, desarrollo: 82, choque: 90, descarga: 60 },
  },
  E3: {
    range: { min: 55, max: 75 },
    volumes: { base: 60, desarrollo: 68, choque: 75, descarga: 48 },
  },

  // ── ULTRA (U) ──
  U1: {
    range: { min: 80, max: 105 },
    volumes: { base: 85, desarrollo: 95, choque: 105, descarga: 68 },
  },
  U2: {
    range: { min: 65, max: 85 },
    volumes: { base: 70, desarrollo: 78, choque: 85, descarga: 55 },
  },
  U3: {
    range: { min: 50, max: 70 },
    volumes: { base: 55, desarrollo: 62, choque: 70, descarga: 45 },
  },

  // ── MARATHON (M) ──
  M1: {
    range: { min: 60, max: 75 },
    volumes: { base: 62, desarrollo: 68, choque: 75, descarga: 48 },
  },
  M2: {
    range: { min: 50, max: 65 },
    volumes: { base: 52, desarrollo: 58, choque: 65, descarga: 42 },
  },
  M3: {
    range: { min: 40, max: 52 },
    volumes: { base: 42, desarrollo: 47, choque: 52, descarga: 32 },
  },

  // ── HALF-MARATHON (H) ──
  H1: {
    range: { min: 50, max: 62 },
    volumes: { base: 52, desarrollo: 56, choque: 62, descarga: 40 },
  },
  H2: {
    range: { min: 42, max: 52 },
    volumes: { base: 44, desarrollo: 48, choque: 52, descarga: 34 },
  },
  H3: {
    range: { min: 35, max: 44 },
    volumes: { base: 36, desarrollo: 40, choque: 44, descarga: 28 },
  },

  // ── SHORT (S) ──
  S1: {
    range: { min: 42, max: 50 },
    volumes: { base: 44, desarrollo: 47, choque: 50, descarga: 32 },
  },
  S2: {
    range: { min: 35, max: 42 },
    volumes: { base: 36, desarrollo: 39, choque: 42, descarga: 27 },
  },
  S3: {
    range: { min: 28, max: 35 },
    volumes: { base: 30, desarrollo: 32, choque: 35, descarga: 22 },
  },

  // ── BASE (B) ──
  B1: {
    range: { min: 30, max: 36 },
    volumes: { base: 32, desarrollo: 34, choque: 36, descarga: 24 },
  },
  B2: {
    range: { min: 25, max: 30 },
    volumes: { base: 26, desarrollo: 28, choque: 30, descarga: 20 },
  },
  B3: {
    range: { min: 20, max: 25 },
    volumes: { base: 21, desarrollo: 23, choque: 25, descarga: 16 },
  },
} as const

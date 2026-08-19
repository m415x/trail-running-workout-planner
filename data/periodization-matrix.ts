import { AthleteGroupCode, GroupVolumeProgression } from '@/types'

export const GROUP_VOLUME_MATRIX: Record<AthleteGroupCode, GroupVolumeProgression> = {
  // ── ELITE (E) ──
  E1: {
    range: { min: 85, max: 110 },
    volumes: { base: 90, development: 100, shock: 110, deload: 70 },
  },
  E2: {
    range: { min: 70, max: 90 },
    volumes: { base: 75, development: 82, shock: 90, deload: 60 },
  },
  E3: {
    range: { min: 55, max: 75 },
    volumes: { base: 60, development: 68, shock: 75, deload: 48 },
  },

  // ── ULTRA (U) ──
  U1: {
    range: { min: 80, max: 105 },
    volumes: { base: 85, development: 95, shock: 105, deload: 68 },
  },
  U2: {
    range: { min: 65, max: 85 },
    volumes: { base: 70, development: 78, shock: 85, deload: 55 },
  },
  U3: {
    range: { min: 50, max: 70 },
    volumes: { base: 55, development: 62, shock: 70, deload: 45 },
  },

  // ── MARATHON (M) ──
  M1: {
    range: { min: 60, max: 75 },
    volumes: { base: 62, development: 68, shock: 75, deload: 48 },
  },
  M2: {
    range: { min: 50, max: 65 },
    volumes: { base: 52, development: 58, shock: 65, deload: 42 },
  },
  M3: {
    range: { min: 40, max: 52 },
    volumes: { base: 42, development: 47, shock: 52, deload: 32 },
  },

  // ── HALF-MARATHON (H) ──
  H1: {
    range: { min: 50, max: 62 },
    volumes: { base: 52, development: 56, shock: 62, deload: 40 },
  },
  H2: {
    range: { min: 42, max: 52 },
    volumes: { base: 44, development: 48, shock: 52, deload: 34 },
  },
  H3: {
    range: { min: 35, max: 44 },
    volumes: { base: 36, development: 40, shock: 44, deload: 28 },
  },

  // ── SHORT (S) ──
  S1: {
    range: { min: 42, max: 50 },
    volumes: { base: 44, development: 47, shock: 50, deload: 32 },
  },
  S2: {
    range: { min: 35, max: 42 },
    volumes: { base: 36, development: 39, shock: 42, deload: 27 },
  },
  S3: {
    range: { min: 28, max: 35 },
    volumes: { base: 30, development: 32, shock: 35, deload: 22 },
  },

  // ── BASE (B) ──
  B1: {
    range: { min: 30, max: 36 },
    volumes: { base: 32, development: 34, shock: 36, deload: 24 },
  },
  B2: {
    range: { min: 25, max: 30 },
    volumes: { base: 26, development: 28, shock: 30, deload: 20 },
  },
  B3: {
    range: { min: 20, max: 25 },
    volumes: { base: 21, development: 23, shock: 25, deload: 16 },
  },
} as const

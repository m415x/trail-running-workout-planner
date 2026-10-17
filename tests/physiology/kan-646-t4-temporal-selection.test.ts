import assert from 'node:assert/strict'
import test from 'node:test'

import {
  selectCurrentSelfDeclaredBiometrics,
  type SelfDeclaredBiometricObservation,
} from '@/lib/physiology/self-declared-biometric-selection'

const subject = { teamId: 'team_a', athleteProfileId: 'athlete_a' }
const at = (id: string, kind: SelfDeclaredBiometricObservation['kind'], valueScaled: number, observedOn: string, recordedAt: string, supersedesObservationId: string | null = null): SelfDeclaredBiometricObservation => ({
  id, ...subject, kind, valueScaled, observedOn, recordedAt,
  supersedesObservationId, source: 'athlete_declared',
})

const query = (observations: readonly SelfDeclaredBiometricObservation[], effectiveOn = '2026-10-15', knownAt = '2026-10-15T13:00:00.000Z') =>
  selectCurrentSelfDeclaredBiometrics({ observations, ...subject, effectiveOn, knownAt })

test('KAN-646/T4 excludes observations after effective day and after known instant', () => {
  const records = [
    at('early', 'weight', 725, '2026-10-10', '2026-10-10T12:00:00.000Z'),
    at('future', 'weight', 730, '2026-10-16', '2026-10-15T12:00:00.000Z'),
    at('late', 'weight', 740, '2026-10-12', '2026-10-16T12:00:00.000Z'),
  ]
  assert.equal(query(records).weight?.id, 'early')
  assert.equal(query(records, '2026-10-20', '2026-10-20T13:00:00.000Z').weight?.id, 'future')
})

test('KAN-646/T4 reconstructs what was known before an append-only correction', () => {
  const records = [
    at('original', 'rest_hr', 55, '2026-10-01', '2026-10-01T12:00:00.000Z'),
    at('revision', 'rest_hr', 51, '2026-09-30', '2026-10-12T12:00:00.000Z', 'original'),
  ]
  assert.equal(query(records, '2026-10-10', '2026-10-10T20:00:00.000Z').restHr?.id, 'original')
  assert.equal(query(records).restHr?.id, 'revision')
})

test('KAN-646/T4 correction of effective date does not revive superseded observation', () => {
  const records = [
    at('original', 'max_hr', 186, '2026-10-01', '2026-10-02T12:00:00.000Z'),
    at('revision', 'max_hr', 188, '2026-10-18', '2026-10-12T12:00:00.000Z', 'original'),
  ]
  assert.equal(query(records).maxHr, null)
})

test('KAN-646/T4 deterministic tie: observation date, recorded instant, then ascending ID', () => {
  const records = [
    at('z', 'height', 1750, '2026-10-12', '2026-10-13T12:00:00.000Z'),
    at('a', 'height', 1752, '2026-10-12', '2026-10-13T12:00:00.000Z'),
    at('previous', 'height', 1745, '2026-10-11', '2026-10-14T12:00:00.000Z'),
  ]
  assert.equal(query(records).height?.id, 'a')
})

test('KAN-646/T4 rejects other subject and non SELF sources', () => {
  const records = [
    at('own', 'weight', 710, '2026-10-11', '2026-10-12T12:00:00.000Z'),
    { ...at('different_team', 'weight', 800, '2026-10-14', '2026-10-14T12:00:00.000Z'), teamId: 'team_b' },
    { ...at('different_athlete', 'weight', 820, '2026-10-14', '2026-10-14T12:00:00.000Z'), athleteProfileId: 'athlete_b' },
    { ...at('coach', 'weight', 900, '2026-10-14', '2026-10-14T12:00:00.000Z'), source: 'coach_evaluated' as const },
  ]
  assert.equal(query(records).weight?.id, 'own')
  assert.equal(query([]).weight, null)
  assert.equal(query([]).maxHr, null)
})

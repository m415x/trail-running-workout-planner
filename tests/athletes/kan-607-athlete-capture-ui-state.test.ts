import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAthleteCaptureUiState } from '@/features/workouts/lib/athlete-capture-ui-state'

test('KAN-703 Athlete session capture distinguishes loaded, empty, denied, no-profile and error', () => {
  assert.deepEqual(resolveAthleteCaptureUiState({ kind: 'loading' }), { status: 'loading', canCapture: false })
  assert.deepEqual(resolveAthleteCaptureUiState({ kind: 'response', response: {
    success: true, captured: false, workoutLogId: null, editableInput: null,
  } }), { status: 'empty', canCapture: true })
  assert.deepEqual(resolveAthleteCaptureUiState({ kind: 'response', response: {
    success: false, status: 'denied',
  } }), { status: 'denied', canCapture: false })
  assert.deepEqual(resolveAthleteCaptureUiState({ kind: 'no-profile' }), { status: 'no-profile', canCapture: false })
  assert.deepEqual(resolveAthleteCaptureUiState({ kind: 'error' }), { status: 'error', canCapture: false })
})

test('KAN-703 only a successfully loaded session grants capture readiness', () => {
  const state = resolveAthleteCaptureUiState({ kind: 'response', response: {
    success: true, captured: true, workoutLogId: 'log-1', editableInput: null,
  } })
  assert.deepEqual(state, { status: 'loaded', canCapture: true })
})

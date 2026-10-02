import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const rpe = readFileSync('features/workouts/components/RpeSelector.tsx', 'utf8')
const slider = readFileSync('components/ui/slider.tsx', 'utf8')
const capture = readFileSync('features/workouts/hooks/useLogWorkoutDialog.ts', 'utf8')

test('KAN-577 unrecorded RPE keeps a mounted, operable slider thumb', () => {
  assert.match(slider, /Array\.from\(\{ length: _values\.length \}/)
  assert.match(slider, /Array\.isArray\(value\)\s*\? value/)
  assert.match(rpe, /value=\{\[sliderValue\]\}/)
  assert.doesNotMatch(rpe, /value=\{unassessed \? \[\] : \[sliderValue\]\}/)
  assert.match(rpe, /const sliderValue = unassessed \? 1 : value/)
  assert.match(rpe, /onValueChange=\{\(val\) => \{/)
  assert.match(rpe, /if \(typeof nextVal === 'number'\) onChange\(nextVal\)/)
  assert.match(rpe, /min=\{1\}/)
  assert.match(rpe, /max=\{10\}/)
})

test('KAN-577 unrecorded RPE remains semantically absent until explicitly selected', () => {
  assert.match(rpe, /const unassessed = value === null \|\| value === 0/)
  assert.match(rpe, /\{unassessed \? t\('unrecorded'\)/)
  assert.match(rpe, /onClick=\{\(\) => onChange\(null\)\}/)
  assert.doesNotMatch(rpe, /onChange\(0\)/)
  assert.match(capture, /assessment\.rpe === null \|\| assessment\.rpe === undefined\s*\? \{ state: 'unknown' \}/)
})

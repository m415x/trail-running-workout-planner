import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const constantsSource = fs.readFileSync(path.join(process.cwd(), 'lib/constants.ts'), 'utf8')
const helpersSource = fs.readFileSync(path.join(process.cwd(), 'lib/workout-helpers.ts'), 'utf8')

test('workout metadata does not own localized product copy', () => {
  assert.doesNotMatch(constantsSource, /label\s*:/)
  assert.doesNotMatch(constantsSource, /description\s*:/)
})

test('workout helpers do not own localized fallback copy', () => {
  assert.doesNotMatch(helpersSource, /Entrenamiento/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const assessment = readFileSync('features/workouts/components/SelfAssessment.tsx', 'utf8')
const feeling = readFileSync('features/workouts/components/FeelingSelector.tsx', 'utf8')
const rpe = readFileSync('features/workouts/components/RpeSelector.tsx', 'utf8')
const hook = readFileSync('features/workouts/hooks/useSelfAssessment.ts', 'utf8')
const save = readFileSync('features/workouts/hooks/useLogWorkoutDialog.ts', 'utf8')
const messages = Object.fromEntries(['es', 'en'].map(locale => [
  locale,
  JSON.parse(readFileSync(`messages/${locale}/realized-training/workouts.json`, 'utf8')).Workouts,
]))

test('KAN-577 translates self-assessment heading, feeling question and all five labels in ES and EN', () => {
  assert.match(assessment, /useTranslations\('Workouts\.assessment'\)/)
  assert.match(assessment, /\{t\('title'\)\}/)
  assert.doesNotMatch(assessment, />Autoevaluación</)
  assert.match(feeling, /useTranslations\('Workouts\.feeling'\)/)
  assert.match(feeling, /\{t\('question'\)\}/)
  assert.match(feeling, /\{t\(option\.value\)\}/)
  assert.doesNotMatch(feeling, /label:\s*'(?:Muy débil|Débil|Normal|Fuerte|Muy fuerte)'/)
  const keys = ['very_weak', 'weak', 'normal', 'strong', 'very_strong']
  for (const locale of ['es', 'en']) {
    assert.ok(messages[locale].assessment?.title, `${locale} assessment title`)
    assert.ok(messages[locale].feeling?.question, `${locale} feeling question`)
    for (const key of keys) assert.ok(messages[locale].feeling?.[key], `${locale} feeling ${key}`)
  }
})

test('KAN-577 has one unrecorded RPE control and scale 1-10, never a separate known-zero selection', () => {
  assert.match(rpe, /const unassessed = value === null \|\| value === 0/)
  assert.match(rpe, /\{unassessed \? t\('unrecorded'\)/)
  assert.match(rpe, /min=\{1\}/)
  assert.match(rpe, /max=\{10\}/)
  assert.match(rpe, /onClick=\{\(\) => onChange\(null\)\}/)
  assert.doesNotMatch(rpe, /onChange\(0\)/)
  assert.doesNotMatch(rpe, /t\('zero'\)/)
  assert.match(hook, /const hasData = Boolean\(feeling \|\| \(rpe !== null && rpe > 0\)\)/)
  assert.match(assessment, /rpe !== null && rpe !== undefined && rpe > 0 && `RPE \$\{rpe\}`/)
  for (const locale of ['es', 'en']) assert.ok(messages[locale].rpe.unrecorded)
})

test('KAN-577 leaves historical known-zero capture untouched on unrelated edit saves', () => {
  assert.match(save, /rpe:\s*input\.metrics\.rpe\.state === 'known' \? input\.metrics\.rpe\.value : null/)
  assert.match(save, /rpe:\s*assessment\.rpe === null \|\| assessment\.rpe === undefined\s*\? \{ state: 'unknown' \}\s*:\s*\{ state: 'known', value: assessment\.rpe \}/)
})

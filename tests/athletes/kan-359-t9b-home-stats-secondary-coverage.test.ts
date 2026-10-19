import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homeHeader = readFileSync('features/workouts/components/HomeHeader.tsx', 'utf8')
const stats = readFileSync('app/[locale]/(mobile)/stats/page.tsx', 'utf8')

test('KAN-822/T9b Home date follows Athlete caption preference without touching identity or actions', () => {
  assert.match(homeHeader, /<h1[^>]*text-\[length:var\(--athlete-text-heading\)\]/)
  assert.match(homeHeader, /<p className='[^']*text-\[length:var\(--athlete-text-caption\)\][^']*'>\{today\}<\/p>/)
  assert.match(homeHeader, /<ThemeToggleButton/)
  assert.match(homeHeader, /aria-label=\{t\('notifications'\)\}/)
})

test('KAN-822/T9b Stats summary supporting text adopts Athlete semantic roles', () => {
  assert.match(stats, /function DomainLink[\s\S]*?className='[^']*text-\[length:var\(--athlete-text-label\)\][^']*'/)
  assert.match(stats, /className='[^']*text-\[length:var\(--athlete-text-caption\)\][^']*'>\{t\('summary\.period'\)\}/)
  assert.match(stats, /className='[^']*text-\[length:var\(--athlete-text-caption\)\][^']*'>\{t\(\x60trainingDetail\.\$\{item\.key\}\x60\)\}/)
  assert.match(stats, /className='[^']*text-\[length:var\(--athlete-text-data\)\][^']*'>\{item\.value === null/)
  assert.match(stats, /getCurrentAthleteStatsAction/)
  assert.match(stats, /getCurrentAthleteTrack1000mPerformanceAction/)
})

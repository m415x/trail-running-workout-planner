import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const physiology = readFileSync('features/profile/components/AthleteTabContent.tsx', 'utf8')
const profile = readFileSync('features/profile/ProfileTab.tsx', 'utf8')
const page = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')

test('KAN-711 Athlete Profile never presents fabricated physiological measurements or HR zones', () => {
  assert.doesNotMatch(physiology, /72 kg|188 ppm|54 ml\/kg|1\.75 m|46 ppm|172 ppm/)
  assert.doesNotMatch(physiology, /const HR_ZONES\s*=/)
  assert.doesNotMatch(physiology, /132 – 150 ppm|166 – 178 ppm/)
})

test('KAN-711 Profile physiology is fed real H5B SELF 1000m projection, not a dummy local fixture', () => {
  assert.match(page, /getCurrentAthleteTrack1000mPerformanceAction/)
  assert.match(profile, /performance=/)
  assert.match(physiology, /reference\?\.status/)
  assert.match(physiology, /paceLabel/)
  assert.match(physiology, /averageSpeedKmh/)
})

test('KAN-711 sensitive raw physiology and medical fields are not passed to Athlete Profile', () => {
  assert.doesNotMatch(page, /physiologyRecords|\.medical\b|\.physiology\b/)
  assert.doesNotMatch(physiology, /recordedByUserId|physiologyRecords|\.medical\b/)
})

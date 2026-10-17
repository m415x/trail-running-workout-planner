import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const tab = readFileSync('features/profile/ProfileTab.tsx', 'utf8')
const settings = readFileSync('features/profile/components/SettingsTabContent.tsx', 'utf8')
const header = readFileSync('features/profile/components/ProfileHeader.tsx', 'utf8')
const page = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')

test('KAN-801 hides beta Gear tab without removing authorized physiology and settings', () => {
  assert.doesNotMatch(tab, /GearTabContent|value=['"]gear['"]|tabs\.gear/)
  assert.match(tab, /AthleteTabContent/)
  assert.match(tab, /SettingsTabContent/)
  assert.match(tab, /performanceStatus/)
  assert.match(tab, /membershipStatus/)
})

test('KAN-801 Settings never displays fictitious clinical or administrative records', () => {
  assert.doesNotMatch(settings, /María Doe|A Positivo|Federación de Atletismo|8839/)
  assert.doesNotMatch(settings, /\b(?:bloodType|insurance|sos)\b/)
  assert.doesNotMatch(settings, /TODO Selector de idioma/)
})

test('KAN-801 Profile does not advertise an inert preferences or photo editing action', () => {
  assert.doesNotMatch(settings, /accountPreferences/)
  assert.doesNotMatch(header, /editPhoto|<button|Pencil/)
  assert.match(header, /athlete\.firstName/)
  assert.match(header, /athlete\.nickName/)
  assert.match(page, /getCurrentAthleteTrack1000mPerformanceAction/)
  assert.match(page, /AthleteMembershipStatus/)
})

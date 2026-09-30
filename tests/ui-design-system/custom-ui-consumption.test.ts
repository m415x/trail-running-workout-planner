import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const barrel = readFileSync('components/ui/custom/index.ts', 'utf8')

test('KAN-562 exposes the official EPT semantic primitives from one stable custom UI surface', () => {
  for (const exportedName of [
    'CustomButton',
    'PrimaryFilledButton',
    'PrimaryOutlineButton',
    'PrimaryLinkButton',
    'SecondaryFilledButton',
    'SecondaryOutlineButton',
    'GlassFilledButton',
    'GlassOutlineButton',
    'ThemeToggleButton',
    'PillButton',
    'PrimaryInput',
    'CustomCard',
    'CustomCardInside',
    'StatCard',
    'ConfirmActionDialog',
  ]) {
    assert.match(
      barrel,
      new RegExp(`\\b${exportedName}\\b`),
      `missing official semantic primitive export: ${exportedName}`,
    )
  }
})

test('KAN-562 exposes shared product-pattern candidates without promoting feature compositions', () => {
  for (const exportedName of [
    'StatPill',
    'ZonePill',
    'CardHeader',
    'ProgressGradient',
  ]) {
    assert.match(
      barrel,
      new RegExp(`\\b${exportedName}\\b`),
      `missing shared product-pattern export: ${exportedName}`,
    )
  }

  assert.doesNotMatch(barrel, /RouteMapCard|LogWorkoutDialog|WorkoutCard/)
})

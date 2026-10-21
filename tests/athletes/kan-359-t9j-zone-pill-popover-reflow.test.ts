import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-359/T9j zone badge can grow horizontally and keeps percentage unbroken', () => {
  const pills = read('components/ui/custom/pills.tsx')
  const buttons = read('components/ui/custom/buttons.tsx')
  assert.match(pills, /zoneInfo\.pct/, 'zone percentage remains represented')
  assert.match(pills, /whitespace-nowrap/, 'zone percentage must not split at enlarged font size')
  assert.match(buttons, /--athlete-text-(?:title|display)/, 'zone value follows preset')
  assert.match(pills, /min-w-|w-auto|width:\s*max-content/, 'zone badge is allowed to grow')
})

test('KAN-359/T9j zone details portal receives current Athlete preset and scales actual copy', () => {
  const pills = read('components/ui/custom/pills.tsx')
  assert.match(pills, /<PopoverContent[\\s\\S]*?athlete-typography/, 'detached detail portal must include Athlete scope')
  assert.match(pills, /data-athlete-typography=\{/, 'detached detail portal must receive live preset')
  assert.match(pills, /--athlete-text-body-compact/, 'explanatory copy must scale')
  assert.match(pills, /--athlete-text-caption/, 'supporting caption must scale')
  assert.match(pills, /effortAndPerception/, 'zone description remains visible')
  assert.match(pills, /zoneInfo\.rpe/, 'RPE remains visible')
})

test('KAN-359/T9j preserve zone disclosure and non-Athlete fallback', () => {
  const pills = read('components/ui/custom/pills.tsx')
  assert.match(pills, /<PopoverTrigger/)
  assert.match(pills, /<PillButton/)
  assert.match(read('components/ui/custom/buttons.tsx'), /focus-visible:ring-2/)
  assert.match(read('features/athlete-typography/typography.css'), /\.athlete-typography\s*\{/)
})

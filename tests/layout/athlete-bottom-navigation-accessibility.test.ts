import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const navigation = readFileSync('components/layout/BottomNavigationBar.tsx', 'utf8')
const globals = readFileSync('app/globals.css', 'utf8')
const athleteTypography = readFileSync('features/athlete-typography/typography.css', 'utf8')

test('KAN-572 Athlete bottom navigation uses scalable semantic captions and accessible targets', () => {
  assert.match(globals, /--text-ept-caption:\s*0\.75rem/)
  assert.match(globals, /--size-ept-touch-target:\s*2\.75rem/)

  assert.match(
    navigation,
    /text-\[length:var\(--athlete-text-caption\)\]/,
    'navigation captions must consume the scoped Athlete rem-based semantic caption token',
  )
  // The standard preset retains KAN-572's 0.75rem caption base; T7 scales it only inside Athlete.
  assert.match(athleteTypography, /--athlete-text-caption:\s*calc\(0\.75rem\s*\*\s*var\(--athlete-type-multiplier\)\);/)
  assert.match(athleteTypography, /\.athlete-typography\[data-athlete-typography='standard'\]\s*\{\s*--athlete-type-multiplier:\s*1;/)
  assert.match(athleteTypography, /\.athlete-typography\s*\{/)
  assert.doesNotMatch(navigation, /text-\[9px\]/)

  assert.match(
    navigation,
    /min-h-\[var\(--size-ept-touch-target\)\]/,
    'every navigation link must preserve the baseline 44px touch target',
  )
  assert.match(navigation, /focus-visible:ring-2/)
  assert.match(navigation, /focus-visible:ring-ring/)

  for (const href of ["'/'", "'/plan'", "'/stats'", "'/profile'"]) {
    assert.ok(navigation.includes(`href: ${href}`))
  }
  assert.match(navigation, /sm:left-1\/2/)
  assert.match(navigation, /sm:w-auto/)
})

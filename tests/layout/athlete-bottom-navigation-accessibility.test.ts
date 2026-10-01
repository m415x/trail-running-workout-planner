import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const navigation = readFileSync('components/layout/BottomNavigationBar.tsx', 'utf8')
const globals = readFileSync('app/globals.css', 'utf8')

test('KAN-572 Athlete bottom navigation uses scalable semantic captions and accessible targets', () => {
  assert.match(globals, /--text-ept-caption:\s*0\.75rem/)
  assert.match(globals, /--size-ept-touch-target:\s*2\.75rem/)

  assert.match(
    navigation,
    /text-\[length:var\(--text-ept-caption\)\]/,
    'navigation captions must consume the KAN-507 rem-based semantic caption token',
  )
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

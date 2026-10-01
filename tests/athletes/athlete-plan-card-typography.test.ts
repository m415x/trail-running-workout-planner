import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const card = readFileSync('features/athlete-planning/components/AthleteSessionCard.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

test('KAN-572 uses compact body typography for prescribed Athlete Plan instructions', () => {
  assert.match(css, /--text-ept-body-compact:\s*0\.875rem/)
  assert.match(
    card,
    /<CardContent className='[^']*text-\[length:var\(--text-ept-body-compact\)\][^']*'>/,
    'training prescription body must consume the KAN-507 compact body token',
  )
  assert.doesNotMatch(
    card,
    /<CardContent className='[^']*text-xs[^']*'>/,
    'training instructions must not default to caption-sized text',
  )

  assert.match(card, /whitespace-pre-wrap leading-relaxed/)
  assert.match(card, /flex flex-wrap gap-x-4 gap-y-2/)
})

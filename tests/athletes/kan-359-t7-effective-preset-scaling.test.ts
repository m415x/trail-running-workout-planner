import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync('features/athlete-typography/typography.css', 'utf8')
const shell = readFileSync('components/layout/MobileShell.tsx', 'utf8')
const globals = readFileSync('app/globals.css', 'utf8')

test('KAN-359/T7 maps all four server-bootstrap presets into distinct scoped visual scaling factors', () => {
  const factors = new Map<string, number>()
  for (const preset of ['compact', 'standard', 'large', 'extra-large']) {
    const selector = new RegExp('\\.athlete-typography\\[data-athlete-typography=["\\x27]?' + preset + '["\\x27]?\\]\\s*\\{([^}]*)\\}')
    const match = css.match(selector)
    assert.ok(match, `missing scoped visual preset: ${preset}`)
    const factor = match[1].match(/--athlete-type-multiplier:\s*([0-9.]+)\s*;/)
    assert.ok(factor, `missing multiplier for ${preset}`)
    factors.set(preset, Number(factor[1]))
  }
  assert.equal(factors.get('standard'), 1)
  assert.ok((factors.get('compact') ?? 0) < 1)
  assert.ok((factors.get('compact') ?? 0) >= 0.95)
  assert.ok((factors.get('large') ?? 0) > 1)
  assert.ok((factors.get('extra-large') ?? 0) > (factors.get('large') ?? 0))
})

test('KAN-359/T7 applies visual scaling to every Athlete semantic text role with standard responsive bases', () => {
  assert.match(css, /--athlete-type-multiplier:\s*1\s*;/)
  for (const role of ['display', 'heading', 'title', 'body', 'body-compact', 'label', 'caption', 'data']) {
    assert.match(css, new RegExp('--athlete-text-' + role + '\\s*:\\s*calc\\([^;]*var\\(--athlete-type-multiplier\\)[^;]*\\);'), `missing effective scaling for ${role}`)
  }
  assert.match(css, /@media\s*\(min-width:\s*640px\)/)
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/)
  assert.match(css, /--athlete-text-heading:\s*calc\(1\.5rem\s*\*\s*var\(--athlete-type-multiplier\)\)/)
  assert.match(css, /--athlete-text-heading:\s*calc\(1\.875rem\s*\*\s*var\(--athlete-type-multiplier\)\)/)
})

test('KAN-359/T7 consumes SSR/client data attribute without changing global baseline or Coach', () => {
  assert.match(shell, /data-athlete-typography=\{preference\}/)
  assert.match(shell, /className='athlete-typography/)
  assert.match(globals, /html\s*\{[^}]*font-size:\s*120%/)
  assert.doesNotMatch(css, /(?:^|[},\n])\s*(?:html|body|:root|\.coach-[\w-]+)\s*\{/m)
  assert.doesNotMatch(css, /!important|@import/)
})

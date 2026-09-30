import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const buttonsSource = readSource('components/ui/custom/buttons.tsx')
const inputsSource = readSource('components/ui/custom/inputs.tsx')
const confirmDialogSource = readSource('components/ui/custom/confirm-dialog.tsx')
const globalsCss = readSource('app/globals.css')

test('KAN-558 official EPT controls consume semantic foreground and shape tokens', () => {
  assert.doesNotMatch(buttonsSource, /\btext-white\b/)
  assert.match(buttonsSource, /text-primary-foreground/)
  assert.match(buttonsSource, /text-secondary-foreground/)
  assert.match(buttonsSource, /rounded-\[var\(--radius-ept-control\)\]/)

  assert.match(inputsSource, /rounded-\[var\(--radius-ept-control\)\]/)
  assert.match(confirmDialogSource, /rounded-\[var\(--radius-ept-control\)\]/)
})

test('KAN-558 official EPT controls share an outdoor/mobile touch-target minimum without changing base primitives', () => {
  assert.match(globalsCss, /--size-ept-touch-target:\s*2\.75rem/)
  assert.match(buttonsSource, /min-h-\[var\(--size-ept-touch-target\)\]/)
  assert.match(inputsSource, /min-h-\[var\(--size-ept-touch-target\)\]/)
  assert.match(confirmDialogSource, /min-h-\[var\(--size-ept-touch-target\)\]/)
})

test('KAN-558 keeps focus and invalid-state behavior owned by the shadcn\/Base UI primitive layer', () => {
  const baseButtonSource = readSource('components/ui/button.tsx')
  const baseInputSource = readSource('components/ui/input.tsx')

  assert.match(baseButtonSource, /focus-visible:ring/)
  assert.match(baseButtonSource, /disabled:pointer-events-none/)
  assert.match(baseButtonSource, /aria-invalid:border-destructive/)

  assert.match(baseInputSource, /focus-visible:ring/)
  assert.match(baseInputSource, /disabled:pointer-events-none/)
  assert.match(baseInputSource, /aria-invalid:border-destructive/)
})

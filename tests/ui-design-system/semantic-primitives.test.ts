import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const buttonsSource = readSource('components/ui/custom/buttons.tsx')
const inputsSource = readSource('components/ui/custom/inputs.tsx')
const confirmDialogSource = readSource('components/ui/custom/confirm-dialog.tsx')
const cardsSource = readSource('components/ui/custom/card-containers.tsx')
const pillsSource = readSource('components/ui/custom/pills.tsx')
const globalsCss = readSource('app/globals.css')
const designSystemDoc = readSource('docs/architecture/platform/ui-design-system.md')

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


test('KAN-558 official EPT surfaces consume semantic spacing, shape, and elevation foundations', () => {
  assert.match(cardsSource, /rounded-\[var\(--radius-ept-surface\)\]/)
  assert.match(cardsSource, /p-\[var\(--space-ept-content\)\]/)
  assert.match(cardsSource, /shadow-\[var\(--elevation-ept-raised\)\]/)

  assert.match(cardsSource, /rounded-\[var\(--radius-ept-control\)\]/)
  assert.match(cardsSource, /rounded-\[var\(--radius-ept-overlay\)\]/)
})

test('KAN-558 shared pills and overlays avoid literal foreground and surface geometry', () => {
  assert.doesNotMatch(pillsSource, /\btext-white\b/)
  assert.match(pillsSource, /text-primary-foreground/)
  assert.match(pillsSource, /rounded-\[var\(--radius-ept-overlay\)\]/)
  assert.match(pillsSource, /shadow-\[var\(--elevation-ept-overlay\)\]/)
})


test('KAN-558 shared interactive wrappers expose accessible names and hide decorative icons', () => {
  assert.match(
    buttonsSource,
    /export type ThemeToggleButtonProps = [\s\S]*'aria-label': string/,
  )
  assert.match(buttonsSource, /<AnimatedThemeToggler[\s\S]*aria-label=/)
  assert.match(buttonsSource, /<Icon[^>]*aria-hidden=['"]true['"]/)

  assert.doesNotMatch(confirmDialogSource, /title\s*=\s*['"]¿Confirmar acción\?['"]/)
  assert.doesNotMatch(
    confirmDialogSource,
    /description\s*=\s*['"]Esta operación no se puede deshacer\.[\s\S]*['"]/,
  )
  assert.doesNotMatch(confirmDialogSource, /confirmLabel\s*=\s*['"]Confirmar['"]/)
  assert.doesNotMatch(confirmDialogSource, /cancelLabel\s*=\s*['"]Cancelar['"]/)
})

test('KAN-558 representative consumers provide localized accessible labels instead of wrapper-owned copy', () => {
  const homeHeaderSource = readSource('features/workouts/components/HomeHeader.tsx')

  assert.match(homeHeaderSource, /<ThemeToggleButton[^>]*aria-label=/)
  assert.match(confirmDialogSource, /title:\s*string/)
  assert.match(confirmDialogSource, /description:\s*string/)
  assert.match(confirmDialogSource, /confirmLabel:\s*string/)
  assert.match(confirmDialogSource, /cancelLabel:\s*string/)
})


test('KAN-558 documents the official primitive / semantic primitive / product-pattern boundary', () => {
  for (const phrase of [
    'Base primitives',
    'Official EPT semantic primitives',
    'Product patterns',
    'Feature compositions',
    'KAN-508',
  ]) {
    assert.ok(
      designSystemDoc.includes(phrase),
      `missing durable primitive boundary documentation: ${phrase}`,
    )
  }

  for (const componentName of [
    'CustomButton',
    'PrimaryInput',
    'ThemeToggleButton',
    'CustomCard',
    'CustomCardInside',
    'StatCard',
    'PillButton',
    'ConfirmActionDialog',
  ]) {
    assert.ok(
      designSystemDoc.includes(componentName),
      `missing officialized EPT primitive in documentation: ${componentName}`,
    )
  }

  assert.match(
    designSystemDoc,
    /focus-visible[\s\S]*disabled[\s\S]*aria-invalid/,
  )
  assert.match(designSystemDoc, /44 px|2\.75rem/)
})

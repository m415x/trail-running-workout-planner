import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const globalsCss = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

test('KAN-557 exposes an explicit semantic typography scale while preserving the approved mobile root scaling', () => {
  for (const token of [
    '--text-ept-display:',
    '--text-ept-heading:',
    '--text-ept-title:',
    '--text-ept-body:',
    '--text-ept-body-compact:',
    '--text-ept-label:',
    '--text-ept-caption:',
    '--text-ept-data:',
  ]) {
    assert.ok(globalsCss.includes(token), `missing semantic typography token: ${token}`)
  }

  assert.match(globalsCss, /html\s*\{[\s\S]*?font-size:\s*120%/)
  assert.match(
    globalsCss,
    /@media\s*\(min-width:\s*640px\)\s*\{[\s\S]*?html\s*\{[\s\S]*?font-size:\s*100%/,
  )
})

test('KAN-557 separates Brand roles from usage semantics instead of duplicating the palette', () => {
  for (const token of [
    '--brand-action:',
    '--brand-identity:',
    '--brand-highlight:',
  ]) {
    assert.ok(globalsCss.includes(token), `missing Brand role token: ${token}`)
  }

  assert.match(globalsCss, /--primary:\s*var\(--brand-action\)/)
  assert.match(globalsCss, /--secondary:\s*var\(--brand-identity\)/)
  assert.match(globalsCss, /--accent:\s*var\(--brand-highlight\)/)
})


type Oklch = {
  lightness: number
  chroma: number
  hue: number
}

function readThemeBlock(selector: ':root' | '.dark') {
  const escapedSelector = selector === ':root' ? ':root' : '\\.dark'
  const match = globalsCss.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`),
  )

  assert.ok(match, `missing theme block: ${selector}`)
  return match[1]
}

function readOklch(block: string, token: string): Oklch {
  const match = block.match(
    new RegExp(
      `--${token}:\\s*oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`,
    ),
  )

  assert.ok(match, `missing concrete oklch value for --${token}`)
  return {
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  }
}

function oklchToLinearSrgb({ lightness, chroma, hue }: Oklch) {
  const hueRadians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(hueRadians)
  const b = chroma * Math.sin(hueRadians)

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b

  return {
    red:
      4.0767416621 * lPrime ** 3 -
      3.3077115913 * mPrime ** 3 +
      0.2309699292 * sPrime ** 3,
    green:
      -1.2684380046 * lPrime ** 3 +
      2.6097574011 * mPrime ** 3 -
      0.3413193965 * sPrime ** 3,
    blue:
      -0.0041960863 * lPrime ** 3 -
      0.7034186147 * mPrime ** 3 +
      1.707614701 * sPrime ** 3,
  }
}

function relativeLuminance(color: Oklch) {
  const { red, green, blue } = oklchToLinearSrgb(color)
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel))

  return (
    0.2126 * clamp(red) +
    0.7152 * clamp(green) +
    0.0722 * clamp(blue)
  )
}

function contrastRatio(background: Oklch, foreground: Oklch) {
  const backgroundLuminance = relativeLuminance(background)
  const foregroundLuminance = relativeLuminance(foreground)
  const lighter = Math.max(backgroundLuminance, foregroundLuminance)
  const darker = Math.min(backgroundLuminance, foregroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

test('KAN-557 keeps officialized semantic color pairs at WCAG 2.2 AA normal-text contrast', () => {
  const themes = [
    { name: 'light', block: readThemeBlock(':root') },
    { name: 'dark', block: readThemeBlock('.dark') },
  ]

  for (const theme of themes) {
    for (const pair of [
      ['brand-action', 'primary-foreground'],
      ['brand-identity', 'secondary-foreground'],
      ['brand-highlight', 'accent-foreground'],
      ['destructive', 'destructive-foreground'],
      ['background', 'foreground'],
      ['card', 'card-foreground'],
    ] as const) {
      const ratio = contrastRatio(
        readOklch(theme.block, pair[0]),
        readOklch(theme.block, pair[1]),
      )

      assert.ok(
        ratio >= 4.5,
        `${theme.name} --${pair[0]} / --${pair[1]} contrast ${ratio.toFixed(2)} is below WCAG AA 4.5:1`,
      )
    }
  }
})

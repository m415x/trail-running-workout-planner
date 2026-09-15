import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

const layout = readFileSync('app/[locale]/(mobile)/layout.tsx', 'utf8')
const navigation = readFileSync('components/layout/BottomNavigationBar.tsx', 'utf8')

describe('athlete responsive shell', () => {
  it('does not constrain the athlete shell to a phone width on larger viewports', () => {
    assert.equal(layout.includes('sm:max-w-97.5'), false)
    assert.equal(layout.includes('sm:bg-black'), false)
    assert.equal(layout.includes('sm:border-x'), false)
  })

  it('keeps bottom navigation full-width while centering its navigation content', () => {
    assert.equal(navigation.includes('sm:max-w-97.5'), false)
    assert.equal(navigation.includes('w-full'), true)
    assert.equal(navigation.includes('max-w-md mx-auto'), true)
  })
})

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


  it('keeps one four-destination Athlete IA while adapting wide navigation as a compact persistent bottom bar', () => {
    for (const href of ["'/'", "'/plan'", "'/stats'", "'/profile'"]) {
      assert.equal(navigation.includes(`href: ${href}`), true)
    }

    assert.equal(navigation.includes('sm:left-1/2'), true)
    assert.equal(navigation.includes('sm:-translate-x-1/2'), true)
    assert.equal(navigation.includes('sm:w-auto'), true)
    assert.equal(
      navigation.includes('sm:rounded-[var(--radius-ept-overlay)]'),
      true,
    )

    assert.equal(navigation.includes('lg:flex-col'), false)
    assert.equal(navigation.includes('Sidebar'), false)
  })

  it('keeps navigation strategy responsive and does not derive layout mode from the pathname', () => {
    assert.equal(navigation.includes('pathname.startsWith'), false)
    assert.equal(navigation.includes('pathname.includes'), false)
    assert.equal(navigation.includes("pathname === href"), true)
  })

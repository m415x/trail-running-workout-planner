import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx', 'utf8')

describe('race course registration page contract', () => {
  it('exposes the course-first registration flow from the course detail page', () => {
    assert.match(page, /CourseRegistration/)
  })
})

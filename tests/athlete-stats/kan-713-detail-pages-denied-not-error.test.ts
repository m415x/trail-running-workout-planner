import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routes = [
  ['training', 'getCurrentAthleteStatsAction'],
  ['load', 'getCurrentAthleteStatsAction'],
  ['adherence', 'getCurrentAthleteStatsAction'],
  ['competition', 'getCurrentAthleteRaceRegistrationsAction'],
] as const

test('KAN-713 all Stats detail routes distinguish SELF denied and technical error', () => {
  for (const [route, action] of routes) {
    const source = readFileSync(`app/[locale]/(mobile)/stats/${route}/page.tsx`, 'utf8')
    assert.match(source, new RegExp(action), `missing server action: ${route}`)
    assert.match(source, /\.status === 'denied'/, `missing denied branch: ${route}`)
    assert.match(source, /t\('summary\.denied'\)/, `missing localized denied message: ${route}`)
    assert.match(source, /role='alert'/, `missing accessible denial: ${route}`)
  }
})

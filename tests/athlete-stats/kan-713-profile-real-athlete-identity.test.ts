import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')
const tab = readFileSync('features/profile/ProfileTab.tsx', 'utf8')
const header = readFileSync('features/profile/components/ProfileHeader.tsx', 'utf8')

test('KAN-713 Profile identifies the active AthleteProfile instead of a shared fixture user', () => {
  assert.doesNotMatch(tab, /import \{ currentUser \} from ['"]@\/data\/data['"]/)
  assert.doesNotMatch(tab, /user=\{currentUser\}/)
  assert.match(page, /athleteProfile=\{athleteProfile\}/)
  assert.match(tab, /<ProfileHeader athlete=\{athleteProfile\}/)
})

test('KAN-713 Profile header follows Home athlete display-name authority', () => {
  assert.match(header, /athlete\.firstName/)
  assert.match(header, /athlete\.lastName/)
  assert.match(header, /athlete\.nickName/)
  assert.doesNotMatch(header, /user\.firstName|user\.lastName|user\.userName/)
  assert.doesNotMatch(header, /year: 2024|@pepe/)
})

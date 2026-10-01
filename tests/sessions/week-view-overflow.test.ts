import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const card = readFileSync('features/sessions/components/SessionCalendarCard.tsx', 'utf8')
const weekly = readFileSync('features/sessions/components/WeeklySessionCalendar.tsx', 'utf8')

test('KAN-577 weekly card contains long session titles and type badges in one day column', () => {
  assert.match(weekly, /grid min-w-4xl grid-cols-7/)
  assert.match(weekly, /<SessionCalendarCard key=\{session.id\}/)
  assert.match(card, /className=\{cn\('flex min-w-0 flex-col/)
  assert.match(card, /font-semibold leading-snug min-w-0 break-words/)
  assert.match(card, /className=\{cn\('max-w-full self-start whitespace-normal break-words text-left/)
  assert.doesNotMatch(card, /<Badge[^>]*className=\{cn\('shrink-0'/)
})

test('KAN-577 session location and notes stay readable and links remain keyboard-accessible', () => {
  assert.match(card, /<Link href=\{href\}/)
  assert.match(card, /focus-visible:ring-2/)
  assert.match(card, /<MapPin/)
  assert.match(card, /min-w-0 break-words/)
  assert.match(card, /session.notes/)
  assert.match(card, /workoutTypeT\(`types.${session.type}`\)/)
})

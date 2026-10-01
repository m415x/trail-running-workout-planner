import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const monthly = readFileSync('features/sessions/components/MonthlySessionCalendar.tsx','utf8')
const messages = ['es','en'].map(locale => JSON.parse(
  readFileSync('messages/' + locale + '/planning/sessions.json','utf8'),
).Sessions)

test('KAN-577 month calendar exposes a named keyboard-scrollable region for all seven columns', () => {
  assert.match(monthly, /role='region'/)
  assert.match(monthly, /tabIndex=\{0\}/)
  assert.match(monthly, /aria-label=\{t\('calendar\.scrollRegion'\)\}/)
  assert.match(monthly, /overflow-x-auto/)
  assert.match(monthly, /focus-visible:ring-2/)
  assert.match(monthly, /min-w-4xl/)
  assert.match(monthly, /grid-cols-7/g)
  assert.match(monthly, /<SessionCalendarCard/)
})

test('KAN-577 month view explicitly indicates horizontal scrolling on narrow viewports only', () => {
  assert.match(monthly, /sm:hidden/)
  assert.match(monthly, /\{t\('calendar\.scrollHint'\)\}/)
  for (const m of messages) {
    assert.ok(m.calendar.scrollRegion)
    assert.ok(m.calendar.scrollHint)
  }
})

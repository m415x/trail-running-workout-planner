import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const component = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), `features/sessions/components/${name}.tsx`), 'utf8')

test('Sessions calendar components localize visible copy', () => {
  const monthly = component('MonthlySessionCalendar')
  const weekly = component('WeeklySessionCalendar')
  const filter = component('GroupCalendarFilter')
  const card = component('SessionCalendarCard')

  assert.match(monthly, /useTranslations\(['"]Sessions['"]\)/)
  assert.match(weekly, /useTranslations\(['"]Sessions['"]\)/)
  assert.match(filter, /useTranslations\(['"]Sessions['"]\)/)
  assert.match(card, /useTranslations\(['"]Workouts['"]\)/)

  for (const [source, copy] of [
    [monthly, 'sesiones'],
    [weekly, 'Sin sesiones'],
    [filter, 'Grupo'],
    [filter, 'Todos los grupos'],
    [filter, 'Inactivo'],
  ] as const) {
    assert.equal(source.includes(copy), false, copy)
  }

  assert.doesNotMatch(monthly, /const weekDays = \['Lun'/)
  assert.doesNotMatch(weekly, /DateTimeFormat\(['"]es-AR['"]/)
  assert.doesNotMatch(card, /\{session\.type\}/)
})

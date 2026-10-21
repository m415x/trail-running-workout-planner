import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = () => readFileSync('features/workouts/components/LogWorkoutDialog.tsx', 'utf8')

test('KAN-359/T9k dialog scroll and footer remain separated with responsive form layout', () => {
  const s = source()
  assert.match(s, /data-athlete-log-dialog/, 'existing Athlete-scoped portal retained')
  assert.match(s, /<ScrollArea[^>]*min-h-0/, 'form body remains independently scrollable')
  assert.match(s, /<DialogFooter[^>]*shrink-0/, 'footer remains visible')
  assert.match(s, /grid-cols-1[^']*sm:grid-cols-2/, 'field groups stack at narrow widths')
  assert.match(s, /flex-wrap|grid-cols-1[^']*sm:grid-cols-3/, 'footer actions reflow at enlarged sizes')
  assert.match(s, /min-w-0/, 'form children may shrink without forcing overflow')
  assert.match(s, /handleSave\(\)/, 'save action remains wired')
  assert.match(s, /onClick=\{resetForm\}/, 'reset remains wired')
  assert.match(s, /onClick=\{onClose\}/, 'cancel remains wired')
})

test('KAN-359/T9k preserve authenticated training fields and accessibility', () => {
  const s = source()
  for (const id of ['performedAt', 'distance', 'durationHours', 'durationMinutes', 'durationSeconds', 'elevationGain', 'averageHeartRate']) {
    assert.ok(s.includes(`id='${id}'`), `missing real training field: ${id}`)
  }
  assert.match(s, /role='alert'/)
  assert.match(s, /--athlete-text-body-compact/)
})

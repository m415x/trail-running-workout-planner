import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const review = read('features/sessions/components/AthleteSessionAdjustmentReview.tsx')
const detail = read('app/[locale]/dashboard/sessions/[sessionId]/page.tsx')
const mobileHome = read('app/[locale]/(mobile)/page.tsx')
const homeTab = read('features/workouts/HomeTab.tsx')
const dashboardActions = read('app/actions/dashboard-actions.ts')
const adjustmentActions = read('app/actions/athlete-session-adjustment-actions.ts')

test('KAN-521 Coach adjustment surface uses i18n for visible copy and server error codes', () => {
  assert.match(review, /useTranslations\(['"]Sessions['"]\)/)
  assert.match(review, /useTranslations\(['"]Workouts['"]\)/)

  assert.doesNotMatch(
    review,
    />\s*(?:Assignment individual|Stimulus|Tipo de stimulus|omitted|Dose individual|Workout ID|outside_authority · review required)\s*</,
  )
  assert.doesNotMatch(
    review,
    /(?:placeholder|label)=['"](?:Workout ID|Stimulus|Tipo de stimulus|Assignment individual|Dose individual)['"]/,
  )

  assert.doesNotMatch(review, />\s*\{state\.error\}\s*</)
  assert.match(review, /state\.error.*t\(/s)

  assert.equal(detail.includes('Ajustes individuales'), false)
  assert.equal(detail.includes('Review/edit individual por atleta sobre la prescription efectiva.'), false)
})

test('successful Coach save remounts each uncontrolled adjustment form from the new persisted revision', () => {
  assert.match(
    review,
    /key=\{`\$\{item\.athleteId\}:\$\{item\.revisionId \?\? ['"]none['"]\}`\}/,
  )
  assert.match(adjustmentActions, /revisionId/)
})

test('mobile Home consumes the same KAN-522 plus KAN-521 resolved planning path as Plan', () => {
  assert.doesNotMatch(mobileHome, /getWeeklySchedule/)
  assert.match(mobileHome, /getCurrentAthletePlanningWeek/)
  assert.doesNotMatch(homeTab, /getWeeklySchedule/)
  assert.match(homeTab, /getCurrentAthletePlanningWeek/)
  assert.match(dashboardActions, /getCurrentAthletePlanningWeek\([^)]*startDateIso/)
})

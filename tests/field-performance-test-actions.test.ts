import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const actionPath = path.join(process.cwd(), 'app/actions/field-performance-test-actions.ts')

test('server action composes team-scoped athlete authorization with the durable repository', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getAthleteById/)
  assert.match(source, /createSqliteFieldPerformanceTestRepository/)
  assert.match(source, /createTrack1000mEvidence/)
  assert.match(source, /correctTrack1000mEvidence/)
})

test('server action does not mutate legacy physiology or planning snapshots', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.doesNotMatch(source, /physiologyRecords/)
  assert.doesNotMatch(source, /athleteProfiles\.physiology/)
  assert.doesNotMatch(source, /groupTrainingPlans/)
  assert.doesNotMatch(source, /sessions/)
})


test('server action exposes separate athlete and coach field-test workflows', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCurrentAthlete/)
  assert.match(source, /createAthleteTrack1000mEvidence/)
  assert.match(source, /createCoachTrack1000mEvidence/)
  assert.match(source, /reviewCoachTrack1000mEvidence/)
  assert.match(source, /repository\.review/)
})

test('athlete field-test action derives subject identity server-side', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCurrentAthleteTrack1000mEvidenceAction/)
  assert.match(source, /getCurrentAthlete\(\)/)
  const signature = source.match(/getCurrentAthleteTrack1000mEvidenceAction\s*\(([\s\S]*?)\)\s*\{/)
  assert.ok(signature)
  assert.doesNotMatch(signature[1] ?? '', /\buserId\s*:/)
  assert.doesNotMatch(signature[1] ?? '', /\bathleteId\s*:/)
})


test('athlete field-test workflow exposes eligible official TestEvents for the current subject', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCurrentAthleteTrack1000mTestEventsAction/)
  assert.match(source, /fieldPerformanceTestEvents/)
  assert.match(source, /const athlete = currentAthlete\.data\.athleteProfile/)
  assert.match(source, /resolveEligibleTrack1000mTestEvents/)
  assert.match(source, /teamId: athlete\.teamId/)
  assert.match(source, /groupId,/)
  assert.match(source, /fieldPerformanceTestEvents\.teamId/)
  assert.match(source, /fieldPerformanceTestEvents\.groupId/)
  assert.match(source, /fieldPerformanceTestEvents\.isDeleted/)
})


test('coach field-test workflow exposes pending self-directed evidence for an owned athlete', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCoachPendingTrack1000mEvidenceAction/)
  assert.match(source, /getAthleteById/)
  assert.match(source, /repository\s*\.listActiveByAthlete/)
  assert.match(source, /executionContext === 'self_directed'/)
  assert.match(source, /reviewStatus === 'pending_review'/)
})


test('coach field-test workflow exposes eligible official TestEvents for an owned athlete', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /getCoachTrack1000mTestEventsAction/)
  assert.match(source, /getAthleteById\(athleteId\)/)
  assert.match(source, /resolveEligibleTrack1000mTestEvents/)
  assert.match(source, /fieldPerformanceTestEvents\.teamId/)
  assert.match(source, /fieldPerformanceTestEvents\.groupId/)
  assert.match(source, /fieldPerformanceTestEvents\.protocol/)
  assert.match(source, /fieldPerformanceTestEvents\.isDeleted/)
})


test('field-test workflows are exposed from Athlete Stats and Coach athlete detail entry points', () => {
  const athleteStatsPath = path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx')
  const coachAthletePath = path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx')
  const athleteStats = fs.readFileSync(athleteStatsPath, 'utf8')
  const coachAthlete = fs.readFileSync(coachAthletePath, 'utf8')

  assert.match(athleteStats, /AthleteTrack1000m/)
  assert.match(athleteStats, /getCurrentAthleteTrack1000mTestEventsAction/)
  assert.match(coachAthlete, /CoachTrack1000m/)
  assert.match(coachAthlete, /getCoachTrack1000mTestEventsAction/)
  assert.match(coachAthlete, /getCoachPendingTrack1000mEvidenceAction/)
})


test('official field-test registration derives performed date from the selected TestEvent', () => {
  const source = fs.readFileSync(actionPath, 'utf8')

  assert.match(source, /scheduledAt/)
  assert.match(source, /performedAt/)
  assert.match(source, /testEventId/)
  assert.match(source, /executionContext === 'official'/)
})


test('Athlete field-test entry point supports official and self-directed registration', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')
  const athleteForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/AthleteTrack1000mForm.tsx'), 'utf8')

  assert.match(source, /AthleteTrack1000mForm/)
  assert.match(athleteForm, /getCurrentAthleteTrack1000mEvidenceAction/)
  assert.match(athleteForm, /self_directed/)
  assert.match(athleteForm, /official/)
})

test('Coach field-test entry point supports official registration and pending review decisions', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')
  const coachForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.match(source, /CoachTrack1000mForm/)
  assert.match(coachForm, /createCoachTrack1000mEvidenceAction/)
  assert.match(coachForm, /reviewCoachTrack1000mEvidenceAction/)
  assert.match(coachForm, /accepted/)
  assert.match(coachForm, /rejected/)
})


test('field-test UI uses dedicated client components instead of server pages as interactive forms', () => {
  const athleteForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/AthleteTrack1000mForm.tsx'), 'utf8')
  const coachForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.match(athleteForm, /'use client'/)
  assert.match(athleteForm, /getCurrentAthleteTrack1000mEvidenceAction/)
  assert.match(coachForm, /'use client'/)
  assert.match(coachForm, /createCoachTrack1000mEvidenceAction/)
  assert.match(coachForm, /reviewCoachTrack1000mEvidenceAction/)
})


test('field-test UI does not introduce placeholder coach identity and preserves page locale', () => {
  const athletePage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')
  const coachPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')
  const coachForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.doesNotMatch(coachPage, /deferred-to-kan-298/)
  assert.doesNotMatch(coachForm, /coachUserId/)
  assert.match(athletePage, /params: Promise<\{ locale: string \}>/)
  assert.match(athletePage, /locale=\{locale\}/)
})


test('Coach field-test workflow reads authorized history, factual evolution and running reference', () => {
  const actionSource = fs.readFileSync(actionPath, 'utf8')
  const coachPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')

  assert.match(actionSource, /getCoachTrack1000mHistoryAction/)
  assert.match(actionSource, /readAthleteTrack1000mEvolution/)
  assert.match(actionSource, /resolveAthleteRunningReference/)
  assert.match(actionSource, /repository\.listActiveByAthlete/)
  assert.match(coachPage, /getCoachTrack1000mHistoryAction/)
  assert.match(coachPage, /comparison\.direction/)
  assert.match(coachPage, /decreasing/)
  assert.match(coachPage, /increasing/)
  assert.match(coachPage, /Más rápido/)
  assert.match(coachPage, /Más lento/)
  assert.match(coachPage, /Igual/)
})


test('Coach field-test workflow exposes append-only correction from history', () => {
  const coachPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')
  const coachForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.match(coachPage, /historyResult\.data\.history/)
  assert.match(coachForm, /correctTrack1000mEvidenceAction/)
  assert.match(coachForm, /evidenceId/)
  assert.match(coachForm, /replacement/)
})


test('Coach field-test workflow presents factual evolution and running reference states', () => {
  const coachPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')

  assert.match(coachPage, /historyResult\.data\.evolution/)
  assert.match(coachPage, /historyResult\.data\.reference/)
  assert.match(coachPage, /historyResult\.data\.reference\.status === 'available'/)
  assert.match(coachPage, /paceLabel/)
  assert.match(coachPage, /averageSpeedKmh/)
  assert.match(coachPage, /No disponible/)
  assert.match(coachPage, /Unavailable/)
  assert.match(coachPage, /Evidencia insuficiente/)
  assert.match(coachPage, /Insufficient evidence/)
})


test('Coach field-test workflow distinguishes TestEvent and inbox load errors from empty states', () => {
  const coachPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')
  const coachForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.match(coachPage, /eventsError=/)
  assert.match(coachPage, /pendingError=/)
  assert.match(coachForm, /eventsError/)
  assert.match(coachForm, /pendingError/)
  assert.match(coachForm, /No se pudieron cargar las instancias oficiales/)
  assert.match(coachForm, /Official test events could not be loaded/)
  assert.match(coachForm, /No se pudieron cargar los pendientes/)
  assert.match(coachForm, /Pending submissions could not be loaded/)
})


test('Coach field-test workflow identifies official TestEvent results without relabeling accepted self-directed evidence', () => {
  const actionSource = fs.readFileSync(actionPath, 'utf8')
  const coachPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')

  assert.match(actionSource, /officialResults/)
  assert.match(actionSource, /executionContext === 'official'/)
  assert.match(actionSource, /testEventId/)
  assert.match(actionSource, /officialResults/)
  assert.match(actionSource, /executionContext === 'official'/)
  assert.match(actionSource, /testEventId/)
  assert.match(coachPage, /historyResult\.data\.history/)
  assert.match(coachPage, /CoachTrack1000mForm/)
})


test('Athlete Stats reads an explicit safe 1000 m performance projection', () => {
  const athleteStatsPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')
  const actionSource = fs.readFileSync(actionPath, 'utf8')

  assert.match(actionSource, /getCurrentAthleteTrack1000mPerformanceAction/)
  assert.match(actionSource, /listEligibleFieldPerformanceTestHistory/)
  assert.match(actionSource, /executionContext/)
  assert.match(athleteStatsPage, /getCurrentAthleteTrack1000mPerformanceAction/)
  assert.match(athleteStatsPage, /performanceResult/)
  assert.match(athleteStatsPage, /executionContext === 'official'/)
  assert.match(athleteStatsPage, /Self-directed/)
  assert.doesNotMatch(athleteStatsPage, /reviewStatus/)
  assert.doesNotMatch(athleteStatsPage, /recordedByUserId/)
})


test('Athlete Stats presents factual 1000 m evolution, running reference and insufficient evidence states', () => {
  const athleteStatsPage = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')

  assert.match(athleteStatsPage, /performanceResult\.data\.reference/)
  assert.match(athleteStatsPage, /paceLabel/)
  assert.match(athleteStatsPage, /averageSpeedKmh/)
  assert.match(athleteStatsPage, /comparison\.direction/)
  assert.match(athleteStatsPage, /decreasing/)
  assert.match(athleteStatsPage, /increasing/)
  assert.match(athleteStatsPage, /Más rápido/)
  assert.match(athleteStatsPage, /Faster/)
  assert.match(athleteStatsPage, /Más lento/)
  assert.match(athleteStatsPage, /Slower/)
  assert.match(athleteStatsPage, /Igual/)
  assert.match(athleteStatsPage, /Same/)
  assert.match(athleteStatsPage, /Evidencia insuficiente/)
  assert.match(athleteStatsPage, /Insufficient evidence/)
  assert.match(athleteStatsPage, /Referencia no disponible/)
  assert.match(athleteStatsPage, /Reference unavailable/)
})


test('Athlete Stats performance boundary excludes pending and rejected evidence before projection', () => {
  const actionSource = fs.readFileSync(actionPath, 'utf8')
  const performanceBoundary = actionSource.slice(
    actionSource.indexOf('export async function getCurrentAthleteTrack1000mPerformanceAction'),
  )

  assert.match(performanceBoundary, /listEligibleFieldPerformanceTestHistory/)
  assert.match(performanceBoundary, /const eligible =/)
  assert.match(performanceBoundary, /projectTrack1000mEvolution\(eligible, athleteId\)/)
  assert.match(performanceBoundary, /evidence: eligible\.map/)
  assert.doesNotMatch(performanceBoundary, /pending_review/)
  assert.doesNotMatch(performanceBoundary, /reviewStatus/)
})


test('field-test forms capture 1000 m elapsed time as minutes plus seconds and derive total seconds', () => {
  const athleteForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/AthleteTrack1000mForm.tsx'), 'utf8')
  const coachForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  for (const form of [athleteForm, coachForm]) {
    assert.match(form, /minutes/)
    assert.match(form, /seconds/)
    assert.match(form, /max=['"]59['"]/)
    assert.match(form, /Number\(minutes\)\s*\*\s*60\s*\+\s*Number\(seconds\)/)
  }

  assert.doesNotMatch(athleteForm, /Tiempo \(segundos\)/)
  assert.doesNotMatch(coachForm, /Tiempo en segundos/)
})

test('field-test forms explain unavailable official TestEvents instead of presenting an empty selector', () => {
  const athleteForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/AthleteTrack1000mForm.tsx'), 'utf8')
  const coachForm = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.match(coachForm, /events\.length === 0/)
  assert.match(coachForm, /No hay instancias oficiales disponibles/)
  assert.match(athleteForm, /events\.length === 0/)
  assert.match(athleteForm, /No hay instancias oficiales disponibles/)
})

test('development seed provides an eligible 1000 m TestEvent for the current athlete group', () => {
  const seed = fs.readFileSync(path.join(process.cwd(), 'db/seed.ts'), 'utf8')

  assert.match(seed, /fieldPerformanceTestEvents/)
  assert.match(seed, /1000m_track/)
  assert.match(seed, /currentGroup\.id/)
})


test('official 1000 m evidence cannot be recorded before the scheduled TestEvent date', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'app/actions/field-performance-test-actions.ts'), 'utf8')

  assert.match(source, /getCurrentISODateInTimeZone/)
  assert.match(source, /testEventPerformedAt\(testEvent\.scheduledAt\)/)
  assert.match(source, /test_event_not_yet_occurred/)
})

test('coach review refreshes the route and disables only the evidence being reviewed', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.match(source, /useRouter/)
  assert.match(source, /router\.refresh\(\)/)
  assert.match(source, /reviewingEvidenceId/)
  assert.match(source, /disabled=\{reviewingEvidenceId === item\.id\}/)
})


test('athlete field-test presentation formats elapsed time as mm:ss and localizes future-event errors', () => {
  const stats = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')
  const form = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/AthleteTrack1000mForm.tsx'), 'utf8')

  assert.match(stats, /formatElapsedTime/)
  assert.doesNotMatch(stats, /elapsedTimeSec}\s*s/)
  assert.match(form, /test_event_not_yet_occurred/)
  assert.match(form, /todavía no ocurrió|has not occurred yet/)
})


test('athlete 1000 m result avoids duplicating elapsed time and pace for the fixed 1 km protocol', () => {
  const stats = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')

  assert.doesNotMatch(stats, /formatElapsedTime\(point\.elapsedTimeSec\).*formatElapsedTime\(point\.paceSecPerKm\)/)
  assert.match(stats, /formatElapsedTime\(point\.paceSecPerKm\).*min\/km/)
})


test('athlete stats keeps 1000 m summary visible and moves history and registration into accordions', () => {
  const stats = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')

  assert.match(stats, /Accordion/)
  assert.match(stats, /Historial de tests|Test history/)
  assert.match(stats, /Registrar nuevo test|Record new test/)
  assert.match(stats, /evolution\?\.series\.length/)
})

test('coach 1000 m presentation prioritizes pending review and collapses registration and unified history', () => {
  const form = fs.readFileSync(path.join(process.cwd(), 'features/field-performance-test/components/CoachTrack1000mForm.tsx'), 'utf8')

  assert.match(form, /Accordion/)
  assert.match(form, /pendingEvidence\.length > 0/)
  assert.match(form, /Registrar test oficial|Record official test/)
  assert.match(form, /Historial|History/)
  assert.doesNotMatch(form, /Histórico corregible/)
})


test('coach athlete page keeps analytical 1000 m history inside the collapsed history section', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/dashboard/athletes/[athleteId]/page.tsx'), 'utf8')

  assert.doesNotMatch(page, /Histórico y referencia/)
  assert.doesNotMatch(page, /historyResult\.data\.officialResults\.map/)
  assert.match(page, /reference=/)
  assert.match(page, /factualTrend=/)
})

test('athlete 1000 m mobile summary is compact and avoids explanatory copy when evidence exists', () => {
  const stats = fs.readFileSync(path.join(process.cwd(), 'app/[locale]/(mobile)/stats/page.tsx'), 'utf8')

  assert.ok(stats.indexOf('performanceResult.success') < stats.indexOf("reference?.status === 'available'"))
  assert.doesNotMatch(stats, /Registrá un test oficial programado o un intento autogestionado\.<\/p>/)
})


test('WorkoutCard avoids duplicate zone guidance and suppresses flat-reference quality targets on variable terrain', () => {
  const card = fs.readFileSync(path.join(process.cwd(), 'features/workouts/components/WorkoutCard.tsx'), 'utf8')

  assert.doesNotMatch(card, /RPE \{executionGuidance\.zone\.rpe\.min\}/)
  assert.doesNotMatch(card, /card\.guidance\.talkTest/)
  assert.match(card, /shouldPrioritizeTerrainEffort/)
  assert.match(card, /terrainPriority/)
  assert.match(card, /executionGuidance\.quality\?\.status === 'available' && !shouldPrioritizeTerrainEffort/)
})

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

  assert.match(coachPage, /historyResult\.data\.evolution\.series/)
  assert.match(coachPage, /historyResult\.data\.reference/)
  assert.match(coachPage, /reference\?\.status === 'available'/)
  assert.match(coachPage, /paceLabel/)
  assert.match(coachPage, /averageSpeedKmh/)
  assert.match(coachPage, /Referencia no disponible/)
  assert.match(coachPage, /Reference unavailable/)
  assert.match(coachPage, /Sin resultados aceptados/)
  assert.match(coachPage, /No accepted results/)
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
  assert.match(coachPage, /historyResult\.data\.officialResults/)
  assert.match(coachPage, /Resultado oficial/)
  assert.match(coachPage, /Official result/)
  assert.match(coachPage, /Instancia/)
  assert.match(coachPage, /Test event/)
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

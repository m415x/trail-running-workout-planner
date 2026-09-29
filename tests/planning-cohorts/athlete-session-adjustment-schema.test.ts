import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

for (const schemaPath of ['db/schema.ts', 'db/supabase/schema.ts']) {
  test(`${schemaPath} declares stable AthleteSessionAdjustment identity and append-only revisions`, () => {
    const schema = source(schemaPath)

    assert.match(schema, /athleteSessionAdjustments/)
    assert.match(schema, /['"]athlete_session_adjustments['"]/)
    assert.match(schema, /teamId:[\s\S]*athleteId:[\s\S]*sourcePrescriptionId:/)
    assert.match(
      schema,
      /uniqueIndex\(['"]athlete_session_adjustments_athlete_prescription_unique['"]\)[\s\S]*\.on\(table\.athleteId, table\.sourcePrescriptionId\)/,
    )

    assert.match(schema, /athleteSessionAdjustmentRevisions/)
    assert.match(schema, /['"]athlete_session_adjustment_revisions['"]/)
    assert.match(schema, /adjustmentId:[\s\S]*state:[\s\S]*payload:[\s\S]*reason:[\s\S]*changedByUserId:[\s\S]*isCurrent:/)
    assert.match(
      schema,
      /uniqueIndex\(['"]athlete_session_adjustment_revisions_current_unique['"]\)[\s\S]*\.on\(table\.adjustmentId\)[\s\S]*\.where\(/,
    )
    assert.match(schema, /athlete_session_adjustment_revisions_state_check/)
    assert.match(schema, /active[\s\S]*withdrawn/)
  })
}

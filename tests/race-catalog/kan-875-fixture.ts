import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

export const revision = '2026-01-01T00:00:00.000Z'
export const actors = ['anonymous', 'athlete', 'assistant', 'coach', 'admin', 'unlinked', 'invalid'] as const
export const kinds = ['event', 'edition', 'course'] as const
export const operations = ['create', 'update', 'archive'] as const
export const ids = { event: 'kan875-event', edition: 'kan875-edition', course: 'kan875-course' }
export const maintainer = 'kan875-user-maintainer'

export function seedKan875(path: string) {
  const db = new Database(path, { fileMustExist: true })
  try {
    db.pragma('foreign_keys = ON')
    const insert = (table: string, values: Record<string, string | number | null>) => {
      const keys = Object.keys(values)
      db.prepare('INSERT INTO "' + table + '" (' + keys.join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')').run(...Object.values(values))
    }
    const stamp = { created_at: revision, updated_at: revision }
    db.transaction(() => {
      insert('teams', { id: 'kan875-team', name: 'Fixture team', ...stamp })
      for (const preset of ['athlete', 'assistant', 'coach', 'admin', 'maintainer']) {
        const id = 'kan875-user-' + preset
        insert('users', { id, user_name: id, email: id + '@example.invalid', first_name: 'Fixture', last_name: preset, ...stamp })
        insert('external_identity_links', { id: 'kan875-link-' + preset, user_id: id, provider: 'supabase', subject: 'kan875-subject-' + preset, ...stamp })
        if (preset !== 'maintainer') insert('team_memberships', { id: 'kan875-member-' + preset, user_id: id, team_id: 'kan875-team', preset, effective_from: revision, is_active: 1, ...stamp })
      }
      insert('athlete_groups', { id: 'kan875-group', team_id: 'kan875-team', category_code: 'S', level_code: '2', ...stamp })
      insert('athlete_profiles', { id: 'kan875-profile', team_id: 'kan875-team', user_id: 'kan875-user-athlete', group_id: 'kan875-group', dni: 'KAN875-FIXTURE', ...stamp })
      insert('group_training_plans', { id: 'kan875-plan', group_id: 'kan875-group', title: 'Fixture plan', status: 'draft', ...stamp })
      insert('macrocycles', { id: 'kan875-macro', group_training_plan_id: 'kan875-plan', title: 'Fixture macro', start_date: '2027-01-01', end_date: '2027-12-31', target_race_name: 'Historic race', target_race_date: '2027-04-01', target_race_distance_km: 21, target_race_elevation_gain: 700, ...stamp })
      const source = { source_origin: 'external', source_provider: 'kan875-fixture-provider', source_url: 'https://example.invalid/catalog' }
      insert('race_events', { id: ids.event, name: 'Fixture event', status: 'active', external_id: 'fixture-event', ...source, ...stamp })
      insert('race_editions', { id: ids.edition, race_event_id: ids.event, label: 'Fixture edition', start_date: '2027-04-01', status: 'published', external_id: 'fixture-edition', ...source, ...stamp })
      insert('race_courses', { id: ids.course, race_edition_id: ids.edition, label: 'Fixture course', distance_km: 21, elevation_gain_m: 700, modality: JSON.stringify({ code: 'trail' }), classifications: JSON.stringify([{ systemId: 'itra.distance_category', authority: 'ITRA', dimension: 'distance_category', versionRef: '2026-09-13', code: 'Half Marathon', provenance: 'manual_reference' }]), status: 'published', external_id: 'fixture-course', ...source, ...stamp })
      insert('competition_entries', { id: 'kan875-entry', group_training_plan_id: 'kan875-plan', name: 'Historic race', date: '2027-04-01', distance_km: 21, elevation_gain_m: 700, priority: 'A', status: 'confirmed', ...stamp })
      insert('training_goals', { id: 'kan875-goal', athlete_id: 'kan875-profile', type: 'race', status: 'draft', title: 'Historic goal', target_date: '2027-04-01', race_name: 'Historic race', race_distance_km: 21, race_elevation_gain: 700, ...stamp })
      insert('competition_entry_race_courses', { competition_entry_id: 'kan875-entry', race_course_id: ids.course, created_at: revision })
      insert('training_goal_race_courses', { training_goal_id: 'kan875-goal', race_course_id: ids.course, created_at: revision })
      insert('race_registrations', { id: 'kan875-registration', team_id: 'kan875-team', athlete_profile_id: 'kan875-profile', race_event_id: ids.event, race_edition_id: ids.edition, race_course_id: ids.course, registration_status: 'registered', participation_status: 'unknown', snapshot_event_name: 'Historic event', snapshot_edition_label: 'Historic edition', snapshot_edition_date: '2027-04-01', snapshot_course_label: 'Historic course', snapshot_nominal_distance_km: 21, snapshot_nominal_elevation_gain_m: 700, ...stamp })
      assert.equal((db.pragma('foreign_key_check') as unknown[]).length, 0)
    })()
  } finally { db.close() }
}

export function snapshotKan875(path: string) {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
    assert.equal((db.pragma('foreign_key_check') as unknown[]).length, 0)
    const schema = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all()
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>
    const rows = Object.fromEntries(tables.map(({ name }) => [
      name,
      db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"').all().map(row => JSON.stringify(row)).sort(),
    ]))
    return { schema, rows }
  } finally { db.close() }
}

export function makeKan875Form(kind: typeof kinds[number], operation: typeof operations[number]) {
  const form = new FormData()
  const fields: Record<string, string> = {
    kind, operation: operation === 'archive' ? 'archive' : 'save', locale: 'es',
    id: operation === 'create' ? '' : ids[kind],
    revision: operation === 'create' ? '' : revision,
    eventId: kind === 'event' ? '' : ids.event,
    editionId: kind === 'course' ? ids.edition : '',
    status: kind === 'event' ? 'active' : 'published',
    name: 'Changed event', description: 'Changed description', websiteUrl: '',
    label: 'Changed ' + kind, startDate: '2027-04-02', endDate: '', organizerName: '',
    notes: 'Changed notes', locality: '', region: '', countryCode: '',
    distanceKm: '25', elevationGainM: '0', modalityCode: 'trail', modalityLabel: '',
    scheduledStartAt: '', startLocationLabel: '',
  }
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return form
}

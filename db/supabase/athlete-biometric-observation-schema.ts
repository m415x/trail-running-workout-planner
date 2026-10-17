import { check, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { athleteProfiles, teams, users } from './schema'

/** T5 immutable biometric evidence; SELF authorization and correction checks belong to the transactional writer. */
export const athleteBiometricObservations = pgTable('athlete_biometric_observations', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'restrict' }),
  athleteProfileId: text('athlete_profile_id').notNull().references(() => athleteProfiles.id, { onDelete: 'restrict' }),
  kind: text('kind', { enum: ['weight', 'height', 'max_hr', 'rest_hr'] }).notNull(),
  valueScaled: integer('value_scaled').notNull(),
  unit: text('unit', { enum: ['kg', 'cm', 'bpm'] }).notNull(),
  observedOn: text('observed_on').notNull(),
  recordedAt: text('recorded_at').notNull(),
  recordedByUserId: text('recorded_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  source: text('source').notNull().default('athlete_declared'),
  supersedesObservationId: text('supersedes_observation_id'),
  operationKey: text('operation_key').notNull(),
  requestDigest: text('request_digest').notNull(),
  correctionReason: text('correction_reason'),
}, (t) => [
  check('athlete_biometric_kind_value_unit_check', sql.raw("(kind = 'weight' AND unit = 'kg' AND value_scaled BETWEEN 200 AND 3500) OR (kind = 'height' AND unit = 'cm' AND value_scaled BETWEEN 1000 AND 2500) OR (kind = 'max_hr' AND unit = 'bpm' AND value_scaled BETWEEN 60 AND 240) OR (kind = 'rest_hr' AND unit = 'bpm' AND value_scaled BETWEEN 25 AND 150)")),
  check('athlete_biometric_source_check', sql.raw("source = 'athlete_declared'")),
  check('athlete_biometric_not_self_supersede_check', sql.raw("supersedes_observation_id IS NULL OR supersedes_observation_id <> id")),
  uniqueIndex('athlete_biometric_operation_unique').on(t.teamId, t.athleteProfileId, t.recordedByUserId, t.operationKey),
  uniqueIndex('athlete_biometric_single_successor_unique').on(t.supersedesObservationId),
  index('athlete_biometric_effective_idx').on(t.teamId, t.athleteProfileId, t.kind, t.observedOn, t.recordedAt, t.id),
  index('athlete_biometric_known_idx').on(t.teamId, t.athleteProfileId, t.recordedAt),
]).enableRLS()

import type { db as sqliteDb } from '@/db/index'
import { groupSessionPrescriptions, sessions } from '@/db/schema'

type SeedDb = typeof sqliteDb

/**
 * Deterministic multi-group acceptance evidence for H4B.
 * The two prescriptions use DIFFERENT microcycles, one per owning plan:
 * the canonical (session_id, microcycle_id) uniqueness is preserved.
 * Does not change any existing manual/generated session.
 */
export async function seedH4bSharedSession(
  db: SeedDb,
  input: {
    teamId: string
    date: string
    s2GroupId: string
    m1GroupId: string
    s2MicrocycleId: string
    m1MicrocycleId: string
  },
): Promise<void> {
  const sessionId = 'accept_h4b_shared_session'
  await db.insert(sessions).values({
    id: sessionId,
    teamId: input.teamId,
    date: input.date,
    title: 'Aceptación H4B — sesión compartida S2/M1',
    type: 'Base',
    workoutId: null,
    locationKey: null,
    trackPath: null,
    structure: null,
    notes: 'Fixture durable para verificar autorización conjunta de S2 y M1.',
    generationOwnership: 'manual',
    sharedEventKey: null,
  }).onConflictDoNothing().run()

  await db.insert(groupSessionPrescriptions).values([
    {
      id: 'accept_h4b_shared_prescription_s2',
      sessionId,
      groupId: input.s2GroupId,
      microcycleId: input.s2MicrocycleId,
      distanceKm: 8,
      durationMin: 60,
      notes: 'S2 — sesión compartida de aceptación.',
      generationOwnership: 'manual',
      generationKey: null,
    },
    {
      id: 'accept_h4b_shared_prescription_m1',
      sessionId,
      groupId: input.m1GroupId,
      microcycleId: input.m1MicrocycleId,
      distanceKm: 12,
      durationMin: 80,
      notes: 'M1 — sesión compartida de aceptación.',
      generationOwnership: 'manual',
      generationKey: null,
    },
  ]).onConflictDoNothing().run()
}

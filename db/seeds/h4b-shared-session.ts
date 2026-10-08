import type { db as sqliteDb } from '@/db/index'
import { eq } from 'drizzle-orm'
import { groupSessionPrescriptions, microcycles, sessions } from '@/db/schema'

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
  const persisted = await db.select({
    id: microcycles.id,
    startDate: microcycles.startDate,
    endDate: microcycles.endDate,
  }).from(microcycles).where(eq(microcycles.id, input.s2MicrocycleId)).all()
  const peer = await db.select({
    id: microcycles.id,
    startDate: microcycles.startDate,
    endDate: microcycles.endDate,
  }).from(microcycles).where(eq(microcycles.id, input.m1MicrocycleId)).all()
  if (persisted.length !== 1 || peer.length !== 1) {
    throw new Error('H4B fixture: missing persisted microcycles')
  }
  const s2 = persisted[0]!
  const m1 = peer[0]!
  const date = s2.startDate > m1.startDate ? s2.startDate : m1.startDate
  if (date > s2.endDate || date > m1.endDate) {
    throw new Error('H4B fixture: microcycles have no shared date')
  }
  const existing = await db.select({
    teamId: sessions.teamId,
    title: sessions.title,
    ownership: sessions.generationOwnership,
    isDeleted: sessions.isDeleted,
  }).from(sessions).where(eq(sessions.id, sessionId)).all()
  if (existing.length && (
    existing[0]?.teamId !== input.teamId ||
    existing[0]?.title !== 'Aceptación H4B — sesión compartida S2/M1' ||
    existing[0]?.ownership !== 'manual' ||
    existing[0]?.isDeleted
  )) throw new Error('H4B fixture: existing session not owned by fixture')
  await db.insert(sessions).values({
    id: sessionId,
    teamId: input.teamId,
    date,
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

  // Reconcile only this owned acceptance session after a seed rerun on a new week.
  await db.update(sessions).set({ date }).where(eq(sessions.id, sessionId)).run()

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

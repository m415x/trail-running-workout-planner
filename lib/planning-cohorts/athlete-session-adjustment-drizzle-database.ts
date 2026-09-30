import { and, eq } from 'drizzle-orm'

import {
  athleteProfiles,
  athleteSessionAdjustmentRevisions,
  athleteSessionAdjustments,
  groupSessionPrescriptions,
  sessions,
} from '@/db/schema'

import type {
  AthleteSessionAdjustmentPersistencePort,
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from './athlete-session-adjustment-persistence'

type Mutation = {
  run?: () => unknown
  execute?: () => unknown
  then?: Promise<unknown>['then']
}

type DrizzleClient = {
  select?: () => {
    from: (table: unknown) => {
      where?: (condition: unknown) => Promise<Record<string, unknown>[]>
      innerJoin?: (
        table: unknown,
        condition: unknown,
      ) => {
        where: (condition: unknown) => Promise<Record<string, unknown>[]>
      }
    }
  }
  transaction?: (
    callback: (tx: DrizzleClient) => void | Promise<void>,
  ) => Promise<void> | void
  insert?: (table: unknown) => {
    values: (values: Record<string, unknown>[]) => Mutation
  }
  update?: (table: unknown) => {
    set: (values: Record<string, unknown>) => {
      where: (condition: unknown) => Mutation
    }
  }
}

function executeMutation(mutation: Mutation) {
  if (typeof mutation.run === 'function') return mutation.run()
  if (typeof mutation.execute === 'function') return mutation.execute()
  return mutation
}

export function createDrizzleAthleteSessionAdjustmentDatabase(
  client: DrizzleClient,
): AthleteSessionAdjustmentPersistencePort {
  return {
    async athleteBelongsToTeam(teamId, athleteId) {
      if (!client.select) throw new Error('Drizzle client does not support selects')

      const rows = await client.select()
        .from(athleteProfiles)
        .where?.(and(
          eq(athleteProfiles.id, athleteId),
          eq(athleteProfiles.teamId, teamId),
          eq(athleteProfiles.isDeleted, false),
        ))

      return Boolean(rows?.[0])
    },

    async prescriptionBelongsToTeam(teamId, prescriptionId) {
      if (!client.select) throw new Error('Drizzle client does not support selects')

      const rows = await client.select()
        .from(groupSessionPrescriptions)
        .innerJoin?.(
          sessions,
          eq(sessions.id, groupSessionPrescriptions.sessionId),
        )
        .where(and(
          eq(groupSessionPrescriptions.id, prescriptionId),
          eq(groupSessionPrescriptions.isDeleted, false),
          eq(sessions.teamId, teamId),
          eq(sessions.isDeleted, false),
        ))

      return Boolean(rows?.[0])
    },

    async getAdjustmentByIdentity(athleteId, sourcePrescriptionId) {
      if (!client.select) throw new Error('Drizzle client does not support selects')

      const rows = await client.select()
        .from(athleteSessionAdjustments)
        .where?.(and(
          eq(athleteSessionAdjustments.athleteId, athleteId),
          eq(athleteSessionAdjustments.sourcePrescriptionId, sourcePrescriptionId),
          eq(athleteSessionAdjustments.isDeleted, false),
        ))

      const row = rows?.[0]
      if (!row) return null

      return {
        id: String(row.id),
        teamId: String(row.teamId),
        athleteId: String(row.athleteId),
        sourcePrescriptionId: String(row.sourcePrescriptionId),
      }
    },

    async listAdjustmentRevisions(adjustmentId) {
      if (!client.select) throw new Error('Drizzle client does not support selects')

      const rows = await client.select()
        .from(athleteSessionAdjustmentRevisions)
        .where?.(and(
          eq(athleteSessionAdjustmentRevisions.adjustmentId, adjustmentId),
          eq(athleteSessionAdjustmentRevisions.isDeleted, false),
        )) ?? []

      return rows.map(row => ({
        id: String(row.id),
        adjustmentId: String(row.adjustmentId),
        state: row.state as 'active' | 'withdrawn',
        payload: row.payload as PersistedAthleteSessionAdjustmentRevision['payload'],
        reason: String(row.reason),
        changedByUserId: row.changedByUserId === null || row.changedByUserId === undefined
          ? null
          : String(row.changedByUserId),
        isCurrent: Boolean(row.isCurrent),
      }))
    },

    async insertAdjustmentWithRevision(
      adjustment: PersistedAthleteSessionAdjustment,
      revision: PersistedAthleteSessionAdjustmentRevision,
    ) {
      if (revision.adjustmentId !== adjustment.id) {
        throw new Error('Initial revision must preserve adjustment identity')
      }
      if (!revision.isCurrent) {
        throw new Error('Initial adjustment revision must be current')
      }
      if (!client.transaction) {
        throw new Error('Drizzle client does not support transactions')
      }

      const now = new Date().toISOString()

      await client.transaction((tx) => {
        if (!tx.insert) throw new Error('Drizzle transaction does not support inserts')

        executeMutation(tx.insert(athleteSessionAdjustments).values([{
          id: adjustment.id,
          teamId: adjustment.teamId,
          athleteId: adjustment.athleteId,
          sourcePrescriptionId: adjustment.sourcePrescriptionId,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        }]))

        executeMutation(tx.insert(athleteSessionAdjustmentRevisions).values([{
          id: revision.id,
          adjustmentId: revision.adjustmentId,
          state: revision.state,
          payload: revision.payload,
          reason: revision.reason,
          changedByUserId: revision.changedByUserId,
          isCurrent: true,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        }]))
      })
    },

    async replaceCurrentRevisionAtomically(
      previous: PersistedAthleteSessionAdjustmentRevision,
      replacement: PersistedAthleteSessionAdjustmentRevision,
    ) {
      if (previous.adjustmentId !== replacement.adjustmentId) {
        throw new Error('Revision replacement must preserve adjustment identity')
      }
      if (!previous.isCurrent || !replacement.isCurrent) {
        throw new Error('Revision replacement requires current previous and replacement revisions')
      }
      if (!client.transaction) {
        throw new Error('Drizzle client does not support transactions')
      }

      const now = new Date().toISOString()

      await client.transaction((tx) => {
        if (!tx.update) throw new Error('Drizzle transaction does not support updates')
        if (!tx.insert) throw new Error('Drizzle transaction does not support inserts')

        executeMutation(tx.update(athleteSessionAdjustmentRevisions)
          .set({
            isCurrent: false,
            updatedAt: now,
          })
          .where(eq(athleteSessionAdjustmentRevisions.id, previous.id)))

        executeMutation(tx.insert(athleteSessionAdjustmentRevisions).values([{
          id: replacement.id,
          adjustmentId: replacement.adjustmentId,
          state: replacement.state,
          payload: replacement.payload,
          reason: replacement.reason,
          changedByUserId: replacement.changedByUserId,
          isCurrent: true,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        }]))
      })
    },
  }
}

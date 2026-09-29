import { eq } from 'drizzle-orm'

import {
  athleteSessionAdjustmentRevisions,
  athleteSessionAdjustments,
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
): Pick<
  AthleteSessionAdjustmentPersistencePort,
  'insertAdjustmentWithRevision' | 'replaceCurrentRevisionAtomically'
> {
  return {
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

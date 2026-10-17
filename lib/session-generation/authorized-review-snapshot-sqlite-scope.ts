import type Database from 'better-sqlite3'

import {
  resolveAuthorizedReviewSnapshotScope,
  type ReviewSnapshotScopeResult,
} from '@/lib/session-generation/authorized-review-snapshot-scope'

/**
 * KAN-790/T5.1: real SQLite ownership reads composed with fresh H2/H3/H4A
 * evidence. This service is read-only. The caller must source identity, selected
 * Team and effective authorization from trusted server boundaries, never forms.
 */
export function createAuthorizedReviewSnapshotSqliteScope(deps: {
  readonly sqlite: Database.Database
  readonly authenticate: () => Promise<string | null>
  readonly resolveActiveTeam: (userId: string) => Promise<string | null>
  readonly authorizePlanning: (userId: string, teamId: string, groupId: string) => Promise<boolean>
  readonly now: () => string
}) {
  return {
    async resolve(request: {
      readonly groupTrainingPlanId: string
      readonly snapshotId?: string
    }): Promise<ReviewSnapshotScopeResult> {
      return resolveAuthorizedReviewSnapshotScope(request, {
        authenticate: deps.authenticate,
        resolveActiveTeam: deps.resolveActiveTeam,
        authorizePlanning: deps.authorizePlanning,
        readPlan: async (planId) => {
          const row = deps.sqlite.prepare(`
            SELECT p.id, p.group_id AS groupId, g.team_id AS teamId,
              p.planning_cohort_id AS planningCohortId
            FROM group_training_plans AS p
            INNER JOIN athlete_groups AS g ON g.id = p.group_id
            WHERE p.id = ? AND p.is_deleted = 0 AND g.is_deleted = 0
            LIMIT 1
          `).get(planId) as {
            id: string
            groupId: string
            teamId: string
            planningCohortId: string | null
          } | undefined
          return row ?? null
        },
        readSnapshot: async (id) => {
          const row = deps.sqlite.prepare(`
            SELECT id, user_id AS userId, team_id AS teamId,
              group_training_plan_id AS groupTrainingPlanId,
              group_id AS groupId, planning_cohort_id AS planningCohortId
            FROM session_generation_review_snapshots
            WHERE id = ? AND status = 'active' AND expires_at > ?
            LIMIT 1
          `).get(id, deps.now()) as {
            id: string
            userId: string
            teamId: string
            groupTrainingPlanId: string
            groupId: string
            planningCohortId: string | null
          } | undefined
          return row ?? null
        },
      })
    },
  }
}

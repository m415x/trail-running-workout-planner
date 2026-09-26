import { buildMembershipPageModel } from './membership-page-model'
import type { TeamEconomicPolicyQueryRepository } from './membership-policy-query'

export function createMembershipPageLoader<TDatabase>({
  createRepository,
}: {
  createRepository: (db: TDatabase) => TeamEconomicPolicyQueryRepository
}) {
  return async function loadMembershipPage({
    db,
    locale,
    teamId,
    onDate,
  }: {
    db: TDatabase
    locale: 'es' | 'en'
    teamId: string
    onDate: string
  }) {
    return buildMembershipPageModel({
      locale,
      teamId,
      onDate,
      repository: createRepository(db),
    })
  }
}
